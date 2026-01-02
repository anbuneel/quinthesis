"""Async PostgreSQL storage for conversations and users."""

import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID
from . import database as db
from .config import DEFAULT_MODELS, DEFAULT_LEAD_MODEL

logger = logging.getLogger(__name__)

_schema_ready = False


async def ensure_schema():
    """Ensure conversation settings columns exist.

    Attempts to add optional columns to the conversations table.
    Logs errors instead of silently ignoring them.
    """
    global _schema_ready
    if _schema_ready:
        return

    # Add columns one at a time (PostgreSQL requires separate statements for IF NOT EXISTS)
    columns = [
        ("models", "JSONB"),
        ("lead_model", "TEXT"),
        ("user_id", "UUID"),
    ]

    for col_name, col_type in columns:
        try:
            await db.execute(f"ALTER TABLE conversations ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
        except Exception as e:
            # Log error but continue - column may already exist or table structure differs
            logger.warning(f"Failed to add column {col_name} to conversations: {e}")

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
        json.dumps(selected_models),
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

    # Collect assistant message IDs for batch fetching
    assistant_msg_ids = [
        msg_row["id"] for msg_row in message_rows if msg_row["role"] == "assistant"
    ]

    # Batch fetch all stage data in 3 queries instead of 3*N queries
    stage1_data = {}
    stage2_data = {}
    stage3_data = {}

    if assistant_msg_ids:
        # Fetch all stage1 responses for all assistant messages
        stage1_rows = await db.fetch(
            """
            SELECT message_id, model, response
            FROM stage1_responses
            WHERE message_id = ANY($1)
            ORDER BY message_id, model ASC
            """,
            assistant_msg_ids
        )
        for r in stage1_rows:
            mid = r["message_id"]
            if mid not in stage1_data:
                stage1_data[mid] = []
            stage1_data[mid].append({"model": r["model"], "response": r["response"]})

        # Fetch all stage2 rankings for all assistant messages
        stage2_rows = await db.fetch(
            """
            SELECT message_id, model, ranking, parsed_ranking
            FROM stage2_rankings
            WHERE message_id = ANY($1)
            ORDER BY message_id, model ASC
            """,
            assistant_msg_ids
        )
        for r in stage2_rows:
            mid = r["message_id"]
            if mid not in stage2_data:
                stage2_data[mid] = []
            item = {"model": r["model"], "ranking": r["ranking"]}
            if r["parsed_ranking"]:
                item["parsed_ranking"] = json.loads(r["parsed_ranking"])
            stage2_data[mid].append(item)

        # Fetch all stage3 synthesis for all assistant messages
        stage3_rows = await db.fetch(
            """
            SELECT message_id, model, response
            FROM stage3_synthesis
            WHERE message_id = ANY($1)
            """,
            assistant_msg_ids
        )
        for r in stage3_rows:
            stage3_data[r["message_id"]] = {"model": r["model"], "response": r["response"]}

    # Assemble messages with pre-fetched stage data
    messages = []
    for msg_row in message_rows:
        if msg_row["role"] == "user":
            messages.append({
                "role": "user",
                "content": msg_row["content"]
            })
        else:
            message_id = msg_row["id"]
            messages.append({
                "role": "assistant",
                "stage1": stage1_data.get(message_id, []),
                "stage2": stage2_data.get(message_id, []),
                "stage3": stage3_data.get(message_id, {})
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

    Uses a transaction with FOR UPDATE to prevent race conditions
    when calculating message order.

    Args:
        conversation_id: Conversation identifier
        content: User message content

    Returns:
        The message_order of the new message
    """
    async with db.transaction() as conn:
        # Get the next message order (with FOR UPDATE to prevent race conditions)
        next_order = await conn.fetchval(
            """
            SELECT COALESCE(MAX(message_order), -1) + 1
            FROM messages
            WHERE conversation_id = $1
            FOR UPDATE
            """,
            conversation_id
        )

        await conn.execute(
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

    All inserts are wrapped in a transaction to ensure atomicity.
    If any insert fails, all changes are rolled back.

    Args:
        conversation_id: Conversation identifier
        stage1: List of individual model responses
        stage2: List of model rankings
        stage3: Final synthesized response
    """
    async with db.transaction() as conn:
        # Get the next message order (with FOR UPDATE to prevent race conditions)
        next_order = await conn.fetchval(
            """
            SELECT COALESCE(MAX(message_order), -1) + 1
            FROM messages
            WHERE conversation_id = $1
            FOR UPDATE
            """,
            conversation_id
        )

        # Insert the assistant message
        message_id = await conn.fetchval(
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
            await conn.execute(
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
            await conn.execute(
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
            await conn.execute(
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
        "SELECT id, email, name, avatar_url, oauth_provider, created_at, updated_at FROM users WHERE id = $1",
        user_id
    )
    return dict(row) if row else None


# ============== OAuth User Management ==============

async def create_oauth_user(
    email: str,
    oauth_provider: str,
    oauth_provider_id: str,
    name: Optional[str] = None,
    avatar_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new OAuth user.

    Args:
        email: User's email address
        oauth_provider: OAuth provider ('google' or 'github')
        oauth_provider_id: Provider's unique user ID
        name: User's display name
        avatar_url: User's avatar URL

    Returns:
        User dict with id, email, name, avatar_url, oauth_provider, created_at
    """
    row = await db.fetchrow(
        """
        INSERT INTO users (email, oauth_provider, oauth_provider_id, name, avatar_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, name, avatar_url, oauth_provider, created_at
        """,
        email,
        oauth_provider,
        oauth_provider_id,
        name,
        avatar_url
    )
    return dict(row)


async def get_user_by_oauth(
    provider: str,
    provider_id: str
) -> Optional[Dict[str, Any]]:
    """Get user by OAuth provider credentials."""
    row = await db.fetchrow(
        """
        SELECT id, email, name, avatar_url, oauth_provider, oauth_provider_id, created_at
        FROM users
        WHERE oauth_provider = $1 AND oauth_provider_id = $2
        """,
        provider,
        provider_id
    )
    return dict(row) if row else None


async def link_oauth_to_existing_user(
    user_id: UUID,
    oauth_provider: str,
    oauth_provider_id: str,
    name: Optional[str] = None,
    avatar_url: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Link OAuth credentials to an existing user account.

    Args:
        user_id: Existing user's ID
        oauth_provider: OAuth provider ('google' or 'github')
        oauth_provider_id: Provider's unique user ID
        name: User's display name (updates if provided)
        avatar_url: User's avatar URL (updates if provided)

    Returns:
        Updated user dict or None if user not found
    """
    row = await db.fetchrow(
        """
        UPDATE users
        SET oauth_provider = $2,
            oauth_provider_id = $3,
            name = COALESCE($4, name),
            avatar_url = COALESCE($5, avatar_url),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, name, avatar_url, oauth_provider, created_at
        """,
        user_id,
        oauth_provider,
        oauth_provider_id,
        name,
        avatar_url
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


# ============== Credit Management ==============

async def get_user_credits(user_id: UUID) -> int:
    """Get user's current credit balance."""
    row = await db.fetchrow(
        "SELECT credits FROM users WHERE id = $1",
        user_id
    )
    return row["credits"] if row else 0


async def add_credits(
    user_id: UUID,
    amount: int,
    transaction_type: str,
    description: str = None,
    stripe_session_id: str = None,
    stripe_payment_intent_id: str = None
) -> int:
    """Add credits to user and record transaction.

    Args:
        user_id: User's ID
        amount: Credits to add (positive for purchases, negative for usage)
        transaction_type: Type of transaction ('purchase', 'usage', 'refund', 'bonus')
        description: Optional description
        stripe_session_id: Stripe session ID for purchases
        stripe_payment_intent_id: Stripe payment intent ID

    Returns:
        New credit balance
    """
    async with db.transaction() as conn:
        # Update credits with FOR UPDATE to prevent race conditions
        new_balance = await conn.fetchval(
            """
            UPDATE users
            SET credits = credits + $2, updated_at = NOW()
            WHERE id = $1
            RETURNING credits
            """,
            user_id,
            amount
        )

        # Record transaction
        await conn.execute(
            """
            INSERT INTO credit_transactions
            (user_id, amount, balance_after, transaction_type, description,
             stripe_session_id, stripe_payment_intent_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            user_id,
            amount,
            new_balance,
            transaction_type,
            description,
            stripe_session_id,
            stripe_payment_intent_id
        )

        return new_balance


async def consume_credit(user_id: UUID, description: str = "Council query") -> bool:
    """Consume 1 credit for a query.

    Uses atomic update to prevent race conditions.

    Args:
        user_id: User's ID
        description: Description for the transaction

    Returns:
        True if credit consumed successfully, False if insufficient credits
    """
    async with db.transaction() as conn:
        # Check and decrement in one atomic operation
        new_balance = await conn.fetchval(
            """
            UPDATE users
            SET credits = credits - 1, updated_at = NOW()
            WHERE id = $1 AND credits > 0
            RETURNING credits
            """,
            user_id
        )

        if new_balance is None:
            return False  # Insufficient credits

        # Record usage transaction
        await conn.execute(
            """
            INSERT INTO credit_transactions
            (user_id, amount, balance_after, transaction_type, description)
            VALUES ($1, -1, $2, 'usage', $3)
            """,
            user_id,
            new_balance,
            description
        )

        return True


async def get_credit_transactions(
    user_id: UUID,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Get user's credit transaction history."""
    rows = await db.fetch(
        """
        SELECT id, amount, balance_after, transaction_type, description, created_at
        FROM credit_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        user_id,
        limit
    )
    return [dict(row) for row in rows]


async def get_active_credit_packs() -> List[Dict[str, Any]]:
    """Get all active credit packs."""
    rows = await db.fetch(
        """
        SELECT id, name, credits, price_cents, openrouter_credit_limit
        FROM credit_packs
        WHERE is_active = true
        ORDER BY sort_order ASC
        """
    )
    return [dict(row) for row in rows]


async def get_credit_pack(pack_id: UUID) -> Optional[Dict[str, Any]]:
    """Get a specific credit pack."""
    row = await db.fetchrow(
        "SELECT * FROM credit_packs WHERE id = $1 AND is_active = true",
        pack_id
    )
    return dict(row) if row else None


async def was_session_processed(stripe_session_id: str) -> bool:
    """Check if a Stripe session was already processed (idempotency check)."""
    row = await db.fetchrow(
        "SELECT id FROM credit_transactions WHERE stripe_session_id = $1",
        stripe_session_id
    )
    return row is not None


# ============== OpenRouter Provisioned Key Management ==============

async def get_user_openrouter_key(user_id: UUID) -> Optional[str]:
    """Get user's provisioned OpenRouter API key (decrypted).

    Returns:
        Decrypted API key or None if not found
    """
    row = await db.fetchrow(
        "SELECT openrouter_api_key FROM users WHERE id = $1",
        user_id
    )
    if row and row["openrouter_api_key"]:
        from .encryption import decrypt_api_key
        return decrypt_api_key(row["openrouter_api_key"])
    return None


async def get_user_openrouter_key_hash(user_id: UUID) -> Optional[str]:
    """Get user's OpenRouter key hash (for provisioning API calls)."""
    row = await db.fetchrow(
        "SELECT openrouter_key_hash FROM users WHERE id = $1",
        user_id
    )
    return row["openrouter_key_hash"] if row else None


async def save_user_openrouter_key(
    user_id: UUID,
    encrypted_key: str,
    key_hash: str
) -> None:
    """Save user's provisioned OpenRouter API key.

    Args:
        user_id: User's ID
        encrypted_key: Fernet-encrypted API key
        key_hash: Key hash for provisioning API calls
    """
    await db.execute(
        """
        UPDATE users
        SET openrouter_api_key = $2, openrouter_key_hash = $3, updated_at = NOW()
        WHERE id = $1
        """,
        user_id,
        encrypted_key,
        key_hash
    )


async def get_user_stripe_customer_id(user_id: UUID) -> Optional[str]:
    """Get user's Stripe customer ID."""
    row = await db.fetchrow(
        "SELECT stripe_customer_id FROM users WHERE id = $1",
        user_id
    )
    return row["stripe_customer_id"] if row else None


async def save_user_stripe_customer_id(user_id: UUID, stripe_customer_id: str) -> None:
    """Save user's Stripe customer ID."""
    await db.execute(
        """
        UPDATE users
        SET stripe_customer_id = $2, updated_at = NOW()
        WHERE id = $1
        """,
        user_id,
        stripe_customer_id
    )


async def increment_openrouter_limit(user_id: UUID, additional_limit) -> float:
    """Atomically increment user's OpenRouter limit and return the new total.

    MEDIUM: This prevents race conditions when multiple purchases happen concurrently.
    The database handles the atomic increment, and we set OpenRouter to the resulting total.

    Args:
        user_id: User's ID
        additional_limit: Amount to add to the limit (in dollars) - can be Decimal or float

    Returns:
        The new total limit after increment (as float for API compatibility)
    """
    # Convert to float for database (NUMERIC type handles precision)
    limit_value = float(additional_limit)
    row = await db.fetchrow(
        """
        UPDATE users
        SET openrouter_total_limit = openrouter_total_limit + $2, updated_at = NOW()
        WHERE id = $1
        RETURNING openrouter_total_limit
        """,
        user_id,
        limit_value
    )
    return float(row["openrouter_total_limit"]) if row else 0.0


async def get_openrouter_total_limit(user_id: UUID) -> float:
    """Get user's total OpenRouter limit."""
    row = await db.fetchrow(
        "SELECT openrouter_total_limit FROM users WHERE id = $1",
        user_id
    )
    return float(row["openrouter_total_limit"]) if row else 0.0


# ============== Usage-Based Billing ==============

# 10% margin on OpenRouter costs
MARGIN_RATE = 0.10


async def get_user_balance(user_id: UUID) -> float:
    """Get user's current dollar balance."""
    row = await db.fetchrow(
        "SELECT balance FROM users WHERE id = $1",
        user_id
    )
    return float(row["balance"]) if row else 0.0


async def check_minimum_balance(user_id: UUID, minimum: float = 0.50) -> bool:
    """Check if user has minimum balance to make a query.

    Args:
        user_id: User's ID
        minimum: Minimum required balance (default $0.50)

    Returns:
        True if balance >= minimum, False otherwise
    """
    balance = await get_user_balance(user_id)
    return balance >= minimum


async def add_deposit(
    user_id: UUID,
    amount_dollars: float,
    transaction_type: str = "deposit",
    description: str = None,
    stripe_session_id: str = None,
    stripe_payment_intent_id: str = None
) -> float:
    """Add deposit to user's dollar balance.

    Args:
        user_id: User's ID
        amount_dollars: Amount in dollars to add
        transaction_type: Type of transaction ('deposit', 'refund')
        description: Optional description
        stripe_session_id: Stripe session ID for deposits
        stripe_payment_intent_id: Stripe payment intent ID

    Returns:
        New balance
    """
    async with db.transaction() as conn:
        new_balance = await conn.fetchval(
            """
            UPDATE users
            SET balance = balance + $2,
                total_deposited = total_deposited + $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING balance
            """,
            user_id,
            amount_dollars
        )

        # Record transaction
        await conn.execute(
            """
            INSERT INTO credit_transactions
            (user_id, amount, balance_after, balance_after_dollars,
             transaction_type, description, stripe_session_id, stripe_payment_intent_id,
             total_cost)
            VALUES ($1, 0, 0, $2, $3, $4, $5, $6, $7)
            """,
            user_id,
            new_balance,
            transaction_type,
            description or f"Deposit ${amount_dollars:.2f}",
            stripe_session_id,
            stripe_payment_intent_id,
            amount_dollars
        )

        return float(new_balance)


async def deduct_query_cost(
    user_id: UUID,
    conversation_id: str,
    generation_ids: List[str],
    openrouter_cost: float,
    model_breakdown: Dict[str, float] = None,
    description: str = None
) -> tuple[bool, float]:
    """Deduct query cost from user's balance.

    Calculates margin and total cost, then atomically deducts from balance.

    Args:
        user_id: User's ID
        conversation_id: Conversation ID for tracking
        generation_ids: List of OpenRouter generation IDs
        openrouter_cost: Raw OpenRouter cost in dollars
        model_breakdown: Optional cost per model {model_name: cost}
        description: Optional description

    Returns:
        Tuple of (success, new_balance)
        Note: May allow small negative balance (up to -$0.50) for good UX
    """
    margin_cost = openrouter_cost * MARGIN_RATE
    total_cost = openrouter_cost + margin_cost

    async with db.transaction() as conn:
        # Deduct from balance
        new_balance = await conn.fetchval(
            """
            UPDATE users
            SET balance = balance - $2,
                total_spent = total_spent + $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING balance
            """,
            user_id,
            total_cost
        )

        # Record in query_costs table for detailed tracking
        await conn.execute(
            """
            INSERT INTO query_costs
            (user_id, conversation_id, generation_ids,
             openrouter_cost, margin_cost, total_cost, model_breakdown)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            user_id,
            conversation_id,
            json.dumps(generation_ids),
            openrouter_cost,
            margin_cost,
            total_cost,
            json.dumps(model_breakdown) if model_breakdown else None
        )

        # Also record in credit_transactions for unified history
        await conn.execute(
            """
            INSERT INTO credit_transactions
            (user_id, amount, balance_after, balance_after_dollars,
             openrouter_cost, margin_cost, total_cost, generation_ids,
             transaction_type, description)
            VALUES ($1, 0, 0, $2, $3, $4, $5, $6, 'usage', $7)
            """,
            user_id,
            new_balance,
            openrouter_cost,
            margin_cost,
            total_cost,
            json.dumps(generation_ids),
            description or f"Query cost: ${total_cost:.4f}"
        )

        return True, float(new_balance)


async def refund_query_cost(
    user_id: UUID,
    openrouter_cost: float,
    description: str = "Query refund"
) -> float:
    """Refund a query cost to user's balance.

    Args:
        user_id: User's ID
        openrouter_cost: The OpenRouter cost that was charged
        description: Reason for refund

    Returns:
        New balance
    """
    margin_cost = openrouter_cost * MARGIN_RATE
    total_cost = openrouter_cost + margin_cost

    return await add_deposit(
        user_id,
        total_cost,
        transaction_type="refund",
        description=description
    )


async def get_deposit_options() -> List[Dict[str, Any]]:
    """Get available deposit options."""
    rows = await db.fetch(
        """
        SELECT id, name, amount_cents
        FROM deposit_options
        WHERE is_active = true
        ORDER BY sort_order ASC
        """
    )
    return [dict(row) for row in rows]


async def get_deposit_option(option_id: UUID) -> Optional[Dict[str, Any]]:
    """Get a specific deposit option."""
    row = await db.fetchrow(
        "SELECT * FROM deposit_options WHERE id = $1 AND is_active = true",
        option_id
    )
    return dict(row) if row else None


async def get_usage_history(
    user_id: UUID,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Get user's usage history with cost breakdowns.

    Returns query costs with OpenRouter cost, margin, and model breakdown.
    """
    rows = await db.fetch(
        """
        SELECT id, conversation_id, openrouter_cost, margin_cost,
               total_cost, model_breakdown, created_at
        FROM query_costs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        user_id,
        limit
    )
    return [dict(row) for row in rows]


async def get_user_billing_info(user_id: UUID) -> Dict[str, Any]:
    """Get user's complete billing information.

    Returns balance, total deposited, total spent, and whether they have an API key.
    """
    row = await db.fetchrow(
        """
        SELECT balance, total_deposited, total_spent, openrouter_api_key IS NOT NULL as has_openrouter_key
        FROM users WHERE id = $1
        """,
        user_id
    )
    if row:
        return {
            "balance": float(row["balance"]),
            "total_deposited": float(row["total_deposited"]),
            "total_spent": float(row["total_spent"]),
            "has_openrouter_key": row["has_openrouter_key"]
        }
    return {
        "balance": 0.0,
        "total_deposited": 0.0,
        "total_spent": 0.0,
        "has_openrouter_key": False
    }
