"""Local JSON-based storage for development without a database."""

import json
import os
from datetime import datetime
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
    lead_model: str | None = None
) -> Dict[str, Any]:
    """Create a new conversation."""
    _ensure_data_dir()

    selected_models = list(DEFAULT_MODELS) if models is None else models
    selected_lead = DEFAULT_LEAD_MODEL if lead_model is None else lead_model

    conversation = {
        "id": conversation_id,
        "created_at": datetime.utcnow().isoformat(),
        "title": "New Conversation",
        "models": selected_models,
        "lead_model": selected_lead,
        "messages": []
    }

    with open(_get_conversation_path(conversation_id), 'w') as f:
        json.dump(conversation, f, indent=2)

    return conversation


async def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    """Load a conversation from storage."""
    path = _get_conversation_path(conversation_id)

    if not path.exists():
        return None

    with open(path, 'r') as f:
        conversation = json.load(f)
        conversation.setdefault("models", list(DEFAULT_MODELS))
        conversation.setdefault("lead_model", DEFAULT_LEAD_MODEL)
        return conversation


async def list_conversations() -> List[Dict[str, Any]]:
    """List all conversations (metadata only)."""
    _ensure_data_dir()

    conversations = []
    for path in sorted(DATA_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            with open(path, 'r') as f:
                conv = json.load(f)
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


async def delete_conversation(conversation_id: str) -> bool:
    """
    Delete a conversation from local storage.

    Args:
        conversation_id: Conversation identifier

    Returns:
        True if deleted, False if not found
    """
    path = _get_conversation_path(conversation_id)

    if not path.exists():
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

    # Upsert the key
    keys[provider] = {
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
            "provider": data["provider"],
            "key_hint": data["key_hint"],
            "created_at": data["created_at"],
            "updated_at": data["updated_at"]
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
