"""FastAPI backend for LLM Council."""

import logging
from fastapi import FastAPI, HTTPException, Depends, Request

logger = logging.getLogger(__name__)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
from uuid import UUID
import uuid
import json
import asyncio
import asyncpg
from decimal import Decimal
import io
import zipfile
from datetime import datetime

from .rate_limit import api_rate_limiter, streaming_rate_limiter, checkout_rate_limiter

from .config import (
    CORS_ORIGINS,
    DATABASE_URL,
    AVAILABLE_MODELS,
    DEFAULT_MODELS,
    DEFAULT_LEAD_MODEL,
    validate_secrets
)
from .auth_jwt import (
    get_current_user,
    get_optional_user,
    create_access_token,
    create_refresh_token,
    verify_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from .encryption import encrypt_api_key, get_key_hint
from .models import (
    OAuthCallbackRequest,
    RefreshTokenRequest,
    ApiKeyCreate,
    TokenResponse,
    UserResponse,
    ApiKeyResponse,
    CreditPackResponse,
    UserCreditsResponse,
    CreditTransactionResponse,
    CreateCheckoutRequest,
    CheckoutSessionResponse,
    # Usage-based billing models
    DepositOptionResponse,
    UserBalanceResponse,
    UsageHistoryResponse,
    CreateDepositRequest,
    QueryCostResponse,
    # BYOK models
    BYOKKeyCreate,
    ApiModeResponse,
)
from .oauth import GoogleOAuth, GitHubOAuth
from .oauth_state import create_oauth_state, validate_and_consume_state
from .council import (
    run_full_council,
    generate_conversation_title,
    stage1_collect_responses,
    stage2_collect_rankings,
    stage3_synthesize_final,
    calculate_aggregate_rankings
)
from .openrouter import close_client as close_openrouter_client, get_generation_costs_batch
from . import stripe_client
from . import openrouter_provisioning

# Use local JSON storage if DATABASE_URL is not set
if DATABASE_URL:
    from . import storage
    from .database import get_pool, close_pool
    USE_LOCAL_STORAGE = False
else:
    from . import storage_local as storage
    USE_LOCAL_STORAGE = True
    print("[WARNING] DATABASE_URL not set - using local JSON storage")


def get_client_ip(request: Request) -> str:
    """Get client IP address, handling proxies via X-Forwarded-For header."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Take the first IP in the chain (original client)
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown events."""
    # Fail fast if required secrets are not configured
    validate_secrets()

    if not USE_LOCAL_STORAGE:
        # Startup: initialize database pool
        await get_pool()
    yield
    # Shutdown: close all clients
    await close_openrouter_client()
    await openrouter_provisioning.close_client()
    if not USE_LOCAL_STORAGE:
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

# Request body size limit (1MB)
MAX_REQUEST_BODY_SIZE = 1024 * 1024  # 1MB


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """Reject requests with body larger than MAX_REQUEST_BODY_SIZE."""
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_REQUEST_BODY_SIZE:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request body too large (max 1MB)"}
                )
        except ValueError:
            pass  # Invalid content-length header, let it through
    return await call_next(request)


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


# ============== OAuth Authentication Endpoints ==============

async def find_or_create_oauth_user(oauth_user) -> dict:
    """
    Find existing user or create new one from OAuth data.
    Links OAuth to existing account if email matches.
    """
    # 1. Check if OAuth account already linked
    existing_oauth = await storage.get_user_by_oauth(
        oauth_user.provider,
        oauth_user.provider_id
    )
    if existing_oauth:
        return existing_oauth

    # 2. Check if email exists (link OAuth to existing account)
    existing_email = await storage.get_user_by_email(oauth_user.email)
    if existing_email:
        from uuid import UUID
        user = await storage.link_oauth_to_existing_user(
            UUID(str(existing_email["id"])),
            oauth_user.provider,
            oauth_user.provider_id,
            oauth_user.name,
            oauth_user.avatar_url
        )
        return user

    # 3. Create new user
    user = await storage.create_oauth_user(
        email=oauth_user.email,
        oauth_provider=oauth_user.provider,
        oauth_provider_id=oauth_user.provider_id,
        name=oauth_user.name,
        avatar_url=oauth_user.avatar_url
    )
    return user


@app.get("/api/auth/oauth/{provider}")
async def get_oauth_url(provider: str):
    """Get OAuth authorization URL for the specified provider.

    Creates a server-side state token with PKCE code challenge for
    CSRF protection and authorization code interception prevention.
    """
    # Create state with PKCE - state and code_verifier are stored server-side
    state, code_challenge = await create_oauth_state()

    if provider == "google":
        url = GoogleOAuth.get_authorization_url(state, code_challenge)
    elif provider == "github":
        url = GitHubOAuth.get_authorization_url(state, code_challenge)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown OAuth provider: {provider}")

    return {"authorization_url": url, "state": state}


@app.post("/api/auth/oauth/{provider}/callback", response_model=TokenResponse)
async def oauth_callback(provider: str, data: OAuthCallbackRequest, request: Request):
    """Complete OAuth flow and return JWT tokens.

    Validates the state token server-side and uses the stored PKCE
    code_verifier for token exchange.

    Rate limited to 30 requests/minute per IP to prevent brute-force attacks.
    """
    # Rate limit by client IP (user not authenticated yet)
    await api_rate_limiter.check(get_client_ip(request))

    # Validate state and get PKCE code_verifier
    code_verifier = await validate_and_consume_state(data.state)
    if code_verifier is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OAuth state - please try again"
        )

    try:
        if provider == "google":
            # Exchange code for tokens with PKCE verification
            tokens = await GoogleOAuth.exchange_code(data.code, code_verifier)
            access_token = tokens["access_token"]
            # Get user info
            oauth_user = await GoogleOAuth.get_user_info(access_token)
        elif provider == "github":
            # Exchange code for tokens (GitHub doesn't use PKCE but we pass verifier for consistency)
            tokens = await GitHubOAuth.exchange_code(data.code, code_verifier)
            access_token = tokens["access_token"]
            # Get user info
            oauth_user = await GitHubOAuth.get_user_info(access_token)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown OAuth provider: {provider}")

        # Find or create user
        user = await find_or_create_oauth_user(oauth_user)

        # Generate JWT tokens
        jwt_access = create_access_token(user["id"])
        jwt_refresh = create_refresh_token(user["id"])

        return TokenResponse(
            access_token=jwt_access,
            refresh_token=jwt_refresh,
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    except HTTPException:
        raise
    except Exception as e:
        # Log full error details server-side, return generic message to client
        logger.exception(f"OAuth authentication failed for provider {provider}")
        raise HTTPException(status_code=400, detail="OAuth authentication failed. Please try again.")


@app.post("/api/auth/refresh", response_model=TokenResponse)
async def refresh_tokens(data: RefreshTokenRequest, request: Request):
    """Refresh access token using refresh token.

    Rate limited to 30 requests/minute per IP.
    """
    # Rate limit by client IP
    await api_rate_limiter.check(get_client_ip(request))

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
        name=user.get("name"),
        avatar_url=user.get("avatar_url"),
        oauth_provider=user.get("oauth_provider"),
        created_at=user["created_at"]
    )


@app.delete("/api/auth/account")
async def delete_account(
    request: Request,
    user_id: UUID = Depends(get_current_user)
):
    """Delete user account and all associated data.

    This action is irreversible. Deletes:
    - All conversations and messages
    - All transactions
    - API keys
    - User account
    """
    # Rate limit by both user and IP to prevent abuse
    await checkout_rate_limiter.check(str(user_id))
    await checkout_rate_limiter.check(f"ip:{get_client_ip(request)}")

    deleted, openrouter_key_hash = await storage.delete_user_account(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")

    # Clean up OpenRouter provisioned key if exists
    if openrouter_key_hash and openrouter_provisioning.is_provisioning_configured():
        try:
            await openrouter_provisioning.delete_key(openrouter_key_hash)
        except Exception as e:
            # Log but don't fail - account is already deleted
            logger.warning(f"Failed to delete OpenRouter key {openrouter_key_hash}: {e}")

    return {"status": "ok", "message": "Account deleted successfully"}


@app.get("/api/auth/export")
async def export_data(
    request: Request,
    user_id: UUID = Depends(get_current_user)
):
    """Export all user data as a ZIP file containing JSON and Markdown.

    Returns a ZIP archive with:
    - data.json: Complete data export in JSON format
    - conversations/: Markdown files for each conversation (human-readable)
    """
    # Rate limit by both user and IP to prevent abuse
    await checkout_rate_limiter.check(str(user_id))
    await checkout_rate_limiter.check(f"ip:{get_client_ip(request)}")

    data = await storage.export_user_data(user_id)
    if not data:
        raise HTTPException(status_code=404, detail="User not found")

    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add JSON export
        json_content = json.dumps(data, indent=2, ensure_ascii=False)
        zf.writestr("data.json", json_content)

        # Add Markdown files for each conversation
        for i, conv in enumerate(data.get("conversations", [])):
            title = conv.get("title") or f"Conversation {i+1}"
            # Sanitize title for filename
            safe_title = "".join(c if c.isalnum() or c in " -_" else "_" for c in title)[:50]
            created = conv.get("created_at", "")[:10] if conv.get("created_at") else ""
            filename = f"conversations/{created}_{safe_title}.md"

            # Generate Markdown content
            md_lines = [
                f"# {title}",
                "",
                f"**Date:** {conv.get('created_at', 'Unknown')}",
                f"**Models:** {', '.join(conv.get('models', []))}",
                f"**Lead Model:** {conv.get('lead_model', 'Unknown')}",
                "",
                "---",
                "",
            ]

            for msg in conv.get("messages", []):
                if msg["role"] == "user":
                    md_lines.append(f"## Question")
                    md_lines.append("")
                    md_lines.append(msg.get("content", ""))
                    md_lines.append("")
                elif msg["role"] == "assistant":
                    # Stage 3 - Final Answer
                    stage3 = msg.get("stage3")
                    if stage3:
                        md_lines.append("## Final Answer")
                        md_lines.append("")
                        md_lines.append(f"*Synthesized by {stage3.get('model', 'Unknown')}*")
                        md_lines.append("")
                        md_lines.append(stage3.get("response", ""))
                        md_lines.append("")

                    # Stage 1 - Expert Opinions
                    stage1 = msg.get("stage1", [])
                    if stage1:
                        md_lines.append("---")
                        md_lines.append("")
                        md_lines.append("### Expert Opinions")
                        md_lines.append("")
                        for opinion in stage1:
                            md_lines.append(f"#### {opinion.get('model', 'Unknown')}")
                            md_lines.append("")
                            md_lines.append(opinion.get("response", ""))
                            md_lines.append("")

                    # Stage 2 - Peer Review
                    stage2 = msg.get("stage2", [])
                    if stage2:
                        md_lines.append("---")
                        md_lines.append("")
                        md_lines.append("### Peer Review Rankings")
                        md_lines.append("")
                        for review in stage2:
                            md_lines.append(f"#### {review.get('model', 'Unknown')}")
                            md_lines.append("")
                            md_lines.append(review.get("ranking", ""))
                            md_lines.append("")

                md_lines.append("---")
                md_lines.append("")

            zf.writestr(filename, "\n".join(md_lines))

        # Add account summary markdown
        account = data.get("account", {})
        account_md = [
            "# Account Summary",
            "",
            f"**Email:** {account.get('email', 'Unknown')}",
            f"**Name:** {account.get('name', 'Unknown')}",
            f"**Provider:** {account.get('oauth_provider', 'Unknown')}",
            f"**Member Since:** {account.get('created_at', 'Unknown')}",
            "",
            "## Balance",
            "",
            f"- Current Balance: ${account.get('balance', 0):.2f}",
            f"- Total Deposited: ${account.get('total_deposited', 0):.2f}",
            f"- Total Spent: ${account.get('total_spent', 0):.2f}",
            "",
            f"## Statistics",
            "",
            f"- Total Conversations: {len(data.get('conversations', []))}",
            f"- Total Transactions: {len(data.get('transactions', []))}",
            f"- Total Queries: {len(data.get('usage_history', []))}",
            "",
        ]

        # Add usage history section if there's data
        usage_history = data.get("usage_history", [])
        if usage_history:
            account_md.append("## Recent Usage History")
            account_md.append("")
            account_md.append("| Date | Cost | Models |")
            account_md.append("|------|------|--------|")
            for usage in usage_history[:20]:  # Show last 20 entries
                date = usage.get("created_at", "")[:10] if usage.get("created_at") else "Unknown"
                cost = usage.get("total_cost", 0)
                models = usage.get("model_breakdown", {})
                model_list = ", ".join(models.keys()) if models else "N/A"
                account_md.append(f"| {date} | ${cost:.4f} | {model_list} |")
            account_md.append("")

        account_md.append(f"*Exported on {data.get('export_date', 'Unknown')}*")
        zf.writestr("account_summary.md", "\n".join(account_md))

    zip_buffer.seek(0)

    # Generate filename with date
    export_date = datetime.now().strftime("%Y-%m-%d")
    filename = f"ai-council-export-{export_date}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============== API Key Settings Endpoints ==============

@app.post("/api/settings/api-key", response_model=ApiKeyResponse)
async def save_api_key(data: ApiKeyCreate, user_id: UUID = Depends(get_current_user)):
    """Save or update user's API key.

    Rate limited to 30 requests/minute per user.
    """
    await api_rate_limiter.check(str(user_id))

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
    """List user's API keys (metadata only).

    Rate limited to 30 requests/minute per user.
    """
    await api_rate_limiter.check(str(user_id))
    return await storage.get_user_api_keys(user_id)


@app.delete("/api/settings/api-key/{provider}")
async def delete_api_key(provider: str, user_id: UUID = Depends(get_current_user)):
    """Delete user's API key.

    Rate limited to 30 requests/minute per user.
    """
    await api_rate_limiter.check(str(user_id))

    deleted = await storage.delete_user_api_key(user_id, provider)
    if not deleted:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"status": "deleted"}


# ============== BYOK (Bring Your Own Key) Endpoints ==============

@app.get("/api/settings/api-mode", response_model=ApiModeResponse)
async def get_api_mode(user_id: UUID = Depends(get_current_user)):
    """Get user's current API mode (BYOK or credits).

    Returns mode, key preview if BYOK is set, and current balance.
    """
    await api_rate_limiter.check(str(user_id))
    mode_info = await storage.get_user_api_mode(user_id)
    return ApiModeResponse(**mode_info)


@app.post("/api/settings/byok")
async def set_byok_key(data: BYOKKeyCreate, user_id: UUID = Depends(get_current_user)):
    """Set user's BYOK (Bring Your Own Key) OpenRouter API key.

    Validates the key with OpenRouter before saving.
    When set, queries will use this key instead of the provisioned key,
    and no balance checks will be performed.
    """
    await api_rate_limiter.check(str(user_id))

    # Validate the key by making a test request to OpenRouter
    from .openrouter import validate_api_key
    is_valid, error_msg = await validate_api_key(data.api_key)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid OpenRouter API key: {error_msg}"
        )

    # Encrypt and save the key
    encrypted = encrypt_api_key(data.api_key)
    await storage.save_user_byok_key(user_id, encrypted)

    # Return the new mode info
    mode_info = await storage.get_user_api_mode(user_id)
    return {
        "status": "ok",
        "message": "BYOK key saved successfully",
        **mode_info
    }


@app.delete("/api/settings/byok")
async def delete_byok_key(user_id: UUID = Depends(get_current_user)):
    """Delete user's BYOK key and switch back to credits mode.

    After deletion, queries will use the provisioned key and
    balance checks will be enforced.
    """
    await api_rate_limiter.check(str(user_id))

    deleted = await storage.delete_user_byok_key(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="No BYOK key set")

    return {
        "status": "ok",
        "message": "BYOK key deleted, switched to credits mode"
    }


# ============== Credits Endpoints ==============

@app.get("/api/credits", response_model=UserCreditsResponse)
async def get_credits(user_id: UUID = Depends(get_current_user)):
    """Get current user's credit balance (legacy endpoint)."""
    credits = await storage.get_user_credits(user_id)
    return UserCreditsResponse(credits=credits)


# ============== Usage-Based Billing Endpoints ==============

MINIMUM_BALANCE = 0.50  # $0.50 minimum to make a query


@app.get("/api/balance", response_model=UserBalanceResponse)
async def get_balance(user_id: UUID = Depends(get_current_user)):
    """Get current user's dollar balance and billing info."""
    billing_info = await storage.get_user_billing_info(user_id)
    return UserBalanceResponse(**billing_info)


@app.get("/api/deposits/options", response_model=List[DepositOptionResponse])
async def list_deposit_options(user_id: UUID = Depends(get_current_user)):
    """List available deposit options."""
    options = await storage.get_deposit_options()
    return [DepositOptionResponse(**opt) for opt in options]


@app.get("/api/usage/history", response_model=List[UsageHistoryResponse])
async def get_usage_history(user_id: UUID = Depends(get_current_user)):
    """Get user's usage history with cost breakdowns."""
    history = await storage.get_usage_history(user_id)
    return [UsageHistoryResponse(**h) for h in history]


@app.get("/api/credits/packs", response_model=List[CreditPackResponse])
async def list_credit_packs(user_id: UUID = Depends(get_current_user)):
    """List available credit packs for purchase."""
    packs = await storage.get_active_credit_packs()
    return [CreditPackResponse(**pack) for pack in packs]


@app.get("/api/credits/history", response_model=List[CreditTransactionResponse])
async def get_credit_history(user_id: UUID = Depends(get_current_user)):
    """Get user's credit transaction history."""
    transactions = await storage.get_credit_transactions(user_id)
    return [CreditTransactionResponse(**t) for t in transactions]


@app.post("/api/credits/provision-key")
async def provision_openrouter_key(request: Request, user_id: UUID = Depends(get_current_user)):
    """Retry OpenRouter key provisioning for users who have credits but no key.

    MEDIUM: This provides a retry path for users whose initial provisioning failed.
    """
    # Rate limit by both user and IP to prevent multi-account abuse
    await checkout_rate_limiter.check(str(user_id))
    await checkout_rate_limiter.check(f"ip:{get_client_ip(request)}")

    if not openrouter_provisioning.is_provisioning_configured():
        raise HTTPException(status_code=503, detail="Provisioning not configured")

    # Check if user already has a key
    existing_key_hash = await storage.get_user_openrouter_key_hash(user_id)
    if existing_key_hash:
        return {"status": "already_provisioned", "message": "API key already exists"}

    # Check if user has any credits (meaning they've made a purchase)
    credits = await storage.get_user_credits(user_id)
    if credits <= 0:
        raise HTTPException(status_code=400, detail="No credits available. Please purchase credits first.")

    # Get user's allocated limit
    total_limit = await storage.get_openrouter_total_limit(user_id)
    if total_limit <= 0:
        raise HTTPException(status_code=400, detail="No OpenRouter limit allocated. Please contact support.")

    # Get user info for key name
    user = await storage.get_user_by_id(user_id)
    user_email = user["email"] if user else "unknown"

    try:
        key_data = await openrouter_provisioning.create_user_key(
            user_id=str(user_id),
            name=user_email,
            limit_dollars=total_limit
        )
        from .encryption import encrypt_api_key
        encrypted_key = encrypt_api_key(key_data["key"])
        await storage.save_user_openrouter_key(user_id, encrypted_key, key_data["hash"])
        logger.info(f"Provisioned OpenRouter key for user {user_id} via retry endpoint")
        return {"status": "provisioned", "message": "API key created successfully"}
    except Exception as e:
        logger.error(f"Failed to provision key for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Provisioning failed: {str(e)}")


def _validate_redirect_url(url: str) -> bool:
    """Validate that a redirect URL is from an allowed origin.

    MEDIUM: Prevents open-redirect attacks by allowlisting domains.
    """
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url)
        # Check against CORS origins (which are our allowed frontend origins)
        for allowed_origin in CORS_ORIGINS:
            allowed_parsed = urlparse(allowed_origin.strip())
            if parsed.scheme == allowed_parsed.scheme and parsed.netloc == allowed_parsed.netloc:
                return True
        return False
    except Exception:
        return False


@app.post("/api/credits/checkout", response_model=CheckoutSessionResponse)
async def create_checkout(
    request: Request,
    data: CreateCheckoutRequest,
    user_id: UUID = Depends(get_current_user)
):
    """Create Stripe checkout session for credit purchase."""
    # Rate limit by both user and IP to prevent multi-account abuse
    await checkout_rate_limiter.check(str(user_id))
    await checkout_rate_limiter.check(f"ip:{get_client_ip(request)}")

    if not stripe_client.is_stripe_configured():
        raise HTTPException(status_code=503, detail="Payment system not configured")

    # MEDIUM: Validate redirect URLs to prevent open-redirect attacks
    if not _validate_redirect_url(data.success_url):
        raise HTTPException(status_code=400, detail="Invalid success URL")
    if not _validate_redirect_url(data.cancel_url):
        raise HTTPException(status_code=400, detail="Invalid cancel URL")

    # Get credit pack
    pack = await storage.get_credit_pack(data.pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Credit pack not found")

    # Get user info
    user = await storage.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get existing Stripe customer ID if any
    stripe_customer_id = await storage.get_user_stripe_customer_id(user_id)

    # MEDIUM: Handle null openrouter_credit_limit safely
    # OpenRouter API expects dollars, not cents
    openrouter_limit_raw = pack.get("openrouter_credit_limit")
    openrouter_limit_dollars = float(openrouter_limit_raw) if openrouter_limit_raw is not None else 0.0

    # Create checkout session
    result = await stripe_client.create_checkout_session(
        user_id=user_id,
        user_email=user["email"],
        pack_id=data.pack_id,
        pack_name=pack["name"],
        credits=pack["credits"],
        price_cents=pack["price_cents"],
        openrouter_limit_dollars=openrouter_limit_dollars,
        success_url=data.success_url,
        cancel_url=data.cancel_url,
        stripe_customer_id=stripe_customer_id
    )

    return CheckoutSessionResponse(**result)


@app.post("/api/deposits/checkout", response_model=CheckoutSessionResponse)
async def create_deposit_checkout(
    request: Request,
    data: CreateDepositRequest,
    user_id: UUID = Depends(get_current_user)
):
    """Create Stripe checkout session for deposit (usage-based billing)."""
    # Rate limit by both user and IP to prevent multi-account abuse
    await checkout_rate_limiter.check(str(user_id))
    await checkout_rate_limiter.check(f"ip:{get_client_ip(request)}")

    if not stripe_client.is_stripe_configured():
        raise HTTPException(status_code=503, detail="Payment system not configured")

    # Validate redirect URLs
    if not _validate_redirect_url(data.success_url):
        raise HTTPException(status_code=400, detail="Invalid success URL")
    if not _validate_redirect_url(data.cancel_url):
        raise HTTPException(status_code=400, detail="Invalid cancel URL")

    # Get deposit option
    option = await storage.get_deposit_option(data.option_id)
    if not option:
        raise HTTPException(status_code=404, detail="Deposit option not found")

    # Get user info
    user = await storage.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get existing Stripe customer ID if any
    stripe_customer_id = await storage.get_user_stripe_customer_id(user_id)

    # For deposits, the OpenRouter limit equals the deposit amount in dollars
    deposit_dollars = option["amount_cents"] / 100.0

    # Create checkout session - reuse existing function but pass deposit info
    result = await stripe_client.create_checkout_session(
        user_id=user_id,
        user_email=user["email"],
        pack_id=data.option_id,  # Use option_id as pack_id for compatibility
        pack_name=option["name"],
        credits=0,  # No credits in usage-based billing
        price_cents=option["amount_cents"],
        openrouter_limit_dollars=deposit_dollars,
        success_url=data.success_url,
        cancel_url=data.cancel_url,
        stripe_customer_id=stripe_customer_id,
        is_deposit=True  # Flag to indicate usage-based billing
    )

    return CheckoutSessionResponse(**result)


@app.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events for credit purchases."""
    if not stripe_client.is_webhook_configured():
        raise HTTPException(status_code=503, detail="Webhook not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing signature")

    try:
        event = stripe_client.verify_webhook_signature(payload, sig_header)
    except Exception as e:
        logger.warning(f"Invalid Stripe webhook signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle checkout.session.completed event
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]

        # HIGH: Verify payment_status is "paid" before crediting
        # Some payment methods are async and may not be paid yet
        payment_status = session.get("payment_status")
        if payment_status != "paid":
            logger.info(f"Session {session['id']} has payment_status={payment_status}, skipping (not paid yet)")
            return {"status": "ok"}

        await handle_successful_payment(session)

    return {"status": "ok"}


async def handle_successful_payment(session: dict):
    """Process successful payment - handles both credits (legacy) and deposits (usage-based).

    Creates or updates OpenRouter provisioned key for the user.
    Order of operations is critical for atomicity:
    1. Verify session from Stripe API (don't trust webhook metadata alone)
    2. Look up pack/option from our database
    3. Add credits or balance (uses unique constraint for idempotency)
    4. Update/create OpenRouter key (if provisioning configured)
    """
    session_id = session["id"]

    # Verify session details from Stripe API
    try:
        verified_session = stripe_client.get_session_details(session_id)
    except Exception as e:
        logger.error(f"Failed to verify Stripe session {session_id}: {e}")
        raise

    metadata = verified_session.get("metadata", {})
    user_id = UUID(metadata["user_id"])
    pack_id = UUID(metadata["pack_id"])  # Can be pack_id or option_id
    is_deposit = metadata.get("is_deposit", "false").lower() == "true"

    # Validate amount and currency
    actual_amount = verified_session.get("amount_total", 0)
    actual_currency = verified_session.get("currency", "").lower()
    if actual_currency != "usd":
        logger.error(f"Currency mismatch for session {session_id}: expected usd, got {actual_currency}")
        raise ValueError(f"Payment currency mismatch: expected usd, got {actual_currency}")

    # Save Stripe customer ID if new
    customer_id = verified_session.get("customer")
    if customer_id:
        await storage.save_user_stripe_customer_id(user_id, customer_id)

    if is_deposit:
        # Usage-based billing: add to dollar balance
        # Use include_inactive=True to handle in-flight checkouts after migration
        option = await storage.get_deposit_option(pack_id, include_inactive=True)
        if not option:
            logger.error(f"Deposit option {pack_id} not found for session {session_id}")
            raise ValueError(f"Invalid option ID in session metadata: {pack_id}")

        expected_price_cents = option["amount_cents"]
        if actual_amount != expected_price_cents:
            logger.error(f"Amount mismatch for session {session_id}: expected {expected_price_cents}, got {actual_amount}")
            raise ValueError(f"Payment amount mismatch: expected {expected_price_cents}, got {actual_amount}")

        deposit_dollars = Decimal(str(actual_amount)) / 100
        openrouter_limit_dollars = deposit_dollars  # For deposits, limit = amount

        try:
            await storage.add_deposit(
                user_id=user_id,
                amount_dollars=float(deposit_dollars),
                transaction_type="deposit",
                description=f"Deposit ${deposit_dollars:.2f}",
                stripe_session_id=session_id,
                stripe_payment_intent_id=verified_session.get("payment_intent")
            )
            logger.info(f"Added ${deposit_dollars:.2f} deposit for user {user_id} from session {session_id}")
        except asyncpg.UniqueViolationError:
            logger.info(f"Session {session_id} already processed (unique constraint), skipping")
            return
        except Exception as e:
            logger.error(f"Failed to add deposit for session {session_id}: {e}")
            raise
    else:
        # Legacy credit-based billing
        pack = await storage.get_credit_pack(pack_id)
        if not pack:
            logger.error(f"Pack {pack_id} not found for session {session_id}")
            raise ValueError(f"Invalid pack ID in session metadata: {pack_id}")

        credits_amount = pack["credits"]
        expected_price_cents = pack["price_cents"]

        if actual_amount != expected_price_cents:
            logger.error(f"Amount mismatch for session {session_id}: expected {expected_price_cents}, got {actual_amount}")
            raise ValueError(f"Payment amount mismatch: expected {expected_price_cents}, got {actual_amount}")

        openrouter_limit_raw = pack.get("openrouter_credit_limit")
        openrouter_limit_dollars = Decimal(str(openrouter_limit_raw)) if openrouter_limit_raw is not None else Decimal("0")

        try:
            await storage.add_credits(
                user_id=user_id,
                amount=credits_amount,
                transaction_type="purchase",
                description=f"Purchased {credits_amount} credits for ${actual_amount/100:.2f}",
                stripe_session_id=session_id,
                stripe_payment_intent_id=verified_session.get("payment_intent")
            )
            logger.info(f"Added {credits_amount} credits to user {user_id} from session {session_id}")
        except asyncpg.UniqueViolationError:
            logger.info(f"Session {session_id} already processed (unique constraint), skipping")
            return
        except Exception as e:
            logger.error(f"Failed to add credits for session {session_id}: {e}")
            raise

    # Only proceed to OpenRouter provisioning AFTER credits are successfully added
    if not openrouter_provisioning.is_provisioning_configured():
        logger.warning("OpenRouter provisioning not configured, skipping key creation")
        return

    # MEDIUM: Atomically increment our stored limit to avoid race conditions
    # This ensures concurrent purchases don't lose increments
    new_total_limit = await storage.increment_openrouter_limit(user_id, openrouter_limit_dollars)
    logger.info(f"Incremented OpenRouter limit for user {user_id}: +{openrouter_limit_dollars} -> {new_total_limit}")

    # Get user info for OpenRouter key name
    user = await storage.get_user_by_id(user_id)
    user_email = user["email"] if user else "unknown"

    # Handle OpenRouter provisioned key
    existing_key_hash = await storage.get_user_openrouter_key_hash(user_id)

    try:
        if existing_key_hash:
            # User already has a key - set to our authoritative total (idempotent)
            await openrouter_provisioning.update_key_limit(existing_key_hash, new_total_limit)
            logger.info(f"Set OpenRouter key limit for user {user_id} to {new_total_limit}")
        else:
            # Create new provisioned key for user with the total limit
            key_data = await openrouter_provisioning.create_user_key(
                user_id=str(user_id),
                name=user_email,
                limit_dollars=new_total_limit
            )
            # Encrypt and store the key
            from .encryption import encrypt_api_key
            encrypted_key = encrypt_api_key(key_data["key"])
            await storage.save_user_openrouter_key(user_id, encrypted_key, key_data["hash"])
            logger.info(f"Created OpenRouter key for user {user_id} with limit {new_total_limit}")
    except Exception as e:
        # Log error but don't fail - credits are already added
        # User can retry or contact support
        logger.error(f"Failed to provision OpenRouter key for user {user_id}: {e}")


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
    Returns the complete response with all stages and cost breakdown.

    Rate limited to 10 requests/minute per user to control OpenRouter costs.
    Uses usage-based billing: actual OpenRouter cost + 10% margin deducted after query.
    """
    # Rate limit check (council queries are expensive - limit to 10/min)
    await streaming_rate_limiter.check(str(user_id))

    # Check if conversation exists first
    conversation = await storage.get_conversation(conversation_id, user_id=user_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get user's provisioned OpenRouter API key
    api_key = await storage.get_user_openrouter_key(user_id)
    if not api_key:
        raise HTTPException(
            status_code=402,
            detail="No API access configured. Please add funds to get started."
        )

    # Check minimum balance before query (usage-based billing)
    if not await storage.check_minimum_balance(user_id, MINIMUM_BALANCE):
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient balance. Minimum ${MINIMUM_BALANCE:.2f} required to make a query."
        )

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0
    selected_models, selected_lead = validate_model_selection(
        conversation.get("models"),
        conversation.get("lead_model")
    )

    # Add user message
    await storage.add_user_message(conversation_id, request.content)

    try:
        # If this is the first message, generate a title
        title_generation_id = None
        if is_first_message:
            title, title_generation_id = await generate_conversation_title(request.content, api_key=api_key)
            await storage.update_conversation_title(conversation_id, title)

        # Run the 3-stage council process with user's API key
        stage1_results, stage2_results, stage3_result, metadata, generation_ids = await run_full_council(
            request.content,
            models=selected_models,
            lead_model=selected_lead,
            api_key=api_key
        )

        # Include title generation in cost calculation if applicable
        if title_generation_id:
            generation_ids.append(title_generation_id)

        # Add assistant message with all stages
        await storage.add_assistant_message(
            conversation_id,
            stage1_results,
            stage2_results,
            stage3_result
        )

        # Calculate actual costs from OpenRouter
        costs = await get_generation_costs_batch(generation_ids, api_key=api_key)
        total_openrouter_cost = sum(c.get('total_cost', 0) for c in costs.values())

        # Build model breakdown for transparency
        model_breakdown = {}
        for gid, cost_info in costs.items():
            model = cost_info.get('model', 'unknown')
            if model not in model_breakdown:
                model_breakdown[model] = 0.0
            model_breakdown[model] += cost_info.get('total_cost', 0)

        # Deduct costs from balance (includes 10% margin)
        success, new_balance = await storage.deduct_query_cost(
            user_id=user_id,
            conversation_id=conversation_id,
            generation_ids=generation_ids,
            openrouter_cost=total_openrouter_cost,
            model_breakdown=model_breakdown
        )

        # Calculate margin for response
        margin_cost = total_openrouter_cost * 0.10
        total_cost = total_openrouter_cost + margin_cost

        # Return the complete response with metadata and cost
        return {
            "stage1": stage1_results,
            "stage2": stage2_results,
            "stage3": stage3_result,
            "metadata": metadata,
            "cost": {
                "openrouter_cost": round(total_openrouter_cost, 6),
                "margin_cost": round(margin_cost, 6),
                "total_cost": round(total_cost, 6),
                "new_balance": round(new_balance, 6)
            }
        }
    except Exception as e:
        # No refund needed - we didn't charge upfront
        logger.error(f"Council query failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail="AI query failed. No charge was made.")


class ClientDisconnectedError(Exception):
    """Raised when client disconnects during streaming."""
    pass


@app.post("/api/conversations/{conversation_id}/message/stream")
async def send_message_stream(
    conversation_id: str,
    message_request: SendMessageRequest,
    http_request: Request,
    user_id: UUID = Depends(get_current_user)
):
    """
    Send a message and stream the 3-stage council process.
    Returns Server-Sent Events as each stage completes.

    Rate limited to 10 requests/minute per user to control OpenRouter costs.
    Uses usage-based billing: actual OpenRouter cost + 10% margin deducted after query.
    Detects client disconnection and cancels in-flight API calls to save costs.
    """
    # Rate limit check (streaming is expensive - limit to 10/min)
    await streaming_rate_limiter.check(str(user_id))

    # Check if conversation exists first
    conversation = await storage.get_conversation(conversation_id, user_id=user_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get effective API key (BYOK first, then provisioned)
    api_key, api_mode = await storage.get_effective_api_key(user_id)
    if not api_key:
        raise HTTPException(
            status_code=402,
            detail="No API access configured. Please add funds or set your own API key."
        )

    # For credits mode, check minimum balance before query
    # BYOK mode skips balance check - user pays OpenRouter directly
    if api_mode == "credits":
        if not await storage.check_minimum_balance(user_id, MINIMUM_BALANCE):
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient balance. Minimum ${MINIMUM_BALANCE:.2f} required to make a query."
            )

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0
    selected_models, selected_lead = validate_model_selection(
        conversation.get("models"),
        conversation.get("lead_model")
    )

    async def check_disconnected():
        """Check if client has disconnected and raise if so."""
        if await http_request.is_disconnected():
            raise ClientDisconnectedError("Client disconnected")

    async def event_generator():
        title_task = None
        keepalive_event = ":\n\n"  # Standard SSE comment for keepalive
        all_generation_ids = []  # Collect generation IDs for cost calculation

        async def run_with_keepalive(coro, interval=15):
            """Run a coroutine while yielding keepalive pings every interval seconds."""
            task = asyncio.create_task(coro)
            pings = []
            while not task.done():
                try:
                    # Wait for task with timeout
                    await asyncio.wait_for(asyncio.shield(task), timeout=interval)
                except asyncio.TimeoutError:
                    # Task still running, queue a keepalive ping
                    pings.append(keepalive_event)
            return task.result(), pings

        try:
            # Add user message
            await storage.add_user_message(conversation_id, message_request.content)

            # Start title generation in parallel (don't await yet)
            if is_first_message:
                title_task = asyncio.create_task(
                    generate_conversation_title(message_request.content, api_key=api_key)
                )

            # Stage 1: Collect responses
            await check_disconnected()
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            (stage1_results, stage1_ids), pings = await run_with_keepalive(
                stage1_collect_responses(
                    message_request.content,
                    models=selected_models,
                    api_key=api_key
                )
            )
            all_generation_ids.extend(stage1_ids)
            for ping in pings:
                yield ping
            yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            # Stage 2: Collect rankings
            await check_disconnected()
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            (stage2_results, label_to_model, stage2_ids), pings = await run_with_keepalive(
                stage2_collect_rankings(
                    message_request.content,
                    stage1_results,
                    models=selected_models,
                    api_key=api_key
                )
            )
            all_generation_ids.extend(stage2_ids)
            for ping in pings:
                yield ping
            aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
            yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"

            # Stage 3: Synthesize final answer
            await check_disconnected()
            yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
            (stage3_result, stage3_id), pings = await run_with_keepalive(
                stage3_synthesize_final(
                    message_request.content,
                    stage1_results,
                    stage2_results,
                    lead_model=selected_lead,
                    api_key=api_key
                )
            )
            if stage3_id:
                all_generation_ids.append(stage3_id)
            for ping in pings:
                yield ping
            yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Wait for title generation if it was started
            if title_task:
                title, title_generation_id = await title_task
                if title_generation_id:
                    all_generation_ids.append(title_generation_id)
                await storage.update_conversation_title(conversation_id, title)
                yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

            # Save complete assistant message
            await storage.add_assistant_message(
                conversation_id,
                stage1_results,
                stage2_results,
                stage3_result
            )

            # Calculate and deduct costs (only for credits mode)
            if api_mode == "credits":
                # Calculate actual costs from OpenRouter
                costs = await get_generation_costs_batch(all_generation_ids, api_key=api_key)
                total_openrouter_cost = sum(c.get('total_cost', 0) for c in costs.values())

                # Build model breakdown for transparency
                model_breakdown = {}
                for gid, cost_info in costs.items():
                    model = cost_info.get('model', 'unknown')
                    if model not in model_breakdown:
                        model_breakdown[model] = 0.0
                    model_breakdown[model] += cost_info.get('total_cost', 0)

                # Deduct costs from balance (includes 10% margin)
                success, new_balance = await storage.deduct_query_cost(
                    user_id=user_id,
                    conversation_id=conversation_id,
                    generation_ids=all_generation_ids,
                    openrouter_cost=total_openrouter_cost,
                    model_breakdown=model_breakdown
                )

                # Calculate margin for response
                margin_cost = total_openrouter_cost * 0.10
                total_cost = total_openrouter_cost + margin_cost

                # Send completion event with cost breakdown
                yield f"data: {json.dumps({'type': 'complete', 'cost': {'openrouter_cost': round(total_openrouter_cost, 6), 'margin_cost': round(margin_cost, 6), 'total_cost': round(total_cost, 6), 'new_balance': round(new_balance, 6)}})}\n\n"
            else:
                # BYOK mode - no cost tracking, user pays OpenRouter directly
                yield f"data: {json.dumps({'type': 'complete', 'mode': 'byok'})}\n\n"

        except ClientDisconnectedError:
            # Client disconnected - cancel any running tasks and stop
            # No charge since we didn't complete the query
            if title_task and not title_task.done():
                title_task.cancel()
            logger.info(f"Client disconnected for user {user_id} - no charge")
            return

        except Exception as e:
            # No refund needed - we didn't charge upfront
            logger.error(f"Streaming query failed for user {user_id}: {e}")
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': 'AI query failed. No charge was made.'})}\n\n"

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
