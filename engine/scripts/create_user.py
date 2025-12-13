
import asyncio
import uuid
import sys
from app.core.db import get_session
from app.models.user import User, UserRole
from app.core.security import get_password_hash

async def create_user(email, password, role="client", tenant_id=None):
    print(f"Creating user {email}...")
    
    hashed = get_password_hash(password)
    
    # Generate random tenant if not provided for client
    if not tenant_id and role == "client":
        tenant_id = uuid.uuid4()
    elif not tenant_id and role == "admin":
        # Admin can have a "system" tenant or None if model allows. 
        # BaseTable requires tenant_id. Using a zero-uuid for system? 
        # Or just a random one. Let's use a specific one for Admin.
        tenant_id = uuid.UUID('00000000-0000-0000-0000-000000000000')

    user = User(
        tenant_id=tenant_id,
        email=email,
        hashed_password=hashed,
        role=UserRole(role),
        is_active=True
    )
    
    async for session in get_session():
        session.add(user)
        try:
            await session.commit()
            print(f"User created! ID: {user.id}")
            print(f"Tenant ID: {user.tenant_id}")
        except Exception as e:
            print(f"Error: {e}")
        break

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python create_user.py <email> <password> [role] [tenant_id]")
        sys.exit(1)
        
    email = sys.argv[1]
    password = sys.argv[2]
    role = sys.argv[3] if len(sys.argv) > 3 else "client"
    
    asyncio.run(create_user(email, password, role))
