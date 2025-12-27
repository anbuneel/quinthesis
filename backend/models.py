"""Pydantic models for Phase 1 multi-user authentication."""

from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from uuid import UUID
from typing import Optional


# ============== Request Schemas ==============

class UserRegister(BaseModel):
    """Request to register a new user."""
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    """Request to login."""
    email: EmailStr
    password: str


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
