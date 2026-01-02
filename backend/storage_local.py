"""Local JSON-based storage for development without a database."""

import json
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID, uuid4
from .config import DEFAULT_MODELS, DEFAULT_LEAD_MODEL
from pathlib import Path

# Local storage directories
DATA_DIR = Path("data/conversations")
USERS_DIR = Path("data/users")
API_KEYS_DIR = Path("data/api_keys")


def _ensure_data_dir():
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _get_conversation_path(conversation_id: str) -> Path:
    """Get the file path for a conversation."""
    return DATA_DIR / f"{conversation_id}.json"


async def create_conversation(
    conversation_id: str,
    models: List[str] | None = None,
    lead_model: str | None = None,
    user_id: Optional[UUID] = None
) -> Dict[str, Any]:
    """Create a new conversation."""
    _ensure_data_dir()

    selected_models = list(DEFAULT_MODELS) if models is None else models
    selected_lead = DEFAULT_LEAD_MODEL if lead_model is None else lead_model

    conversation = {
        "id": conversation_id,
        "user_id": str(user_id) if user_id else None,
        "created_at": datetime.utcnow().isoformat(),
        "title": "New Conversation",
        "models": selected_models,
        "lead_model": selected_lead,
        "messages": []
    }

    with open(_get_conversation_path(conversation_id), 'w') as f:
        json.dump(conversation, f, indent=2)

    return conversation


async def get_conversation(conversation_id: str, user_id: Optional[UUID] = None) -> Optional[Dict[str, Any]]:
    """Load a conversation from storage."""
    path = _get_conversation_path(conversation_id)

    if not path.exists():
        return None

    with open(path, 'r') as f:
        conversation = json.load(f)
        # Filter by user_id if provided
        if user_id is not None:
            conv_user_id = conversation.get("user_id")
            if conv_user_id != str(user_id):
                return None
        conversation.setdefault("models", list(DEFAULT_MODELS))
        conversation.setdefault("lead_model", DEFAULT_LEAD_MODEL)
        return conversation


async def list_conversations(user_id: Optional[UUID] = None) -> List[Dict[str, Any]]:
    """List all conversations (metadata only), optionally filtered by user_id."""
    _ensure_data_dir()

    conversations = []
    for path in sorted(DATA_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            with open(path, 'r') as f:
                conv = json.load(f)
                # Filter by user_id if provided
                if user_id is not None:
                    conv_user_id = conv.get("user_id")
                    if conv_user_id != str(user_id):
                        continue
                conversations.append({
                    "id": conv["id"],
                    "created_at": conv["created_at"],
                    "title": conv.get("title", "Untitled"),
                    "message_count": len(conv.get("messages", []))
                })
        except (json.JSONDecodeError, KeyError):
            continue

    return conversations


async def add_user_message(conversation_id: str, content: str) -> int:
    """Add a user message to a conversation."""
    conv = await get_conversation(conversation_id)
    if not conv:
        raise ValueError(f"Conversation {conversation_id} not found")

    message_order = len(conv["messages"])
    conv["messages"].append({
        "role": "user",
        "content": content
    })

    with open(_get_conversation_path(conversation_id), 'w') as f:
        json.dump(conv, f, indent=2)

    return message_order


async def add_assistant_message(
    conversation_id: str,
    stage1: List[Dict[str, Any]],
    stage2: List[Dict[str, Any]],
    stage3: Dict[str, Any]
):
    """Add an assistant message with all 3 stages to a conversation."""
    conv = await get_conversation(conversation_id)
    if not conv:
        raise ValueError(f"Conversation {conversation_id} not found")

    conv["messages"].append({
        "role": "assistant",
        "stage1": stage1,
        "stage2": stage2,
        "stage3": stage3
    })

    with open(_get_conversation_path(conversation_id), 'w') as f:
        json.dump(conv, f, indent=2)


async def update_conversation_title(conversation_id: str, title: str):
    """Update the title of a conversation."""
    conv = await get_conversation(conversation_id)
    if not conv:
        raise ValueError(f"Conversation {conversation_id} not found")

    conv["title"] = title

    with open(_get_conversation_path(conversation_id), 'w') as f:
        json.dump(conv, f, indent=2)


async def delete_conversation(conversation_id: str, user_id: Optional[UUID] = None) -> bool:
    """
    Delete a conversation from local storage.

    Args:
        conversation_id: Conversation identifier
        user_id: Optional user ID for ownership verification

    Returns:
        True if deleted, False if not found or not owned by user
    """
    path = _get_conversation_path(conversation_id)

    if not path.exists():
        return False

    # Verify ownership if user_id provided
    if user_id is not None:
        with open(path, 'r') as f:
            conv = json.load(f)
            if conv.get("user_id") != str(user_id):
                return False

    path.unlink()
    return True


# ============== User Management ==============

def _ensure_users_dir():
    """Ensure the users directory exists."""
    USERS_DIR.mkdir(parents=True, exist_ok=True)


def _ensure_api_keys_dir():
    """Ensure the API keys directory exists."""
    API_KEYS_DIR.mkdir(parents=True, exist_ok=True)


def _get_user_path(user_id: str) -> Path:
    """Get the file path for a user."""
    return USERS_DIR / f"{user_id}.json"


def _get_user_by_email_path() -> Path:
    """Get the email index file path."""
    return USERS_DIR / "_email_index.json"


def _load_email_index() -> Dict[str, str]:
    """Load the email to user_id index."""
    _ensure_users_dir()
    index_path = _get_user_by_email_path()
    if index_path.exists():
        with open(index_path, 'r') as f:
            return json.load(f)
    return {}


def _save_email_index(index: Dict[str, str]):
    """Save the email to user_id index."""
    _ensure_users_dir()
    with open(_get_user_by_email_path(), 'w') as f:
        json.dump(index, f, indent=2)


async def create_user(email: str, password_hash: str) -> Dict[str, Any]:
    """Create a new user."""
    _ensure_users_dir()

    user_id = str(uuid4())
    now = datetime.utcnow().isoformat()

    user = {
        "id": user_id,
        "email": email,
        "password_hash": password_hash,
        "created_at": now,
        "updated_at": now
    }

    # Save user file
    with open(_get_user_path(user_id), 'w') as f:
        json.dump(user, f, indent=2)

    # Update email index
    index = _load_email_index()
    index[email.lower()] = user_id
    _save_email_index(index)

    return user


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get a user by email."""
    index = _load_email_index()
    user_id = index.get(email.lower())

    if not user_id:
        return None

    return await get_user_by_id(UUID(user_id))


async def get_user_by_id(user_id: UUID) -> Optional[Dict[str, Any]]:
    """Get a user by ID."""
    path = _get_user_path(str(user_id))

    if not path.exists():
        return None

    with open(path, 'r') as f:
        return json.load(f)


# ============== OAuth User Management ==============

def _get_oauth_index_path() -> Path:
    """Get the OAuth provider index file path."""
    return USERS_DIR / "_oauth_index.json"


def _load_oauth_index() -> Dict[str, str]:
    """Load the OAuth provider:id to user_id index."""
    _ensure_users_dir()
    index_path = _get_oauth_index_path()
    if index_path.exists():
        with open(index_path, 'r') as f:
            return json.load(f)
    return {}


def _save_oauth_index(index: Dict[str, str]):
    """Save the OAuth provider:id to user_id index."""
    _ensure_users_dir()
    with open(_get_oauth_index_path(), 'w') as f:
        json.dump(index, f, indent=2)


async def create_oauth_user(
    email: str,
    oauth_provider: str,
    oauth_provider_id: str,
    name: Optional[str] = None,
    avatar_url: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new OAuth user."""
    _ensure_users_dir()

    user_id = str(uuid4())
    now = datetime.utcnow().isoformat()

    user = {
        "id": user_id,
        "email": email,
        "password_hash": None,
        "oauth_provider": oauth_provider,
        "oauth_provider_id": oauth_provider_id,
        "name": name,
        "avatar_url": avatar_url,
        "created_at": now,
        "updated_at": now
    }

    # Save user file
    with open(_get_user_path(user_id), 'w') as f:
        json.dump(user, f, indent=2)

    # Update email index
    email_index = _load_email_index()
    email_index[email.lower()] = user_id
    _save_email_index(email_index)

    # Update OAuth index
    oauth_index = _load_oauth_index()
    oauth_key = f"{oauth_provider}:{oauth_provider_id}"
    oauth_index[oauth_key] = user_id
    _save_oauth_index(oauth_index)

    return user


async def get_user_by_oauth(
    provider: str,
    provider_id: str
) -> Optional[Dict[str, Any]]:
    """Get user by OAuth provider credentials."""
    oauth_index = _load_oauth_index()
    oauth_key = f"{provider}:{provider_id}"
    user_id = oauth_index.get(oauth_key)

    if not user_id:
        return None

    return await get_user_by_id(UUID(user_id))


async def link_oauth_to_existing_user(
    user_id: UUID,
    oauth_provider: str,
    oauth_provider_id: str,
    name: Optional[str] = None,
    avatar_url: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Link OAuth credentials to an existing user account."""
    user = await get_user_by_id(user_id)
    if not user:
        return None

    # Update user data
    user["oauth_provider"] = oauth_provider
    user["oauth_provider_id"] = oauth_provider_id
    if name:
        user["name"] = name
    if avatar_url:
        user["avatar_url"] = avatar_url
    user["updated_at"] = datetime.utcnow().isoformat()

    # Save updated user
    with open(_get_user_path(str(user_id)), 'w') as f:
        json.dump(user, f, indent=2)

    # Update OAuth index
    oauth_index = _load_oauth_index()
    oauth_key = f"{oauth_provider}:{oauth_provider_id}"
    oauth_index[oauth_key] = str(user_id)
    _save_oauth_index(oauth_index)

    return user


# ============== API Key Management ==============

def _get_api_keys_path(user_id: str) -> Path:
    """Get the file path for a user's API keys."""
    return API_KEYS_DIR / f"{user_id}.json"


async def save_user_api_key(
    user_id: UUID,
    provider: str,
    encrypted_key: str,
    key_hint: str
) -> Dict[str, Any]:
    """Save or update a user's API key."""
    _ensure_api_keys_dir()

    path = _get_api_keys_path(str(user_id))
    now = datetime.utcnow().isoformat()

    # Load existing keys
    keys = {}
    if path.exists():
        with open(path, 'r') as f:
            keys = json.load(f)

    # Generate an ID if this is a new key
    existing_id = keys.get(provider, {}).get("id")
    key_id = existing_id if existing_id else str(uuid4())

    # Upsert the key
    keys[provider] = {
        "id": key_id,
        "user_id": str(user_id),
        "provider": provider,
        "encrypted_key": encrypted_key,
        "key_hint": key_hint,
        "created_at": keys.get(provider, {}).get("created_at", now),
        "updated_at": now
    }

    with open(path, 'w') as f:
        json.dump(keys, f, indent=2)

    return keys[provider]


async def get_user_api_key(user_id: UUID, provider: str) -> Optional[str]:
    """Get a user's decrypted API key for a provider."""
    from .encryption import decrypt_api_key

    path = _get_api_keys_path(str(user_id))

    if not path.exists():
        return None

    with open(path, 'r') as f:
        keys = json.load(f)

    key_data = keys.get(provider)
    if not key_data:
        return None

    return decrypt_api_key(key_data["encrypted_key"])


async def get_user_api_keys(user_id: UUID) -> List[Dict[str, Any]]:
    """List all API keys for a user (metadata only, no decrypted keys)."""
    path = _get_api_keys_path(str(user_id))

    if not path.exists():
        return []

    with open(path, 'r') as f:
        keys = json.load(f)

    return [
        {
            "id": data["id"],
            "provider": data["provider"],
            "key_hint": data["key_hint"],
            "created_at": data["created_at"],
            "updated_at": data.get("updated_at", data["created_at"])
        }
        for data in keys.values()
    ]


async def delete_user_api_key(user_id: UUID, provider: str) -> bool:
    """Delete a user's API key."""
    path = _get_api_keys_path(str(user_id))

    if not path.exists():
        return False

    with open(path, 'r') as f:
        keys = json.load(f)

    if provider not in keys:
        return False

    del keys[provider]

    with open(path, 'w') as f:
        json.dump(keys, f, indent=2)

    return True


# ============== Credits System Stubs (Local Dev) ==============
# These are stubs for local development without a database.
# The full credits system requires PostgreSQL.

CREDITS_DIR = Path("data/credits")


def _ensure_credits_dir():
    """Ensure the credits directory exists."""
    CREDITS_DIR.mkdir(parents=True, exist_ok=True)


def _get_user_credits_path(user_id: str) -> Path:
    """Get the path for a user's credits file."""
    return CREDITS_DIR / f"{user_id}.json"


def _load_user_credits(user_id: str) -> Dict[str, Any]:
    """Load user credits data."""
    _ensure_credits_dir()
    path = _get_user_credits_path(user_id)
    if path.exists():
        with open(path, 'r') as f:
            return json.load(f)
    return {"credits": 0, "openrouter_total_limit": 0, "transactions": []}


def _save_user_credits(user_id: str, data: Dict[str, Any]):
    """Save user credits data."""
    _ensure_credits_dir()
    with open(_get_user_credits_path(user_id), 'w') as f:
        json.dump(data, f, indent=2)


async def get_user_credits(user_id: UUID) -> int:
    """Get user's current credit balance."""
    data = _load_user_credits(str(user_id))
    return data.get("credits", 0)


async def add_credits(
    user_id: UUID,
    amount: int,
    transaction_type: str,
    description: str = None,
    stripe_session_id: str = None,
    stripe_payment_intent_id: str = None
) -> int:
    """Add credits to user and record transaction."""
    data = _load_user_credits(str(user_id))
    data["credits"] = data.get("credits", 0) + amount
    data["transactions"].append({
        "id": str(uuid4()),
        "amount": amount,
        "balance_after": data["credits"],
        "transaction_type": transaction_type,
        "description": description,
        "stripe_session_id": stripe_session_id,
        "created_at": datetime.utcnow().isoformat()
    })
    _save_user_credits(str(user_id), data)
    return data["credits"]


async def consume_credit(user_id: UUID, description: str = None) -> bool:
    """Consume one credit from user. Returns False if insufficient credits."""
    data = _load_user_credits(str(user_id))
    if data.get("credits", 0) <= 0:
        return False
    data["credits"] -= 1
    data["transactions"].append({
        "id": str(uuid4()),
        "amount": -1,
        "balance_after": data["credits"],
        "transaction_type": "usage",
        "description": description,
        "created_at": datetime.utcnow().isoformat()
    })
    _save_user_credits(str(user_id), data)
    return True


async def get_credit_transactions(user_id: UUID, limit: int = 50) -> List[Dict]:
    """Get user's credit transaction history."""
    data = _load_user_credits(str(user_id))
    transactions = data.get("transactions", [])
    return sorted(transactions, key=lambda x: x["created_at"], reverse=True)[:limit]


async def get_active_credit_packs() -> List[Dict]:
    """List available credit packs (hardcoded for local dev)."""
    return [
        {"id": "pack-starter", "name": "Starter Pack", "credits": 10, "price_cents": 500, "openrouter_credit_limit": 2.00},
        {"id": "pack-value", "name": "Value Pack", "credits": 50, "price_cents": 2000, "openrouter_credit_limit": 10.00},
        {"id": "pack-pro", "name": "Pro Pack", "credits": 150, "price_cents": 5000, "openrouter_credit_limit": 30.00},
    ]


async def get_credit_pack(pack_id: UUID) -> Optional[Dict]:
    """Get a specific credit pack by ID."""
    packs = await get_active_credit_packs()
    for pack in packs:
        if pack["id"] == str(pack_id):
            return pack
    return None


async def get_deposit_options() -> List[Dict]:
    """List available deposit options (hardcoded for local dev)."""
    # Use stable UUIDs for local dev to match Pydantic UUID schema
    return [
        {"id": "00000000-0000-0000-0000-000000000001", "name": "$1 Try It", "amount_cents": 100},
        {"id": "00000000-0000-0000-0000-000000000002", "name": "$2 Starter", "amount_cents": 200},
        {"id": "00000000-0000-0000-0000-000000000005", "name": "$5 Deposit", "amount_cents": 500},
        {"id": "00000000-0000-0000-0000-000000000010", "name": "$10 Deposit", "amount_cents": 1000},
        {"id": "00000000-0000-0000-0000-000000000020", "name": "$20 Deposit", "amount_cents": 2000},
    ]


async def get_deposit_option(
    option_id: UUID,
    include_inactive: bool = False
) -> Optional[Dict]:
    """Get a specific deposit option by ID.

    Args:
        option_id: The deposit option UUID
        include_inactive: Ignored in local dev (all options always returned)
    """
    options = await get_deposit_options()
    for option in options:
        if option["id"] == str(option_id):
            return option
    return None


async def was_session_processed(stripe_session_id: str) -> bool:
    """Check if a Stripe session was already processed."""
    # For local dev, check all user credit files
    _ensure_credits_dir()
    for path in CREDITS_DIR.glob("*.json"):
        with open(path, 'r') as f:
            data = json.load(f)
            for tx in data.get("transactions", []):
                if tx.get("stripe_session_id") == stripe_session_id:
                    return True
    return False


async def get_user_openrouter_key(user_id: UUID) -> Optional[str]:
    """Get user's provisioned OpenRouter API key (decrypted)."""
    # For local dev, return None (no provisioning)
    return None


async def get_user_openrouter_key_hash(user_id: UUID) -> Optional[str]:
    """Get user's OpenRouter key hash."""
    return None


async def save_user_openrouter_key(user_id: UUID, encrypted_key: str, key_hash: str) -> None:
    """Save user's provisioned OpenRouter key."""
    # For local dev, just log
    pass


async def get_user_stripe_customer_id(user_id: UUID) -> Optional[str]:
    """Get user's Stripe customer ID."""
    return None


async def save_user_stripe_customer_id(user_id: UUID, stripe_customer_id: str) -> None:
    """Save user's Stripe customer ID."""
    pass


async def increment_openrouter_limit(user_id: UUID, additional_limit: float) -> float:
    """Atomically increment user's OpenRouter limit and return the new total."""
    data = _load_user_credits(str(user_id))
    data["openrouter_total_limit"] = data.get("openrouter_total_limit", 0) + additional_limit
    _save_user_credits(str(user_id), data)
    return data["openrouter_total_limit"]


async def get_openrouter_total_limit(user_id: UUID) -> float:
    """Get user's total OpenRouter limit."""
    data = _load_user_credits(str(user_id))
    return data.get("openrouter_total_limit", 0)


async def export_user_data(user_id: UUID) -> Dict[str, Any]:
    """Export all user data for GDPR compliance (local storage version).

    Returns a dict with account and conversation data.
    """
    user_id_str = str(user_id)
    user_path = USERS_DIR / f"{user_id_str}.json"

    if not user_path.exists():
        return None

    with open(user_path, 'r') as f:
        user = json.load(f)

    account_data = {
        "email": user.get("email"),
        "name": user.get("name"),
        "avatar_url": user.get("avatar_url"),
        "oauth_provider": user.get("oauth_provider"),
        "balance": user.get("balance", 0.0),
        "total_deposited": user.get("total_deposited", 0.0),
        "total_spent": user.get("total_spent", 0.0),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
    }

    # Get all conversations for this user
    conversations = []
    _ensure_data_dir()
    for conv_file in DATA_DIR.glob("*.json"):
        with open(conv_file, 'r') as f:
            conv = json.load(f)
        if conv.get("user_id") == user_id_str:
            conversations.append({
                "title": conv.get("title"),
                "created_at": conv.get("created_at"),
                "models": conv.get("models", []),
                "lead_model": conv.get("lead_model"),
                "messages": conv.get("messages", []),
            })

    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "account": account_data,
        "conversations": conversations,
        "transactions": [],  # No transaction tracking in local storage
        "usage_history": [],  # No usage tracking in local storage
    }


async def delete_user_account(user_id: UUID) -> tuple[bool, Optional[str]]:
    """Delete user account and all associated data (local storage version).

    Returns:
        Tuple of (success, openrouter_key_hash):
        - success: True if user was deleted, False if user not found
        - openrouter_key_hash: Always None for local storage
    """
    user_id_str = str(user_id)
    user_path = USERS_DIR / f"{user_id_str}.json"

    if not user_path.exists():
        return False, None

    # Delete user's conversations
    _ensure_data_dir()
    for conv_file in DATA_DIR.glob("*.json"):
        with open(conv_file, 'r') as f:
            conv = json.load(f)
        if conv.get("user_id") == user_id_str:
            conv_file.unlink()

    # Delete user's API key file if exists
    api_key_path = API_KEYS_DIR / f"{user_id_str}.json"
    if api_key_path.exists():
        api_key_path.unlink()

    # Delete user's credits file if exists
    credits_path = USERS_DIR / f"{user_id_str}_credits.json"
    if credits_path.exists():
        credits_path.unlink()

    # Delete user file
    user_path.unlink()

    return True, None
