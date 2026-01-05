"""
Shared pytest fixtures for backend tests.
"""
import os
import pytest
from unittest.mock import AsyncMock, patch

# Custom marker for Postgres-only tests
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "postgres: mark test as requiring PostgreSQL"
    )

# Skip Postgres tests when DATABASE_URL not set
requires_postgres = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set - skipping Postgres tests"
)


@pytest.fixture
def auth_headers():
    """Create valid auth headers for API tests."""
    # Import here to avoid circular imports
    from backend.auth_jwt import create_access_token
    token = create_access_token(user_id="test-user-123", email="test@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_storage():
    """Mock storage module for tests that don't need real DB."""
    with patch("backend.main.storage") as mock:
        mock.get_conversation = AsyncMock(return_value=None)
        mock.create_conversation = AsyncMock(return_value="conv-123")
        mock.list_conversations = AsyncMock(return_value=[])
        mock.get_balance = AsyncMock(return_value={
            "balance": 5.00,
            "total_deposited": 5.00,
            "total_spent": 0.00
        })
        yield mock


@pytest.fixture
def isolated_storage(tmp_path, monkeypatch):
    """Isolate storage_local to temp directories for test safety."""
    monkeypatch.setattr("backend.storage_local.DATA_DIR", tmp_path / "data")
    monkeypatch.setattr("backend.storage_local.USERS_DIR", tmp_path / "users")
    monkeypatch.setattr("backend.storage_local.API_KEYS_DIR", tmp_path / "keys")

    # Create directories
    (tmp_path / "data").mkdir()
    (tmp_path / "users").mkdir()
    (tmp_path / "keys").mkdir()

    from backend import storage_local
    return storage_local
