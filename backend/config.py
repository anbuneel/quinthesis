"""Configuration for Quinthesis."""

import os
import logging
from dotenv import load_dotenv

load_dotenv()

# Production detection - Fly.io sets FLY_APP_NAME, can also check DATABASE_URL
IS_PRODUCTION = os.getenv("FLY_APP_NAME") is not None or os.getenv("PRODUCTION") == "true"

# OpenRouter API key (fallback for local dev, users provide their own in production)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Database configuration (Supabase PostgreSQL)
DATABASE_URL = os.getenv("DATABASE_URL")

# JWT Authentication
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")

# API Key Encryption (required for production)
# Supports comma-separated list for key rotation (newest key first)
# Example: "new-key,old-key,older-key"
_raw_encryption_keys = os.getenv("API_KEY_ENCRYPTION_KEY", "")
API_KEY_ENCRYPTION_KEYS: list[str] = [
    k.strip() for k in _raw_encryption_keys.split(",") if k.strip()
]
# Optional explicit version to keep rotation monotonic across removals
_raw_key_version = os.getenv("API_KEY_ENCRYPTION_KEY_VERSION", "").strip()
API_KEY_ENCRYPTION_KEY_VERSION = int(_raw_key_version) if _raw_key_version else None
# Backwards compatibility: single key access
API_KEY_ENCRYPTION_KEY = API_KEY_ENCRYPTION_KEYS[0] if API_KEY_ENCRYPTION_KEYS else None

# OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
OAUTH_REDIRECT_BASE = os.getenv("OAUTH_REDIRECT_BASE", "http://localhost:5173")

# Stripe Configuration (for credit purchases)
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# OpenRouter Provisioning API key (for creating per-user API keys)
OPENROUTER_PROVISIONING_KEY = os.getenv("OPENROUTER_PROVISIONING_KEY")

# Sentry Configuration (for error tracking and monitoring)
SENTRY_DSN = os.getenv("SENTRY_DSN")

# CORS origins (comma-separated list)
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

# Available models - list of OpenRouter model identifiers
AVAILABLE_MODELS = [
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
]

# Default models used for new conversations
DEFAULT_MODELS = list(AVAILABLE_MODELS)

# Lead model - synthesizes final response
DEFAULT_LEAD_MODEL = "google/gemini-3-pro-preview"

# OpenRouter API endpoint
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"


def validate_secrets() -> None:
    """Validate that required secrets are configured.

    In production, this function ensures all security-critical environment
    variables are properly set. Raises RuntimeError if validation fails,
    causing the application to fail fast at startup.

    In development (IS_PRODUCTION=False), only warnings are logged.
    """
    logger = logging.getLogger(__name__)
    errors: list[str] = []
    warnings: list[str] = []

    # JWT secret validation
    if JWT_SECRET == "change-me-in-production":
        if IS_PRODUCTION:
            errors.append("JWT_SECRET must be set to a secure value in production")
        else:
            warnings.append("JWT_SECRET is using default value (ok for local dev)")

    # API key encryption validation
    if not API_KEY_ENCRYPTION_KEY:
        if IS_PRODUCTION:
            errors.append(
                "API_KEY_ENCRYPTION_KEY must be set in production. "
                "Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        else:
            warnings.append("API_KEY_ENCRYPTION_KEY not set (API key storage disabled)")
    if API_KEY_ENCRYPTION_KEY_VERSION is not None and API_KEY_ENCRYPTION_KEY_VERSION < 1:
        errors.append("API_KEY_ENCRYPTION_KEY_VERSION must be >= 1")

    # OAuth credentials validation
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        if IS_PRODUCTION:
            errors.append("Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) must be set in production")
        else:
            warnings.append("Google OAuth credentials not set (Google login disabled)")

    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        if IS_PRODUCTION:
            errors.append("GitHub OAuth credentials (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET) must be set in production")
        else:
            warnings.append("GitHub OAuth credentials not set (GitHub login disabled)")

    # Database validation (required for production)
    if not DATABASE_URL:
        if IS_PRODUCTION:
            errors.append("DATABASE_URL must be set in production")
        # In dev, we fall back to local JSON storage - no warning needed

    # Stripe validation (required for credit purchases)
    if not STRIPE_SECRET_KEY:
        if IS_PRODUCTION:
            errors.append("STRIPE_SECRET_KEY must be set in production for credit purchases")
        else:
            warnings.append("STRIPE_SECRET_KEY not set (credit purchases disabled)")

    if not STRIPE_WEBHOOK_SECRET:
        if IS_PRODUCTION:
            errors.append("STRIPE_WEBHOOK_SECRET must be set in production for payment webhooks")
        else:
            warnings.append("STRIPE_WEBHOOK_SECRET not set (Stripe webhooks disabled)")

    # OpenRouter provisioning validation
    if not OPENROUTER_PROVISIONING_KEY:
        if IS_PRODUCTION:
            errors.append("OPENROUTER_PROVISIONING_KEY must be set in production for per-user API keys")
        else:
            warnings.append("OPENROUTER_PROVISIONING_KEY not set (per-user API key provisioning disabled)")

    # Log warnings
    for warning in warnings:
        logger.warning(warning)

    # Fail fast on errors
    if errors:
        error_msg = "Configuration errors detected:\n" + "\n".join(f"  - {e}" for e in errors)
        logger.error(error_msg)
        raise RuntimeError(error_msg)
