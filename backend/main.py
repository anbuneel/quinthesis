"""FastAPI backend for LLM Council."""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
from uuid import UUID
import uuid
import json
import asyncio

from .config import (
    CORS_ORIGINS,
    DATABASE_URL,
    AVAILABLE_MODELS,
    DEFAULT_MODELS,
    DEFAULT_LEAD_MODEL
)
from .auth import verify_credentials
from .auth_jwt import (
    get_current_user,
    get_optional_user,
    create_access_token,
    create_refresh_token,
    verify_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from .encryption import hash_password, verify_password, encrypt_api_key, get_key_hint
from .models import (
    UserRegister,
    UserLogin,
    RefreshTokenRequest,
    ApiKeyCreate,
    TokenResponse,
    UserResponse,
    ApiKeyResponse
)
from .council import (
    run_full_council,
    generate_conversation_title,
    stage1_collect_responses,
    stage2_collect_rankings,
    stage3_synthesize_final,
    calculate_aggregate_rankings
)

# Use local JSON storage if DATABASE_URL is not set
if DATABASE_URL:
    from . import storage
    from .database import get_pool, close_pool
    USE_LOCAL_STORAGE = False
else:
    from . import storage_local as storage
    USE_LOCAL_STORAGE = True
    print("⚠️  DATABASE_URL not set - using local JSON storage")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown events."""
    if not USE_LOCAL_STORAGE:
        # Startup: initialize database pool
        await get_pool()
    yield
    if not USE_LOCAL_STORAGE:
        # Shutdown: close database pool
        await close_pool()


app = FastAPI(title="LLM Council API", lifespan=lifespan)

# Enable CORS with configurable origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    models: List[str] | None = None
    lead_model: str | None = None


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str


class ConversationMetadata(BaseModel):
    """Conversation metadata for list view."""
    id: str
    created_at: str
    title: str
    message_count: int


class Conversation(BaseModel):
    """Full conversation with all messages."""
    id: str
    created_at: str
    title: str
    messages: List[Dict[str, Any]]


def validate_model_selection(
    models: List[str] | None,
    lead_model: str | None
) -> tuple[List[str], str]:
    selected_models = DEFAULT_MODELS if models is None else models
    selected_lead = DEFAULT_LEAD_MODEL if lead_model is None else lead_model

    unique_models = []
    seen = set()
    for model in selected_models:
        if model not in AVAILABLE_MODELS:
            raise HTTPException(status_code=400, detail=f"Unknown model: {model}")
        if model not in seen:
            unique_models.append(model)
            seen.add(model)

    if len(unique_models) < 2:
        raise HTTPException(status_code=400, detail="Select at least two models")
    if len(unique_models) > len(AVAILABLE_MODELS):
        raise HTTPException(status_code=400, detail="Too many models selected")
    if selected_lead not in AVAILABLE_MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown lead model: {selected_lead}")

    return unique_models, selected_lead


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


# ============== Authentication Endpoints ==============

@app.post("/api/auth/register", response_model=TokenResponse)
async def register(data: UserRegister):
    """Register a new user account."""
    # Check if email already exists
    existing = await storage.get_user_by_email(data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    password_hash = hash_password(data.password)
    user = await storage.create_user(data.email, password_hash)

    # Generate tokens
    access_token = create_access_token(user["id"])
    refresh_token = create_refresh_token(user["id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    """Login with email and password."""
    user = await storage.get_user_by_email(data.email)
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Generate tokens
    access_token = create_access_token(user["id"])
    refresh_token = create_refresh_token(user["id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@app.post("/api/auth/refresh", response_model=TokenResponse)
async def refresh_tokens(data: RefreshTokenRequest):
    """Refresh access token using refresh token."""
    user_id = verify_token(data.refresh_token, "refresh")

    # Generate new tokens
    access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(user_id: UUID = Depends(get_current_user)):
    """Get current user information."""
    user = await storage.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=user["id"],
        email=user["email"],
        created_at=user["created_at"]
    )


# ============== API Key Settings Endpoints ==============

@app.post("/api/settings/api-key", response_model=ApiKeyResponse)
async def save_api_key(data: ApiKeyCreate, user_id: UUID = Depends(get_current_user)):
    """Save or update user's API key."""
    encrypted = encrypt_api_key(data.api_key)
    hint = get_key_hint(data.api_key)

    result = await storage.save_user_api_key(user_id, data.provider, encrypted, hint)
    return ApiKeyResponse(
        id=result["id"],
        provider=result["provider"],
        key_hint=result["key_hint"],
        created_at=result["created_at"]
    )


@app.get("/api/settings/api-keys")
async def list_api_keys(user_id: UUID = Depends(get_current_user)):
    """List user's API keys (metadata only)."""
    return await storage.get_user_api_keys(user_id)


@app.delete("/api/settings/api-key/{provider}")
async def delete_api_key(provider: str, user_id: UUID = Depends(get_current_user)):
    """Delete user's API key."""
    deleted = await storage.delete_user_api_key(user_id, provider)
    if not deleted:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"status": "deleted"}


# ============== Conversation Endpoints ==============

@app.get("/api/conversations", response_model=List[ConversationMetadata])
async def list_conversations(user_id: UUID = Depends(get_current_user)):
    """List all conversations for the current user."""
    return await storage.list_conversations(user_id=user_id)


@app.get("/api/models")
async def list_models(user_id: UUID = Depends(get_current_user)):
    """List available models and defaults."""
    return {
        "models": AVAILABLE_MODELS,
        "default_models": DEFAULT_MODELS,
        "default_lead_model": DEFAULT_LEAD_MODEL
    }


@app.post("/api/conversations", response_model=Conversation)
async def create_conversation(
    request: CreateConversationRequest,
    user_id: UUID = Depends(get_current_user)
):
    """Create a new conversation for the current user."""
    conversation_id = str(uuid.uuid4())
    selected_models, selected_lead = validate_model_selection(
        request.models,
        request.lead_model
    )
    conversation = await storage.create_conversation(
        conversation_id,
        models=selected_models,
        lead_model=selected_lead,
        user_id=user_id
    )
    return conversation


@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(
    conversation_id: str,
    user_id: UUID = Depends(get_current_user)
):
    """Get a specific conversation (must belong to current user)."""
    conversation = await storage.get_conversation(conversation_id, user_id=user_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user_id: UUID = Depends(get_current_user)
):
    """Delete a conversation (must belong to current user)."""
    success = await storage.delete_conversation(conversation_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}


@app.post("/api/conversations/{conversation_id}/message")
async def send_message(
    conversation_id: str,
    request: SendMessageRequest,
    user_id: UUID = Depends(get_current_user)
):
    """
    Send a message and run the 3-stage council process.
    Returns the complete response with all stages.
    """
    # Get user's API key
    api_key = await storage.get_user_api_key(user_id, "openrouter")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No API key configured. Please add your OpenRouter API key in Settings."
        )

    # Check if conversation exists and belongs to user
    conversation = await storage.get_conversation(conversation_id, user_id=user_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0
    selected_models, selected_lead = validate_model_selection(
        conversation.get("models"),
        conversation.get("lead_model")
    )

    # Add user message
    await storage.add_user_message(conversation_id, request.content)

    # If this is the first message, generate a title
    if is_first_message:
        title = await generate_conversation_title(request.content, api_key=api_key)
        await storage.update_conversation_title(conversation_id, title)

    # Run the 3-stage council process with user's API key
    stage1_results, stage2_results, stage3_result, metadata = await run_full_council(
        request.content,
        models=selected_models,
        lead_model=selected_lead,
        api_key=api_key
    )

    # Add assistant message with all stages
    await storage.add_assistant_message(
        conversation_id,
        stage1_results,
        stage2_results,
        stage3_result
    )

    # Return the complete response with metadata
    return {
        "stage1": stage1_results,
        "stage2": stage2_results,
        "stage3": stage3_result,
        "metadata": metadata
    }


@app.post("/api/conversations/{conversation_id}/message/stream")
async def send_message_stream(
    conversation_id: str,
    request: SendMessageRequest,
    user_id: UUID = Depends(get_current_user)
):
    """
    Send a message and stream the 3-stage council process.
    Returns Server-Sent Events as each stage completes.
    """
    # Get user's API key (check early before streaming starts)
    api_key = await storage.get_user_api_key(user_id, "openrouter")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No API key configured. Please add your OpenRouter API key in Settings."
        )

    # Check if conversation exists and belongs to user
    conversation = await storage.get_conversation(conversation_id, user_id=user_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0
    selected_models, selected_lead = validate_model_selection(
        conversation.get("models"),
        conversation.get("lead_model")
    )

    async def event_generator():
        try:
            # Add user message
            await storage.add_user_message(conversation_id, request.content)

            # Start title generation in parallel (don't await yet)
            title_task = None
            if is_first_message:
                title_task = asyncio.create_task(
                    generate_conversation_title(request.content, api_key=api_key)
                )

            # Stage 1: Collect responses
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = await stage1_collect_responses(
                request.content,
                models=selected_models,
                api_key=api_key
            )
            yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            # Stage 2: Collect rankings
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            stage2_results, label_to_model = await stage2_collect_rankings(
                request.content,
                stage1_results,
                models=selected_models,
                api_key=api_key
            )
            aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
            yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"

            # Stage 3: Synthesize final answer
            yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
            stage3_result = await stage3_synthesize_final(
                request.content,
                stage1_results,
                stage2_results,
                lead_model=selected_lead,
                api_key=api_key
            )
            yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Wait for title generation if it was started
            if title_task:
                title = await title_task
                await storage.update_conversation_title(conversation_id, title)
                yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

            # Save complete assistant message
            await storage.add_assistant_message(
                conversation_id,
                stage1_results,
                stage2_results,
                stage3_result
            )

            # Send completion event
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
