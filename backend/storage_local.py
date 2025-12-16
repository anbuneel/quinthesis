"""Local JSON-based storage for development without a database."""

import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

# Local storage directory
DATA_DIR = Path("data/conversations")


def _ensure_data_dir():
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _get_conversation_path(conversation_id: str) -> Path:
    """Get the file path for a conversation."""
    return DATA_DIR / f"{conversation_id}.json"


async def create_conversation(conversation_id: str) -> Dict[str, Any]:
    """Create a new conversation."""
    _ensure_data_dir()

    conversation = {
        "id": conversation_id,
        "created_at": datetime.utcnow().isoformat(),
        "title": "New Conversation",
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
        return json.load(f)


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
