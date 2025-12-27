"""Database migration runner for Phase 1 multi-user support."""

import asyncio
import asyncpg
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


async def run_migrations():
    """Run all pending database migrations."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        return

    conn = await asyncpg.connect(database_url)

    try:
        # Create migrations tracking table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INT PRIMARY KEY,
                name TEXT,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)

        # Get applied migrations
        rows = await conn.fetch("SELECT version FROM schema_migrations")
        applied = set(row["version"] for row in rows)

        # Find and run pending migrations
        migrations_dir = Path(__file__).parent / "migrations"
        migration_files = sorted(migrations_dir.glob("*.sql"))

        if not migration_files:
            print("No migration files found in", migrations_dir)
            return

        pending_count = 0
        for migration_file in migration_files:
            # Extract version from filename (e.g., "001_create_users_table.sql" -> 1)
            version = int(migration_file.stem.split("_")[0])
            name = migration_file.stem

            if version not in applied:
                print(f"Running migration {migration_file.name}...")
                sql = migration_file.read_text()
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
                    version,
                    name
                )
                print(f"  Applied: {name}")
                pending_count += 1

        if pending_count == 0:
            print("All migrations already applied.")
        else:
            print(f"Applied {pending_count} migration(s).")

    finally:
        await conn.close()

    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(run_migrations())
