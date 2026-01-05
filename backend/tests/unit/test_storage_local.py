"""
Unit tests for backend.storage_local module.

Tests local JSON-based storage with isolated temp directories.
"""
import pytest
from uuid import uuid4
from pathlib import Path


class TestConversations:
    """Tests for conversation CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_conversation(self, isolated_storage):
        """Create a conversation and verify structure."""
        conv_id = str(uuid4())
        result = await isolated_storage.create_conversation(conv_id)

        assert result["id"] == conv_id
        assert result["title"] == "New Conversation"
        assert result["messages"] == []
        assert "created_at" in result
        assert "models" in result
        assert "lead_model" in result

    @pytest.mark.asyncio
    async def test_create_conversation_with_models(self, isolated_storage):
        """Create conversation with custom model selection."""
        conv_id = str(uuid4())
        models = ["openai/gpt-4", "anthropic/claude-3"]
        lead = "openai/gpt-4"

        result = await isolated_storage.create_conversation(
            conv_id, models=models, lead_model=lead
        )

        assert result["models"] == models
        assert result["lead_model"] == lead

    @pytest.mark.asyncio
    async def test_create_conversation_with_user(self, isolated_storage):
        """Create conversation with user_id."""
        conv_id = str(uuid4())
        user_id = uuid4()

        result = await isolated_storage.create_conversation(conv_id, user_id=user_id)

        assert result["user_id"] == str(user_id)

    @pytest.mark.asyncio
    async def test_get_conversation(self, isolated_storage):
        """Get existing conversation."""
        conv_id = str(uuid4())
        await isolated_storage.create_conversation(conv_id)

        result = await isolated_storage.get_conversation(conv_id)

        assert result is not None
        assert result["id"] == conv_id

    @pytest.mark.asyncio
    async def test_get_conversation_not_found(self, isolated_storage):
        """Get non-existent conversation returns None."""
        result = await isolated_storage.get_conversation("nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_conversation_user_filter(self, isolated_storage):
        """Get conversation filtered by user_id."""
        conv_id = str(uuid4())
        user_id = uuid4()
        other_user = uuid4()

        await isolated_storage.create_conversation(conv_id, user_id=user_id)

        # Owner can access
        result = await isolated_storage.get_conversation(conv_id, user_id=user_id)
        assert result is not None

        # Other user cannot access
        result = await isolated_storage.get_conversation(conv_id, user_id=other_user)
        assert result is None

    @pytest.mark.asyncio
    async def test_list_conversations(self, isolated_storage):
        """List all conversations."""
        # Create a few conversations
        ids = [str(uuid4()) for _ in range(3)]
        for conv_id in ids:
            await isolated_storage.create_conversation(conv_id)

        result = await isolated_storage.list_conversations()

        assert len(result) == 3
        result_ids = [c["id"] for c in result]
        for conv_id in ids:
            assert conv_id in result_ids

    @pytest.mark.asyncio
    async def test_list_conversations_user_filter(self, isolated_storage):
        """List conversations filtered by user_id."""
        user_id = uuid4()
        other_user = uuid4()

        # Create 2 for user, 1 for other
        await isolated_storage.create_conversation(str(uuid4()), user_id=user_id)
        await isolated_storage.create_conversation(str(uuid4()), user_id=user_id)
        await isolated_storage.create_conversation(str(uuid4()), user_id=other_user)

        # User sees only their 2
        result = await isolated_storage.list_conversations(user_id=user_id)
        assert len(result) == 2

        # Other user sees only their 1
        result = await isolated_storage.list_conversations(user_id=other_user)
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_add_user_message(self, isolated_storage):
        """Add user message to conversation."""
        conv_id = str(uuid4())
        await isolated_storage.create_conversation(conv_id)

        message_order = await isolated_storage.add_user_message(conv_id, "Hello!")

        assert message_order == 0

        conv = await isolated_storage.get_conversation(conv_id)
        assert len(conv["messages"]) == 1
        assert conv["messages"][0]["role"] == "user"
        assert conv["messages"][0]["content"] == "Hello!"

    @pytest.mark.asyncio
    async def test_add_assistant_message(self, isolated_storage):
        """Add assistant message with all stages."""
        conv_id = str(uuid4())
        await isolated_storage.create_conversation(conv_id)

        stage1 = [{"model": "gpt-4", "response": "Response 1"}]
        stage2 = [{"model": "claude", "ranking": "1. A\n2. B"}]
        stage3 = {"content": "Final synthesis"}

        await isolated_storage.add_assistant_message(conv_id, stage1, stage2, stage3)

        conv = await isolated_storage.get_conversation(conv_id)
        assert len(conv["messages"]) == 1
        assert conv["messages"][0]["role"] == "assistant"
        assert conv["messages"][0]["stage1"] == stage1
        assert conv["messages"][0]["stage2"] == stage2
        assert conv["messages"][0]["stage3"] == stage3

    @pytest.mark.asyncio
    async def test_update_conversation_title(self, isolated_storage):
        """Update conversation title."""
        conv_id = str(uuid4())
        await isolated_storage.create_conversation(conv_id)

        await isolated_storage.update_conversation_title(conv_id, "New Title")

        conv = await isolated_storage.get_conversation(conv_id)
        assert conv["title"] == "New Title"

    @pytest.mark.asyncio
    async def test_delete_conversation(self, isolated_storage):
        """Delete a conversation."""
        conv_id = str(uuid4())
        await isolated_storage.create_conversation(conv_id)

        result = await isolated_storage.delete_conversation(conv_id)

        assert result is True
        assert await isolated_storage.get_conversation(conv_id) is None

    @pytest.mark.asyncio
    async def test_delete_conversation_not_found(self, isolated_storage):
        """Delete non-existent conversation returns False."""
        result = await isolated_storage.delete_conversation("nonexistent")

        assert result is False

    @pytest.mark.asyncio
    async def test_delete_conversation_wrong_user(self, isolated_storage):
        """Cannot delete another user's conversation."""
        conv_id = str(uuid4())
        user_id = uuid4()
        other_user = uuid4()

        await isolated_storage.create_conversation(conv_id, user_id=user_id)

        # Other user cannot delete
        result = await isolated_storage.delete_conversation(conv_id, user_id=other_user)
        assert result is False

        # Conversation still exists
        assert await isolated_storage.get_conversation(conv_id) is not None


class TestUsers:
    """Tests for user management."""

    @pytest.mark.asyncio
    async def test_create_user(self, isolated_storage):
        """Create a user."""
        result = await isolated_storage.create_user(
            email="test@example.com",
            password_hash="hashed_password"
        )

        assert result["email"] == "test@example.com"
        assert result["password_hash"] == "hashed_password"
        assert "id" in result
        assert "created_at" in result

    @pytest.mark.asyncio
    async def test_get_user_by_email(self, isolated_storage):
        """Get user by email (case insensitive)."""
        await isolated_storage.create_user(
            email="Test@Example.com",
            password_hash="hash"
        )

        # Find by lowercase
        result = await isolated_storage.get_user_by_email("test@example.com")
        assert result is not None
        assert result["email"] == "Test@Example.com"

        # Find by uppercase
        result = await isolated_storage.get_user_by_email("TEST@EXAMPLE.COM")
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_user_by_email_not_found(self, isolated_storage):
        """Get non-existent user returns None."""
        result = await isolated_storage.get_user_by_email("nonexistent@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_by_id(self, isolated_storage):
        """Get user by ID."""
        created = await isolated_storage.create_user(
            email="test@example.com",
            password_hash="hash"
        )

        from uuid import UUID
        result = await isolated_storage.get_user_by_id(UUID(created["id"]))

        assert result is not None
        assert result["email"] == "test@example.com"


class TestOAuthUsers:
    """Tests for OAuth user management."""

    @pytest.mark.asyncio
    async def test_create_oauth_user(self, isolated_storage):
        """Create an OAuth user."""
        result = await isolated_storage.create_oauth_user(
            email="oauth@example.com",
            oauth_provider="google",
            oauth_provider_id="google-123",
            name="OAuth User",
            avatar_url="https://example.com/avatar.png"
        )

        assert result["email"] == "oauth@example.com"
        assert result["oauth_provider"] == "google"
        assert result["oauth_provider_id"] == "google-123"
        assert result["name"] == "OAuth User"
        assert result["avatar_url"] == "https://example.com/avatar.png"

    @pytest.mark.asyncio
    async def test_get_user_by_oauth(self, isolated_storage):
        """Get user by OAuth credentials."""
        await isolated_storage.create_oauth_user(
            email="oauth@example.com",
            oauth_provider="github",
            oauth_provider_id="gh-456"
        )

        result = await isolated_storage.get_user_by_oauth("github", "gh-456")

        assert result is not None
        assert result["email"] == "oauth@example.com"

    @pytest.mark.asyncio
    async def test_get_user_by_oauth_not_found(self, isolated_storage):
        """Non-existent OAuth user returns None."""
        result = await isolated_storage.get_user_by_oauth("google", "nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_link_oauth_to_existing_user(self, isolated_storage):
        """Link OAuth credentials to existing user."""
        # Create regular user first
        user = await isolated_storage.create_user(
            email="user@example.com",
            password_hash="hash"
        )

        from uuid import UUID
        result = await isolated_storage.link_oauth_to_existing_user(
            user_id=UUID(user["id"]),
            oauth_provider="google",
            oauth_provider_id="google-789",
            name="Updated Name",
            avatar_url="https://example.com/new-avatar.png"
        )

        assert result is not None
        assert result["oauth_provider"] == "google"
        assert result["oauth_provider_id"] == "google-789"
        assert result["name"] == "Updated Name"

        # Should be findable by OAuth now
        found = await isolated_storage.get_user_by_oauth("google", "google-789")
        assert found is not None
        assert found["id"] == user["id"]


class TestApiKeys:
    """Tests for API key management."""

    @pytest.mark.asyncio
    async def test_save_and_get_api_key(self, isolated_storage):
        """Save and retrieve an API key."""
        from unittest.mock import patch

        user_id = uuid4()

        # Mock encryption functions (imported inside the functions)
        with patch("backend.encryption.get_current_key_version", return_value=1):
            with patch("backend.encryption.decrypt_api_key", return_value="decrypted-key"):
                with patch("backend.encryption.rotate_api_key", return_value=("encrypted", False)):
                    await isolated_storage.save_user_api_key(
                        user_id=user_id,
                        provider="openrouter",
                        encrypted_key="encrypted-key",
                        key_hint="...xyz"
                    )

                    result = await isolated_storage.get_user_api_key(user_id, "openrouter")

        assert result == "decrypted-key"

    @pytest.mark.asyncio
    async def test_get_api_key_not_found(self, isolated_storage):
        """Get non-existent API key returns None."""
        from unittest.mock import patch

        with patch("backend.encryption.decrypt_api_key"):
            with patch("backend.encryption.get_current_key_version", return_value=1):
                result = await isolated_storage.get_user_api_key(uuid4(), "openrouter")

        assert result is None

    @pytest.mark.asyncio
    async def test_list_user_api_keys(self, isolated_storage):
        """List user's API keys (metadata only)."""
        from unittest.mock import patch

        user_id = uuid4()

        with patch("backend.encryption.get_current_key_version", return_value=1):
            await isolated_storage.save_user_api_key(
                user_id=user_id,
                provider="openrouter",
                encrypted_key="encrypted",
                key_hint="...abc"
            )
            await isolated_storage.save_user_api_key(
                user_id=user_id,
                provider="anthropic",
                encrypted_key="encrypted2",
                key_hint="...xyz"
            )

        result = await isolated_storage.get_user_api_keys(user_id)

        assert len(result) == 2
        providers = [k["provider"] for k in result]
        assert "openrouter" in providers
        assert "anthropic" in providers
        # Should not contain decrypted keys
        for key_data in result:
            assert "encrypted_key" not in key_data

    @pytest.mark.asyncio
    async def test_delete_api_key(self, isolated_storage):
        """Delete an API key."""
        from unittest.mock import patch

        user_id = uuid4()

        with patch("backend.encryption.get_current_key_version", return_value=1):
            await isolated_storage.save_user_api_key(
                user_id=user_id,
                provider="openrouter",
                encrypted_key="encrypted",
                key_hint="...abc"
            )

        result = await isolated_storage.delete_user_api_key(user_id, "openrouter")

        assert result is True

        # Should be gone
        keys = await isolated_storage.get_user_api_keys(user_id)
        assert len(keys) == 0


class TestCredits:
    """Tests for credits system stubs."""

    @pytest.mark.asyncio
    async def test_get_user_credits_default(self, isolated_storage):
        """New user has 0 credits."""
        result = await isolated_storage.get_user_credits(uuid4())

        assert result == 0

    @pytest.mark.asyncio
    async def test_add_credits(self, isolated_storage):
        """Add credits to user."""
        user_id = uuid4()

        result = await isolated_storage.add_credits(
            user_id=user_id,
            amount=10,
            transaction_type="purchase",
            description="Test purchase"
        )

        assert result == 10

        # Verify balance
        balance = await isolated_storage.get_user_credits(user_id)
        assert balance == 10

    @pytest.mark.asyncio
    async def test_consume_credit(self, isolated_storage):
        """Consume credits."""
        user_id = uuid4()

        # Add credits first
        await isolated_storage.add_credits(user_id, 5, "purchase")

        # Consume one
        result = await isolated_storage.consume_credit(user_id, "Query usage")
        assert result is True

        # Check balance
        balance = await isolated_storage.get_user_credits(user_id)
        assert balance == 4

    @pytest.mark.asyncio
    async def test_consume_credit_insufficient(self, isolated_storage):
        """Cannot consume with insufficient credits."""
        user_id = uuid4()

        result = await isolated_storage.consume_credit(user_id, "Query usage")

        assert result is False

    @pytest.mark.asyncio
    async def test_get_credit_transactions(self, isolated_storage):
        """Get transaction history."""
        user_id = uuid4()

        await isolated_storage.add_credits(user_id, 10, "purchase", "Initial")
        await isolated_storage.consume_credit(user_id, "Usage 1")
        await isolated_storage.consume_credit(user_id, "Usage 2")

        result = await isolated_storage.get_credit_transactions(user_id)

        assert len(result) == 3
        # Verify correct amounts exist (order may vary due to same-second timestamps)
        amounts = [t["amount"] for t in result]
        assert amounts.count(-1) == 2  # Two consumption transactions
        assert amounts.count(10) == 1  # One deposit transaction

    @pytest.mark.asyncio
    async def test_get_deposit_options(self, isolated_storage):
        """Get available deposit options."""
        result = await isolated_storage.get_deposit_options()

        assert len(result) == 4
        amounts = [o["amount_cents"] for o in result]
        assert 100 in amounts  # $1
        assert 200 in amounts  # $2
        assert 500 in amounts  # $5
        assert 1000 in amounts  # $10


class TestAccountDeletion:
    """Tests for account deletion."""

    @pytest.mark.asyncio
    async def test_delete_user_account(self, isolated_storage):
        """Delete user and all associated data."""
        # Create user with conversations
        user = await isolated_storage.create_oauth_user(
            email="delete@example.com",
            oauth_provider="google",
            oauth_provider_id="google-delete"
        )
        from uuid import UUID
        user_id = UUID(user["id"])

        # Create conversations
        await isolated_storage.create_conversation("conv-1", user_id=user_id)
        await isolated_storage.create_conversation("conv-2", user_id=user_id)

        # Delete account
        success, key_hash = await isolated_storage.delete_user_account(user_id)

        assert success is True
        assert key_hash is None  # Local storage doesn't have OpenRouter keys

        # Verify user is gone
        found = await isolated_storage.get_user_by_id(user_id)
        assert found is None

        # Verify conversations are gone
        convs = await isolated_storage.list_conversations(user_id=user_id)
        assert len(convs) == 0

    @pytest.mark.asyncio
    async def test_delete_nonexistent_user(self, isolated_storage):
        """Deleting non-existent user returns False."""
        success, key_hash = await isolated_storage.delete_user_account(uuid4())

        assert success is False
