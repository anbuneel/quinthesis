"""OAuth authentication handlers for Google and GitHub."""

import httpx
from typing import Optional, Dict, Any
from dataclasses import dataclass
from urllib.parse import urlencode

from .config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    OAUTH_REDIRECT_BASE,
)


@dataclass
class OAuthUser:
    """Normalized user data from OAuth providers."""
    provider: str
    provider_id: str
    email: str
    name: Optional[str]
    avatar_url: Optional[str]


class GoogleOAuth:
    """Google OAuth2 handler."""
    AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

    @staticmethod
    def get_authorization_url(state: str, code_challenge: str) -> str:
        """Generate Google OAuth authorization URL with PKCE.

        Args:
            state: CSRF protection token
            code_challenge: PKCE code challenge (S256)
        """
        redirect_uri = f"{OAUTH_REDIRECT_BASE}/auth/callback/google"
        params = {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "select_account",
            # PKCE parameters
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        return f"{GoogleOAuth.AUTH_URL}?{urlencode(params)}"

    @staticmethod
    async def exchange_code(code: str, code_verifier: str) -> Dict[str, Any]:
        """Exchange authorization code for tokens with PKCE verification.

        Args:
            code: Authorization code from OAuth callback
            code_verifier: PKCE code verifier that matches the challenge
        """
        redirect_uri = f"{OAUTH_REDIRECT_BASE}/auth/callback/google"
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GoogleOAuth.TOKEN_URL,
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code_verifier": code_verifier,
                },
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def get_user_info(access_token: str) -> OAuthUser:
        """Get user info from Google."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                GoogleOAuth.USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()

            return OAuthUser(
                provider="google",
                provider_id=data["id"],
                email=data["email"],
                name=data.get("name"),
                avatar_url=data.get("picture"),
            )


class GitHubOAuth:
    """GitHub OAuth2 handler."""
    AUTH_URL = "https://github.com/login/oauth/authorize"
    TOKEN_URL = "https://github.com/login/oauth/access_token"
    USERINFO_URL = "https://api.github.com/user"
    EMAILS_URL = "https://api.github.com/user/emails"

    @staticmethod
    def get_authorization_url(state: str, code_challenge: str) -> str:
        """Generate GitHub OAuth authorization URL.

        Note: GitHub does not support PKCE, but we include the state parameter
        for CSRF protection. The code_challenge is accepted but not used.

        Args:
            state: CSRF protection token
            code_challenge: PKCE code challenge (not used by GitHub)
        """
        redirect_uri = f"{OAUTH_REDIRECT_BASE}/auth/callback/github"
        params = {
            "client_id": GITHUB_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "scope": "user:email",
            "state": state,
        }
        return f"{GitHubOAuth.AUTH_URL}?{urlencode(params)}"

    @staticmethod
    async def exchange_code(code: str, code_verifier: str) -> Dict[str, Any]:
        """Exchange authorization code for tokens.

        Note: GitHub does not support PKCE verification, so code_verifier
        is accepted for API consistency but not sent to GitHub.

        Args:
            code: Authorization code from OAuth callback
            code_verifier: PKCE code verifier (not used by GitHub)
        """
        redirect_uri = f"{OAUTH_REDIRECT_BASE}/auth/callback/github"
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GitHubOAuth.TOKEN_URL,
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def get_user_info(access_token: str) -> OAuthUser:
        """Get user info from GitHub."""
        async with httpx.AsyncClient() as client:
            # Get user profile
            response = await client.get(
                GitHubOAuth.USERINFO_URL,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            response.raise_for_status()
            data = response.json()

            # Get primary email if not public
            email = data.get("email")
            if not email:
                emails_response = await client.get(
                    GitHubOAuth.EMAILS_URL,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/vnd.github.v3+json",
                    },
                )
                emails_response.raise_for_status()
                emails = emails_response.json()
                # Find primary verified email
                for e in emails:
                    if e.get("primary") and e.get("verified"):
                        email = e["email"]
                        break

            return OAuthUser(
                provider="github",
                provider_id=str(data["id"]),
                email=email,
                name=data.get("name") or data.get("login"),
                avatar_url=data.get("avatar_url"),
            )
