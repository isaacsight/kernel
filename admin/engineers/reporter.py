import logging
import os
import json
from datetime import datetime
import google.generativeai as genai
from admin.config import config
from admin.brain.memory_store import get_memory_store
from admin.brain.system_prompts import SystemPrompts
from core.agent_interface import BaseAgent
from typing import Dict, List

logger = logging.getLogger("Reporter")

class Reporter(BaseAgent):
    """
    The Reporter (Systems Architect)
    
    Mission: Synthesize raw telemetry and decisions into actionable intelligence products.
    """

    def __init__(self):
        self.memory = get_memory_store()
        
        # Initialize Gemini
        if config.GEMINI_API_KEY:
            genai.configure(api_key=config.GEMINI_API_KEY)
            model_name = config.GEMINI_MODEL or "gemini-1.5-flash-latest"
            logger.info(f"Initializing Reporter with model: {model_name}")
            self.model = genai.GenerativeModel(model_name)

    @property
    def name(self) -> str:
        return "The Reporter"

    @property
    def role(self) -> str:
        return "Systems Architect"

    async def execute(self, action: str, **params) -> Dict:
        if action == "generate_audit":
            limit = params.get("limit", 50)
            return await self.generate_session_audit(limit=limit)
        
        elif action == "synthesize_product":
            report_content = params.get("content")
            if not report_content:
                # If no content provided, generate audit first
                audit = await self.generate_session_audit()
                report_content = audit.get("report")
            
            return await self.generate_product_deliverable(report_content)
            
        else:
             raise NotImplementedError(f"Action {action} not supported by Reporter.")

    async def generate_session_audit(self, limit: int = 50) -> Dict:
        """
        Synthesizes recent browser logs and decisions.
        """
        logger.info(f"Reporter initiating session audit (limit: {limit})...")
        
        # 1. Fetch raw data
        intake = self.memory.get_recent_intake(limit=limit)
        decisions = self.memory.get_decision_history(limit=limit)
        
        if not intake and not decisions:
            return {"status": "error", "message": "No telemetry found to audit."}

        # 2. Format context for LLM
        context = "RAW INTAKE LOGS:\n"
        for item in intake:
            context += f"- [{item['timestamp']}] {item['source_type']}: {item['source_path'] or 'N/A'}\n"
            if item['content']:
                context += f"  Snippet: {item['content'][:200]}...\n"

        context += "\nDECISION LEDGER:\n"
        for d in decisions:
            context += f"- [{d['timestamp']}] {d['topic']} -> {d['decision']}\n"

        # 3. Prompt Gemini with Reporter Protocol
        protocol = SystemPrompts.get_reporter_protocol_prompt()
        prompt = f"{protocol}\n\nCONTEXT DATA:\n{context}\n\nFINAL AUDIT REPORT:"
        
        try:
            response = self.model.generate_content(prompt)
            report = response.text
            
            # Save report to filesystem for persistence
            report_id = f"audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            report_path = os.path.join("admin", "reports", f"{report_id}.md")
            os.makedirs(os.path.dirname(report_path), exist_ok=True)
            
            with open(report_path, "w") as f:
                f.write(report)
            
            return {
                "status": "success",
                "report_id": report_id,
                "report": report,
                "path": report_path
            }
        except Exception as e:
            logger.error(f"Audit generation failed: {e}")
            return {"status": "error", "message": str(e)}

    async def generate_product_deliverable(self, raw_report: str) -> Dict:
        """
        Transforms a raw report into a premium 'Product'.
        """
        logger.info("Reporter synthesizing Sovereign Product deliverable...")
        
        protocol = SystemPrompts.get_product_delivery_prompt()
        prompt = f"{protocol}\n\nRAW ANALYSIS DATA:\n{raw_report}\n\nPRODUCT DELIVERABLE:"
        
        try:
            response = self.model.generate_content(prompt)
            product = response.text
            
            # Save product
            product_id = f"product_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            product_path = os.path.join("admin", "reports", f"{product_id}.md")
            os.makedirs(os.path.dirname(product_path), exist_ok=True)
            
            with open(product_path, "w") as f:
                f.write(product)
            
            return {
                "status": "success",
                "product_id": product_id,
                "product": product,
                "path": product_path
            }
        except Exception as e:
            logger.error(f"Product synthesis failed: {e}")
            return {"status": "error", "message": str(e)}
