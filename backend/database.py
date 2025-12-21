"""Async PostgreSQL database connection pool."""

import asyncpg
from typing import Optional
from .config import DATABASE_URL

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Get or create the database connection pool."""
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL environment variable is not set")
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60
        )
    return _pool


async def close_pool():
    """Close the database connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def execute(query: str, *args) -> str:
    """Execute a query without returning results. Returns status string."""
    pool = await get_pool()
    return await pool.execute(query, *args)


async def fetch(query: str, *args) -> list:
    """Execute a query and return all results."""
    pool = await get_pool()
    return await pool.fetch(query, *args)


async def fetchrow(query: str, *args) -> Optional[asyncpg.Record]:
    """Execute a query and return the first result."""
    pool = await get_pool()
    return await pool.fetchrow(query, *args)


async def fetchval(query: str, *args):
    """Execute a query and return the first value of the first result."""
    pool = await get_pool()
    return await pool.fetchval(query, *args)
