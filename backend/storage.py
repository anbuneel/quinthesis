"""Async PostgreSQL storage for conversations."""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from . import database as db


async def create_conversation(conversation_id: str) -> Dict[str, Any]:
    """
    Create a new conversation.

    Args:
        conversation_id: Unique identifier for the conversation

    Returns:
        New conversation dict
    """
    created_at = datetime.utcnow()

    await db.execute(
        """
        INSERT INTO conversations (id, title, created_at, updated_at)
        VALUES ($1, $2, $3, $3)
        """,
        conversation_id,
        "New Conversation",
        created_at
    )

    return {
        "id": conversation_id,
        "created_at": created_at.isoformat(),
        "title": "New Conversation",
        "messages": []
    }


async def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    """
    Load a conversation from storage.

    Args:
        conversation_id: Unique identifier for the conversation

    Returns:
        Conversation dict or None if not found
    """
    # Get conversation metadata
    conv_row = await db.fetchrow(
        """
        SELECT id, title, created_at
        FROM conversations
        WHERE id = $1
        """,
        conversation_id
    )

    if not conv_row:
        return None

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
        "messages": messages
    }


async def list_conversations() -> List[Dict[str, Any]]:
    """
    List all conversations (metadata only).

    Returns:
        List of conversation metadata dicts
    """
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


async def delete_conversation(conversation_id: str) -> bool:
    """
    Delete a conversation and all its messages.

    Args:
        conversation_id: Conversation identifier

    Returns:
        True if deleted, False if not found
    """
    # Delete cascade: stage1_responses, stage2_rankings, stage3_synthesis
    # are deleted via foreign key cascades when messages are deleted.
    # Messages cascade when conversation is deleted.

    result = await db.execute(
        """
        DELETE FROM conversations
        WHERE id = $1
        """,
        conversation_id
    )

    return result == "DELETE 1"
