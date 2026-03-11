import asyncio
from db.database import init_db

async def main():
    print("Initializing Database...")
    await init_db()
    print("Database Initialized successfully.")

if __name__ == "__main__":
    asyncio.run(main())
