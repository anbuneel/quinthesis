"""Async PostgreSQL storage for conversations and users."""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID
from . import database as db
from .config import DEFAULT_MODELS, DEFAULT_LEAD_MODEL

_schema_ready = False


async def ensure_schema():
    """Ensure conversation settings columns exist."""
    global _schema_ready
    if _schema_ready:
        return
    await db.execute(
        """
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS models JSONB,
        ADD COLUMN IF NOT EXISTS lead_model TEXT
        """
    )
    _schema_ready = True


async def create_conversation(
    conversation_id: str,
    models: List[str] | None = None,
    lead_model: str | None = None,
    user_id: Optional[UUID] = None
) -> Dict[str, Any]:
    """
    Create a new conversation.

    Args:
        conversation_id: Unique identifier for the conversation
        models: Optional list of models to use
        lead_model: Optional lead model for synthesis
        user_id: Optional user ID for ownership

    Returns:
        New conversation dict
    """
    await ensure_schema()
    created_at = datetime.utcnow()
    selected_models = list(DEFAULT_MODELS) if models is None else models
    selected_lead = DEFAULT_LEAD_MODEL if lead_model is None else lead_model

    await db.execute(
        """
        INSERT INTO conversations (id, title, created_at, updated_at, models, lead_model, user_id)
        VALUES ($1, $2, $3, $3, $4, $5, $6)
        """,
        conversation_id,
        "New Conversation",
        created_at,
        selected_models,
        selected_lead,
        user_id
    )

    return {
        "id": conversation_id,
        "created_at": created_at.isoformat(),
        "title": "New Conversation",
        "models": selected_models,
        "lead_model": selected_lead,
        "messages": []
    }


async def get_conversation(
    conversation_id: str,
    user_id: Optional[UUID] = None
) -> Optional[Dict[str, Any]]:
    """
    Load a conversation from storage.

    Args:
        conversation_id: Unique identifier for the conversation
        user_id: Optional user ID for ownership check

    Returns:
        Conversation dict or None if not found
    """
    # Get conversation metadata
    await ensure_schema()
    if user_id:
        conv_row = await db.fetchrow(
            """
            SELECT id, title, created_at, models, lead_model
            FROM conversations
            WHERE id = $1 AND user_id = $2
            """,
            conversation_id,
            user_id
        )
    else:
        conv_row = await db.fetchrow(
            """
            SELECT id, title, created_at, models, lead_model
            FROM conversations
            WHERE id = $1
            """,
            conversation_id
        )

    if not conv_row:
        return None

    raw_models = conv_row["models"]
    if isinstance(raw_models, str):
        try:
            raw_models = json.loads(raw_models)
        except json.JSONDecodeError:
            raw_models = None
    models = raw_models if raw_models else list(DEFAULT_MODELS)
    lead_model = conv_row["lead_model"] or DEFAULT_LEAD_MODEL

    # Get all messages for this conversation
    message_rows = await db.fetch(
        """
        SELECT id, role, content, message_order
        FROM messages
        WHERE conversation_id = $1
        ORDER BY message_order ASC
        """,
        conversation_id
    )

    messages = []
    for msg_row in message_rows:
        if msg_row["role"] == "user":
            messages.append({
                "role": "user",
                "content": msg_row["content"]
            })
        else:
            # Assistant message - fetch stage data
            message_id = msg_row["id"]

            # Stage 1 responses
            stage1_rows = await db.fetch(
                """
                SELECT model, response
                FROM stage1_responses
                WHERE message_id = $1
                """,
                message_id
            )
            stage1 = [{"model": r["model"], "response": r["response"]} for r in stage1_rows]

            # Stage 2 rankings
            stage2_rows = await db.fetch(
                """
                SELECT model, ranking, parsed_ranking
                FROM stage2_rankings
                WHERE message_id = $1
                """,
                message_id
            )
            stage2 = []
            for r in stage2_rows:
                item = {"model": r["model"], "ranking": r["ranking"]}
                if r["parsed_ranking"]:
                    item["parsed_ranking"] = json.loads(r["parsed_ranking"])
                stage2.append(item)

            # Stage 3 synthesis
            stage3_row = await db.fetchrow(
                """
                SELECT model, response
                FROM stage3_synthesis
                WHERE message_id = $1
                """,
                message_id
            )
            stage3 = {"model": stage3_row["model"], "response": stage3_row["response"]} if stage3_row else {}

            messages.append({
                "role": "assistant",
                "stage1": stage1,
                "stage2": stage2,
                "stage3": stage3
            })

    return {
        "id": str(conv_row["id"]),
        "created_at": conv_row["created_at"].isoformat(),
        "title": conv_row["title"],
        "models": models,
        "lead_model": lead_model,
        "messages": messages
    }


async def list_conversations(user_id: Optional[UUID] = None) -> List[Dict[str, Any]]:
    """
    List all conversations (metadata only).

    Args:
        user_id: Optional user ID to filter by

    Returns:
        List of conversation metadata dicts
    """
    if user_id:
        rows = await db.fetch(
            """
            SELECT c.id, c.title, c.created_at,
                   COUNT(m.id) as message_count
            FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.user_id = $1
            GROUP BY c.id, c.title, c.created_at
            ORDER BY c.created_at DESC
            """,
            user_id
        )
    else:
        rows = await db.fetch(
            """
            SELECT c.id, c.title, c.created_at,
                   COUNT(m.id) as message_count
            FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id
            GROUP BY c.id, c.title, c.created_at
            ORDER BY c.created_at DESC
            """
        )

    return [
        {
            "id": str(row["id"]),
            "created_at": row["created_at"].isoformat(),
            "title": row["title"],
            "message_count": row["message_count"]
        }
        for row in rows
    ]


async def add_user_message(conversation_id: str, content: str) -> int:
    """
    Add a user message to a conversation.

    Args:
        conversation_id: Conversation identifier
        content: User message content

    Returns:
        The message_order of the new message
    """
    # Get the next message order
    next_order = await db.fetchval(
        """
        SELECT COALESCE(MAX(message_order), -1) + 1
        FROM messages
        WHERE conversation_id = $1
        """,
        conversation_id
    )

    await db.execute(
        """
        INSERT INTO messages (conversation_id, role, content, message_order)
        VALUES ($1, 'user', $2, $3)
        """,
        conversation_id,
        content,
        next_order
    )

    return next_order


async def add_assistant_message(
    conversation_id: str,
    stage1: List[Dict[str, Any]],
    stage2: List[Dict[str, Any]],
    stage3: Dict[str, Any]
):
    """
    Add an assistant message with all 3 stages to a conversation.

    Args:
        conversation_id: Conversation identifier
        stage1: List of individual model responses
        stage2: List of model rankings
        stage3: Final synthesized response
    """
    # Get the next message order
    next_order = await db.fetchval(
        """
        SELECT COALESCE(MAX(message_order), -1) + 1
        FROM messages
        WHERE conversation_id = $1
        """,
        conversation_id
    )

    # Insert the assistant message
    message_id = await db.fetchval(
        """
        INSERT INTO messages (conversation_id, role, message_order)
        VALUES ($1, 'assistant', $2)
        RETURNING id
        """,
        conversation_id,
        next_order
    )

    # Insert stage 1 responses
    for item in stage1:
        await db.execute(
            """
            INSERT INTO stage1_responses (message_id, model, response)
            VALUES ($1, $2, $3)
            """,
            message_id,
            item["model"],
            item["response"]
        )

    # Insert stage 2 rankings
    for item in stage2:
        parsed = json.dumps(item.get("parsed_ranking")) if item.get("parsed_ranking") else None
        await db.execute(
            """
            INSERT INTO stage2_rankings (message_id, model, ranking, parsed_ranking)
            VALUES ($1, $2, $3, $4)
            """,
            message_id,
            item["model"],
            item["ranking"],
            parsed
        )

    # Insert stage 3 synthesis
    if stage3:
        await db.execute(
            """
            INSERT INTO stage3_synthesis (message_id, model, response)
            VALUES ($1, $2, $3)
            """,
            message_id,
            stage3.get("model", ""),
            stage3.get("response", "")
        )


async def update_conversation_title(conversation_id: str, title: str):
    """
    Update the title of a conversation.

    Args:
        conversation_id: Conversation identifier
        title: New title for the conversation
    """
    await db.execute(
        """
        UPDATE conversations
        SET title = $2, updated_at = NOW()
        WHERE id = $1
        """,
        conversation_id,
        title
    )


async def delete_conversation(conversation_id: str, user_id: Optional[UUID] = None) -> bool:
    """
    Delete a conversation and all its messages.

    Args:
        conversation_id: Conversation identifier
        user_id: Optional user ID for ownership check

    Returns:
        True if deleted, False if not found
    """
    # Delete cascade: stage1_responses, stage2_rankings, stage3_synthesis
    # are deleted via foreign key cascades when messages are deleted.
    # Messages cascade when conversation is deleted.

    if user_id:
        row = await db.fetchrow(
            """
            DELETE FROM conversations
            WHERE id = $1 AND user_id = $2
            RETURNING id
            """,
            conversation_id,
            user_id
        )
    else:
        row = await db.fetchrow(
            """
            DELETE FROM conversations
            WHERE id = $1
            RETURNING id
            """,
            conversation_id
        )

    return row is not None


# ============== User Management ==============

async def create_user(email: str, password_hash: str) -> Dict[str, Any]:
    """
    Create a new user.

    Args:
        email: User's email address
        password_hash: Bcrypt-hashed password

    Returns:
        User dict with id, email, created_at
    """
    row = await db.fetchrow(
        """
        INSERT INTO users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email, created_at
        """,
        email,
        password_hash
    )
    return dict(row)


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get user by email address."""
    row = await db.fetchrow(
        "SELECT * FROM users WHERE email = $1",
        email
    )
    return dict(row) if row else None


async def get_user_by_id(user_id: UUID) -> Optional[Dict[str, Any]]:
    """Get user by ID."""
    row = await db.fetchrow(
        "SELECT id, email, created_at, updated_at FROM users WHERE id = $1",
        user_id
    )
    return dict(row) if row else None


# ============== API Key Management ==============

async def save_user_api_key(
    user_id: UUID,
    provider: str,
    encrypted_key: str,
    key_hint: str
) -> Dict[str, Any]:
    """
    Save or update a user's API key.

    Uses upsert to handle both insert and update cases.
    """
    row = await db.fetchrow(
        """
        INSERT INTO user_api_keys (user_id, provider, encrypted_key, key_hint)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, provider)
        DO UPDATE SET encrypted_key = $3, key_hint = $4, updated_at = NOW()
        RETURNING id, provider, key_hint, created_at
        """,
        user_id,
        provider,
        encrypted_key,
        key_hint
    )
    return dict(row)


async def get_user_api_key(user_id: UUID, provider: str = "openrouter") -> Optional[str]:
    """
    Get a user's decrypted API key.

    Returns the decrypted API key string or None if not found.
    """
    row = await db.fetchrow(
        "SELECT encrypted_key FROM user_api_keys WHERE user_id = $1 AND provider = $2",
        user_id,
        provider
    )
    if row:
        from .encryption import decrypt_api_key
        return decrypt_api_key(row["encrypted_key"])
    return None


async def get_user_api_keys(user_id: UUID) -> List[Dict[str, Any]]:
    """Get all API keys for a user (metadata only, no decrypted values)."""
    rows = await db.fetch(
        "SELECT id, provider, key_hint, created_at FROM user_api_keys WHERE user_id = $1",
        user_id
    )
    return [dict(row) for row in rows]


async def delete_user_api_key(user_id: UUID, provider: str) -> bool:
    """Delete a user's API key."""
    result = await db.execute(
        "DELETE FROM user_api_keys WHERE user_id = $1 AND provider = $2",
        user_id,
        provider
    )
    return result == "DELETE 1"
