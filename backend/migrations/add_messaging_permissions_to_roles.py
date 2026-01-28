"""
Migration script to add fund_requests and messages permissions to existing roles.
Run this script to ensure all roles have access to Memos and Messages.
"""
import asyncio
import aiosqlite

DATABASE_PATH = "./data/kountry_eyecare.db"

# Permissions to add to all non-admin roles
PERMISSIONS_TO_ADD = [
    "fund_requests.view",
    "fund_requests.create", 
    "messages.view",
    "messages.send",
]


async def migrate():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        print("Starting migration to add messaging permissions to roles...")
        
        # First, ensure the permissions exist
        for perm_code in PERMISSIONS_TO_ADD:
            cursor = await db.execute(
                "SELECT id FROM permissions WHERE code = ?", (perm_code,)
            )
            perm = await cursor.fetchone()
            if not perm:
                # Create the permission
                module = perm_code.split('.')[0]
                name = perm_code.replace('.', ' ').replace('_', ' ').title()
                await db.execute(
                    "INSERT INTO permissions (name, code, module) VALUES (?, ?, ?)",
                    (name, perm_code, module)
                )
                print(f"Created permission: {perm_code}")
        
        await db.commit()
        
        # Get all roles except Admin
        cursor = await db.execute("SELECT id, name FROM roles WHERE name != 'Admin'")
        roles = await cursor.fetchall()
        
        for role_id, role_name in roles:
            print(f"\nProcessing role: {role_name}")
            
            for perm_code in PERMISSIONS_TO_ADD:
                # Get permission id
                cursor = await db.execute(
                    "SELECT id FROM permissions WHERE code = ?", (perm_code,)
                )
                perm = await cursor.fetchone()
                if not perm:
                    print(f"  Warning: Permission {perm_code} not found")
                    continue
                
                perm_id = perm[0]
                
                # Check if role already has this permission
                cursor = await db.execute(
                    "SELECT 1 FROM role_permissions WHERE role_id = ? AND permission_id = ?",
                    (role_id, perm_id)
                )
                existing = await cursor.fetchone()
                
                if not existing:
                    await db.execute(
                        "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
                        (role_id, perm_id)
                    )
                    print(f"  Added permission: {perm_code}")
                else:
                    print(f"  Already has: {perm_code}")
        
        await db.commit()
        print("\nMigration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
