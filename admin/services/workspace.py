"""
Workspace management service for Studio OS SaaS.
Handles workspace creation, member management, and workspace-scoped operations.
"""

from typing import List, Optional, Dict
from pydantic import BaseModel
from datetime import datetime
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Supabase Setup
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None


class WorkspaceCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    ai_config: Optional[Dict] = None


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ai_config: Optional[Dict] = None
    custom_domain: Optional[str] = None


class OrganizationCreate(BaseModel):
    name: str
    slug: str


class WorkspaceService:
    """Service for managing workspaces"""
    
    @staticmethod
    def create_workspace(
        organization_id: str,
        workspace_data: WorkspaceCreate
    ) -> Dict:
        """
        Creates a new workspace for an organization.
        """
        if not supabase:
            raise Exception("Database not configured")
        
        try:
            result = supabase.table("workspaces").insert({
                "organization_id": organization_id,
                "name": workspace_data.name,
                "slug": workspace_data.slug,
                "description": workspace_data.description,
                "ai_config": workspace_data.ai_config or {},
                "settings": {}
            }).execute()
            
            return result.data[0] if result.data else None
            
        except Exception as e:
            raise Exception(f"Failed to create workspace: {str(e)}")
    
    @staticmethod
    def get_workspace(workspace_id: str) -> Optional[Dict]:
        """Gets workspace by ID"""
        if not supabase:
            raise Exception("Database not configured")
        
        result = supabase.table("workspaces")\
            .select("*")\
            .eq("id", workspace_id)\
            .execute()
        
        return result.data[0] if result.data else None
    
    @staticmethod
    def get_organization_workspaces(organization_id: str) -> List[Dict]:
        """Gets all workspaces for an organization"""
        if not supabase:
            raise Exception("Database not configured")
        
        result = supabase.table("workspaces")\
            .select("*")\
            .eq("organization_id", organization_id)\
            .order("created_at", desc=True)\
            .execute()
        
        return result.data or []
    
    @staticmethod
    def update_workspace(
        workspace_id: str,
        updates: WorkspaceUpdate
    ) -> Dict:
        """Updates workspace settings"""
        if not supabase:
            raise Exception("Database not configured")
        
        update_data = {
            k: v for k, v in updates.dict().items()
            if v is not None
        }
        
        result = supabase.table("workspaces")\
            .update(update_data)\
            .eq("id", workspace_id)\
            .execute()
        
        return result.data[0] if result.data else None
    
    @staticmethod
    def delete_workspace(workspace_id: str) -> bool:
        """Deletes a workspace (cascade deletes all associated content)"""
        if not supabase:
            raise Exception("Database not configured")
        
        try:
            supabase.table("workspaces")\
                .delete()\
                .eq("id", workspace_id)\
                .execute()
            return True
        except Exception as e:
            raise Exception(f"Failed to delete workspace: {str(e)}")


class OrganizationService:
    """Service for managing organizations"""
    
    @staticmethod
    def create_organization(
        owner_user_id: str,
        org_data: OrganizationCreate
    ) -> Dict:
        """
        Creates a new organization and adds the creator as owner.
        Also creates a default workspace.
        """
        if not supabase:
            raise Exception("Database not configured")
        
        try:
            # Create organization
            org_result = supabase.table("organizations").insert({
                "name": org_data.name,
                "slug": org_data.slug,
                "subscription_tier": "free",
                "subscription_status": "active",
                "settings": {},
                "metadata": {}
            }).execute()
            
            if not org_result.data:
                raise Exception("Failed to create organization")
            
            organization = org_result.data[0]
            organization_id = organization["id"]
            
            # Add creator as owner
            supabase.table("organization_members").insert({
                "organization_id": organization_id,
                "user_id": owner_user_id,
                "role": "owner"
            }).execute()
            
            # Create default workspace
            WorkspaceService.create_workspace(
                organization_id,
                WorkspaceCreate(
                    name="Default Workspace",
                    slug="default",
                    description="Your first workspace"
                )
            )
            
            return organization
            
        except Exception as e:
            raise Exception(f"Failed to create organization: {str(e)}")
    
    @staticmethod
    def get_user_organizations(user_id: str) -> List[Dict]:
        """Gets all organizations a user is a member of"""
        if not supabase:
            raise Exception("Database not configured")
        
        # Get organization memberships
        members_result = supabase.table("organization_members")\
            .select("organization_id, role")\
            .eq("user_id", user_id)\
            .execute()
        
        if not members_result.data:
            return []
        
        # Get full organization details
        org_ids = [m["organization_id"] for m in members_result.data]
        
        orgs_result = supabase.table("organizations")\
            .select("*")\
            .in_("id", org_ids)\
            .execute()
        
        # Attach role to each organization
        orgs = orgs_result.data or []
        for org in orgs:
            member = next(m for m in members_result.data if m["organization_id"] == org["id"])
            org["user_role"] = member["role"]
        
        return orgs
    
    @staticmethod
    def get_organization(organization_id: str) -> Optional[Dict]:
        """Gets organization by ID"""
        if not supabase:
            raise Exception("Database not configured")
        
        result = supabase.table("organizations")\
            .select("*")\
            .eq("id", organization_id)\
            .execute()
        
        return result.data[0] if result.data else None
    
    @staticmethod
    def invite_member(
        organization_id: str,
        user_email: str,
        role: str,
        invited_by: str
    ) -> Dict:
        """
        Invites a user to join an organization.
        In a real system, this would send an email invitation.
        For now, it just adds them if they exist.
        """
        if not supabase:
            raise Exception("Database not configured")
        
        # Find user by email
        user_result = supabase.table("users")\
            .select("id")\
            .eq("email", user_email)\
            .execute()
        
        if not user_result.data:
            raise Exception(f"User with email {user_email} not found")
        
        user_id = user_result.data[0]["id"]
        
        # Add as member
        member_result = supabase.table("organization_members").insert({
            "organization_id": organization_id,
            "user_id": user_id,
            "role": role,
            "invited_by": invited_by
        }).execute()
        
        return member_result.data[0] if member_result.data else None
    
    @staticmethod
    def get_members(organization_id: str) -> List[Dict]:
        """Gets all members of an organization"""
        if not supabase:
            raise Exception("Database not configured")
        
        result = supabase.table("organization_members")\
            .select("*, users(id, email, full_name, avatar_url)")\
            .eq("organization_id", organization_id)\
            .execute()
        
        return result.data or []
    
    @staticmethod
    def update_member_role(
        organization_id: str,
        user_id: str,
        new_role: str
    ) -> Dict:
        """Updates a member's role"""
        if not supabase:
            raise Exception("Database not configured")
        
        result = supabase.table("organization_members")\
            .update({"role": new_role})\
            .eq("organization_id", organization_id)\
            .eq("user_id", user_id)\
            .execute()
        
        return result.data[0] if result.data else None
    
    @staticmethod
    def remove_member(organization_id: str, user_id: str) -> bool:
        """Removes a member from an organization"""
        if not supabase:
            raise Exception("Database not configured")
        
        try:
            supabase.table("organization_members")\
                .delete()\
                .eq("organization_id", organization_id)\
                .eq("user_id", user_id)\
                .execute()
            return True
        except Exception as e:
            raise Exception(f"Failed to remove member: {str(e)}")


def create_context(workspace_id: str, user_id: str) -> Dict:
    """
    Creates an execution context for workspace-scoped operations.
    This is used to pass workspace context to core functions.
    """
    return {
        "workspace_id": workspace_id,
        "user_id": user_id,
        "timestamp": datetime.now().isoformat()
    }
