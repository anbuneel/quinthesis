"""Pydantic models for multi-user authentication with OAuth."""

from pydantic import BaseModel, field_validator
from datetime import datetime
from uuid import UUID
from typing import Optional


# ============== Request Schemas ==============

class OAuthCallbackRequest(BaseModel):
    """Request to complete OAuth flow."""
    code: str
    state: str  # Required for CSRF protection


class RefreshTokenRequest(BaseModel):
    """Request to refresh access token."""
    refresh_token: str


class ApiKeyCreate(BaseModel):
    """Request to save an API key."""
    api_key: str
    provider: str = "openrouter"

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        if not v or len(v.strip()) < 10:
            raise ValueError("Invalid API key")
        return v.strip()


# ============== Response Schemas ==============

class UserResponse(BaseModel):
    """User information response."""
    id: UUID
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    oauth_provider: Optional[str] = None
    created_at: datetime


class ApiKeyResponse(BaseModel):
    """API key information response (without the actual key)."""
    id: UUID
    provider: str
    key_hint: str  # "...abc123"
    created_at: datetime


class TokenResponse(BaseModel):
    """Authentication token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str


class StatusResponse(BaseModel):
    """Generic status response."""
    status: str


# ============== Credits Schemas ==============

class CreditPackResponse(BaseModel):
    """Credit pack information."""
    id: UUID
    name: str
    credits: int
    price_cents: int
    openrouter_credit_limit: Optional[float] = None


class UserCreditsResponse(BaseModel):
    """User's credit balance."""
    credits: int


class CreditTransactionResponse(BaseModel):
    """Credit transaction history item."""
    id: UUID
    amount: int
    balance_after: int
    transaction_type: str
    description: Optional[str] = None
    created_at: datetime


class CreateCheckoutRequest(BaseModel):
    """Request to create Stripe checkout session."""
    pack_id: UUID
    success_url: str
    cancel_url: str


class CheckoutSessionResponse(BaseModel):
    """Stripe checkout session response."""
    checkout_url: str
    session_id: str


# ============== Usage-Based Billing Schemas ==============

class DepositOptionResponse(BaseModel):
    """Deposit option for usage-based billing."""
    id: UUID
    name: str
    amount_cents: int


class UserBalanceResponse(BaseModel):
    """User's dollar balance and billing info."""
    balance: float
    total_deposited: float
    total_spent: float
    has_openrouter_key: bool


class UsageHistoryResponse(BaseModel):
    """Query cost history item."""
    id: UUID
    conversation_id: str
    openrouter_cost: float
    margin_cost: float
    total_cost: float
    model_breakdown: Optional[dict] = None
    created_at: datetime


class CreateDepositRequest(BaseModel):
    """Request to create Stripe checkout for a deposit."""
    option_id: UUID
    success_url: str
    cancel_url: str


class QueryCostResponse(BaseModel):
    """Cost breakdown for a query."""
    openrouter_cost: float
    margin_cost: float
    total_cost: float
    new_balance: float
