"""
Authentication and authorization middleware for Studio OS SaaS.
Integrates with Supabase Auth for JWT validation and role-based access control.
"""

from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
import os
import jwt
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Supabase Setup
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")  # Add this to .env

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

security = HTTPBearer()


class User:
    """Represents an authenticated user"""
    def __init__(self, user_id: str, email: str, organizations: List[str] = None):
        self.id = user_id
        self.email = email
        self.organizations = organizations or []


class WorkspaceAccess:
    """Represents workspace access permissions"""
    def __init__(self, workspace_id: str, organization_id: str, role: str):
        self.workspace_id = workspace_id
        self.organization_id = organization_id
        self.role = role  # owner, admin, editor, viewer


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> User:
    """
    Validates JWT token and returns the current user.
    Raises HTTPException if token is invalid.
    """
    token = credentials.credentials
    
    try:
        # Verify JWT token with Supabase secret
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id or not email:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        # Get user's organizations
        if supabase:
            result = supabase.table("organization_members")\
                .select("organization_id")\
                .eq("user_id", user_id)\
                .execute()
            
            organizations = [row["organization_id"] for row in result.data]
        else:
            organizations = []
        
        return User(user_id=user_id, email=email, organizations=organizations)
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def get_workspace_access(
    workspace_id: str,
    user: User = Depends(get_current_user)
) -> WorkspaceAccess:
    """
    Verifies user has access to the specified workspace.
    Returns workspace access details including role.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        # Get workspace and verify it belongs to user's organization
        workspace_result = supabase.table("workspaces")\
            .select("id, organization_id")\
            .eq("id", workspace_id)\
            .execute()
        
        if not workspace_result.data:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        workspace = workspace_result.data[0]
        organization_id = workspace["organization_id"]
        
        # Check if user is member of the organization
        member_result = supabase.table("organization_members")\
            .select("role")\
            .eq("organization_id", organization_id)\
            .eq("user_id", user.id)\
            .execute()
        
        if not member_result.data:
            raise HTTPException(status_code=403, detail="Access denied to workspace")
        
        role = member_result.data[0]["role"]
        
        return WorkspaceAccess(
            workspace_id=workspace_id,
            organization_id=organization_id,
            role=role
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Access verification failed: {str(e)}")


async def require_role(
    required_role: str,
    workspace_access: WorkspaceAccess = Depends(get_workspace_access)
) -> WorkspaceAccess:
    """
    Ensures user has the required role for the workspace.
    Role hierarchy: owner > admin > editor > viewer
    """
    role_hierarchy = {
        "viewer": 0,
        "editor": 1,
        "admin": 2,
        "owner": 3
    }
    
    user_role_level = role_hierarchy.get(workspace_access.role, -1)
    required_role_level = role_hierarchy.get(required_role, 99)
    
    if user_role_level < required_role_level:
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient permissions. Required role: {required_role}"
        )
    
    return workspace_access


async def check_usage_limit(
    organization_id: str,
    usage_type: str = "ai_generation"
) -> bool:
    """
    Checks if organization has exceeded their usage limit for the current period.
    Returns True if within limits, raises HTTPException if exceeded.
    """
    if not supabase:
        return True  # Skip check if database not configured
    
    try:
        # Get organization's subscription tier
        org_result = supabase.table("organizations")\
            .select("subscription_tier")\
            .eq("id", organization_id)\
            .execute()
        
        if not org_result.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        tier = org_result.data[0]["subscription_tier"]
        
        # Get usage limits by tier
        limits = {
            "free": 10,
            "starter": 100,
            "pro": 500,
            "enterprise": 2000
        }
        
        limit = limits.get(tier, 0)
        
        # Count current period usage
        from datetime import datetime
        current_period = datetime.now().strftime("%Y-%m")
        
        usage_result = supabase.table("usage_logs")\
            .select("id", count="exact")\
            .eq("organization_id", organization_id)\
            .eq("usage_type", usage_type)\
            .eq("billing_period", current_period)\
            .execute()
        
        current_usage = usage_result.count or 0
        
        if current_usage >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Usage limit exceeded. Tier: {tier}, Limit: {limit}, Used: {current_usage}"
            )
        
        return True
        
    except HTTPException:
        raise
    except Exception as e:
        # Log error but don't block if usage check fails
        print(f"Usage check error: {e}")
        return True


async def log_usage(
    organization_id: str,
    workspace_id: str,
    user_id: str,
    usage_type: str,
    provider: Optional[str] = None,
    tokens_used: Optional[int] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None
):
    """
    Logs usage for billing and analytics purposes.
    """
    if not supabase:
        return
    
    try:
        from datetime import datetime
        current_period = datetime.now().strftime("%Y-%m")
        
        supabase.table("usage_logs").insert({
            "organization_id": organization_id,
            "workspace_id": workspace_id,
            "user_id": user_id,
            "usage_type": usage_type,
            "provider": provider,
            "tokens_used": tokens_used,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "billing_period": current_period
        }).execute()
        
    except Exception as e:
        # Don't raise exception if logging fails, just log error
        print(f"Usage logging error: {e}")


# Optional API Key for development/testing
async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security, auto_error=False)
) -> Optional[User]:
    """
    Same as get_current_user but returns None if no credentials provided.
    Useful for optional authentication.
    """
    if not credentials:
        return None
    
    return await get_current_user(credentials)
