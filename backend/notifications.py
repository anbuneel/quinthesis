"""Email notifications via Resend.

Sends notifications to the admin for key events like signups and deposits.
"""

import logging
from typing import Optional
import httpx

from .config import RESEND_API_KEY, NOTIFICATION_EMAIL

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def is_configured() -> bool:
    """Check if notifications are configured."""
    return bool(RESEND_API_KEY and NOTIFICATION_EMAIL)


async def send_email(
    subject: str,
    html_body: str,
    text_body: Optional[str] = None
) -> bool:
    """Send an email notification.

    Returns True if sent successfully, False otherwise.
    """
    if not is_configured():
        logger.debug("Notifications not configured, skipping email")
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "Quinthesis <onboarding@resend.dev>",
                    "to": [NOTIFICATION_EMAIL],
                    "subject": subject,
                    "html": html_body,
                    "text": text_body or html_body,
                },
            )

            if response.status_code == 200:
                logger.info(f"Notification sent: {subject}")
                return True
            else:
                logger.warning(f"Failed to send notification: {response.status_code} - {response.text}")
                return False

    except Exception as e:
        logger.error(f"Error sending notification: {e}")
        return False


async def notify_new_signup(
    email: str,
    provider: str,
    user_id: str
) -> bool:
    """Notify admin of a new user signup."""
    logger.info(f"Sending signup notification for {email}")
    subject = f"New Quinthesis signup: {email}"

    html_body = f"""
    <h2>New User Signup</h2>
    <p><strong>Email:</strong> {email}</p>
    <p><strong>Provider:</strong> {provider.title()}</p>
    <p><strong>User ID:</strong> <code>{user_id}</code></p>
    <hr>
    <p style="color: #666; font-size: 12px;">
        <a href="https://quinthesis.vercel.app">Quinthesis</a>
    </p>
    """

    text_body = f"""
New User Signup
===============
Email: {email}
Provider: {provider}
User ID: {user_id}
    """

    return await send_email(subject, html_body, text_body)


async def notify_deposit(
    email: str,
    amount_dollars: float,
    new_balance: float
) -> bool:
    """Notify admin of a new deposit."""
    subject = f"Deposit received: ${amount_dollars:.2f} from {email}"

    html_body = f"""
    <h2>Deposit Received</h2>
    <p><strong>User:</strong> {email}</p>
    <p><strong>Amount:</strong> ${amount_dollars:.2f}</p>
    <p><strong>New Balance:</strong> ${new_balance:.2f}</p>
    <hr>
    <p style="color: #666; font-size: 12px;">
        <a href="https://quinthesis.vercel.app">Quinthesis</a>
    </p>
    """

    text_body = f"""
Deposit Received
================
User: {email}
Amount: ${amount_dollars:.2f}
New Balance: ${new_balance:.2f}
    """

    return await send_email(subject, html_body, text_body)
