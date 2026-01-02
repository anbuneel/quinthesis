"""Stripe integration for credit purchases.

Handles Stripe Checkout session creation and webhook verification
for the credit pack purchase flow.
"""

import logging
from typing import Optional
from uuid import UUID

import stripe

from .config import STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

logger = logging.getLogger(__name__)

# Initialize Stripe with secret key
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


def is_stripe_configured() -> bool:
    """Check if Stripe is configured."""
    return bool(STRIPE_SECRET_KEY)


def is_webhook_configured() -> bool:
    """Check if Stripe webhook verification is configured."""
    return bool(STRIPE_WEBHOOK_SECRET)


async def create_checkout_session(
    user_id: UUID,
    user_email: str,
    pack_id: UUID,
    pack_name: str,
    credits: int,
    price_cents: int,
    openrouter_limit_dollars: float,
    success_url: str,
    cancel_url: str,
    stripe_customer_id: Optional[str] = None,
    is_deposit: bool = False,
) -> dict:
    """Create a Stripe Checkout session for credit or deposit purchase.

    Args:
        user_id: The user's ID
        user_email: User's email for Stripe customer
        pack_id: The credit pack ID (or deposit option ID)
        pack_name: Display name for the pack
        credits: Number of credits in the pack (0 for deposits)
        price_cents: Price in cents
        openrouter_limit_dollars: OpenRouter credit limit to add (in dollars)
        success_url: URL to redirect on success
        cancel_url: URL to redirect on cancel
        stripe_customer_id: Existing Stripe customer ID (optional)
        is_deposit: True for usage-based billing deposits, False for legacy credits

    Returns:
        dict with "checkout_url" and "session_id"

    Raises:
        stripe.error.StripeError: If Stripe API call fails
    """
    if not is_stripe_configured():
        raise RuntimeError("Stripe is not configured")

    # For deposits, describe as dollar amount; for credits, describe as queries
    if is_deposit:
        deposit_dollars = price_cents / 100.0
        description = f"${deposit_dollars:.2f} balance for AI Council usage"
    else:
        description = f"{credits} AI Council queries"

    session_params = {
        "payment_method_types": ["card"],
        "mode": "payment",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": str(user_id),
        "metadata": {
            "user_id": str(user_id),
            "pack_id": str(pack_id),
            "credits": str(credits),
            "openrouter_limit_dollars": str(openrouter_limit_dollars),
            "is_deposit": str(is_deposit).lower(),
        },
        "line_items": [
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": price_cents,
                    "product_data": {
                        "name": pack_name,
                        "description": description,
                    },
                },
                "quantity": 1,
            }
        ],
    }

    # Use existing customer or create new one
    if stripe_customer_id:
        session_params["customer"] = stripe_customer_id
    else:
        session_params["customer_email"] = user_email

    session = stripe.checkout.Session.create(**session_params)

    logger.info(f"Created Stripe checkout session {session.id} for user {user_id}")

    return {
        "checkout_url": session.url,
        "session_id": session.id,
    }


def verify_webhook_signature(payload: bytes, sig_header: str) -> dict:
    """Verify Stripe webhook signature and return the event.

    Args:
        payload: Raw request body bytes
        sig_header: Value of the 'stripe-signature' header

    Returns:
        The verified Stripe event object

    Raises:
        stripe.error.SignatureVerificationError: If signature is invalid
        ValueError: If webhook secret is not configured
    """
    if not is_webhook_configured():
        raise ValueError("Stripe webhook secret not configured")

    event = stripe.Webhook.construct_event(
        payload, sig_header, STRIPE_WEBHOOK_SECRET
    )

    return event


def get_session_details(session_id: str) -> dict:
    """Retrieve Stripe Checkout session details.

    Args:
        session_id: The checkout session ID

    Returns:
        Session object from Stripe

    Raises:
        stripe.error.StripeError: If retrieval fails
    """
    if not is_stripe_configured():
        raise RuntimeError("Stripe is not configured")

    return stripe.checkout.Session.retrieve(session_id)


def get_or_create_customer(email: str, name: Optional[str] = None) -> str:
    """Get existing Stripe customer or create a new one.

    Args:
        email: Customer email
        name: Customer name (optional)

    Returns:
        Stripe customer ID

    Raises:
        stripe.error.StripeError: If API call fails
    """
    if not is_stripe_configured():
        raise RuntimeError("Stripe is not configured")

    # Search for existing customer by email
    customers = stripe.Customer.search(query=f"email:'{email}'")

    if customers.data:
        return customers.data[0].id

    # Create new customer
    customer_data = {"email": email}
    if name:
        customer_data["name"] = name

    customer = stripe.Customer.create(**customer_data)
    logger.info(f"Created Stripe customer {customer.id} for {email}")

    return customer.id
