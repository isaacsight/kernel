"""
The Design Engineer - Frontend Implementation Agent

Implements design changes by modifying CSS, HTML, and JavaScript.
Bridges the gap between design decisions and working code.
"""

import os
import sys
import json
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector

logger = logging.getLogger("DesignEngineer")


class DesignEngineer:
    """
    The Design Engineer (Frontend Implementation Specialist)
    
    Mission: Turn design decisions into production-ready code.
    
    Responsibilities:
    - Implement CSS changes from design specs
    - Fix responsive/mobile issues
    - Optimize animations and transitions
    - Ensure cross-browser compatibility
    - Maintain design system consistency
    - Debug layout and styling issues
    """
    
    def __init__(self):
        self.name = "The Design Engineer"
        self.role = "Frontend Implementation Specialist"
        self.node_url = os.environ.get("STUDIO_NODE_URL")
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        
        # Base paths
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.docs_css_path = os.path.join(self.base_dir, "docs", "css", "style.css")
        self.static_css_path = os.path.join(self.base_dir, "static", "css", "style.css")
        self.docs_js_path = os.path.join(self.base_dir, "docs", "js", "main.js")

    def read_css(self) -> str:
        """Read the current CSS file."""
        if os.path.exists(self.docs_css_path):
            with open(self.docs_css_path, 'r') as f:
                return f.read()
        return ""

    def write_css(self, content: str, sync: bool = True) -> bool:
        """
        Write CSS to docs and optionally sync to static folder.
        """
        try:
            with open(self.docs_css_path, 'w') as f:
                f.write(content)
            
            if sync and os.path.exists(os.path.dirname(self.static_css_path)):
                with open(self.static_css_path, 'w') as f:
                    f.write(content)
            
            logger.info("CSS updated successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to write CSS: {e}")
            return False

    def find_and_replace_css(self, search: str, replace: str) -> Tuple[bool, str]:
        """
        Find and replace a CSS block.
        """
        css = self.read_css()
        
        if search not in css:
            return False, f"Could not find: {search[:50]}..."
        
        new_css = css.replace(search, replace)
        success = self.write_css(new_css)
        
        return success, "CSS updated" if success else "Failed to write CSS"

    def fix_mobile_nav(self, background: str = "#121212", text_color: str = "#FFFFFF") -> Dict:
        """
        Fix common mobile navigation issues.
        """
        logger.info("Fixing mobile navigation...")
        
        changes = []
        css = self.read_css()
        
        # Fix 1: Ensure solid background (no bleed-through)
        old_bg_pattern = r'\.mobile-nav-overlay\s*\{[^}]*background:\s*[^;]+;'
        if re.search(old_bg_pattern, css):
            css = re.sub(
                r'(\.mobile-nav-overlay\s*\{[^}]*background:\s*)[^;]+;',
                f'\\1{background};',
                css
            )
            changes.append(f"Set mobile nav background to {background}")
        
        # Fix 2: Ensure text is visible
        old_text_pattern = r'\.mobile-nav\s+a\s*\{[^}]*color:\s*[^;]+;'
        if re.search(old_text_pattern, css):
            css = re.sub(
                r'(\.mobile-nav\s+a\s*\{[^}]*color:\s*)[^;]+;',
                f'\\1{text_color};',
                css
            )
            changes.append(f"Set mobile nav link color to {text_color}")
        
        success = self.write_css(css)
        
        return {
            "success": success,
            "changes": changes,
            "recommendation": "Hard refresh browser (Cmd+Shift+R) to see changes"
        }

    def fix_footer_sidebar_overlap(self) -> Dict:
        """
        Fix footer being overlapped by sidebar on desktop.
        """
        logger.info("Fixing footer sidebar overlap...")
        
        css = self.read_css()
        changes = []
        
        # Check if footer already has margin-left
        if "site-footer" in css and "margin-left: var(--sidebar-width)" not in css:
            # Find the .site-footer rule and add margin-left
            footer_pattern = r'(\.site-footer\s*\{[^}]*)(})'
            
            if re.search(footer_pattern, css):
                css = re.sub(
                    footer_pattern,
                    r'\1    margin-left: var(--sidebar-width);\n\2',
                    css
                )
                changes.append("Added margin-left to footer for sidebar offset")
                
                # Add responsive override
                if "@media (max-width: 968px)" in css:
                    # Find where to insert the mobile override
                    responsive_footer = """
@media (max-width: 968px) {
    .site-footer {
        margin-left: 0;
    }
}
"""
                    # Only add if not already present
                    if ".site-footer {\n        margin-left: 0;" not in css:
                        # Insert before the closing of responsive block or at end
                        css += responsive_footer
                        changes.append("Added mobile override for footer margin")
        
        success = self.write_css(css)
        
        return {
            "success": success,
            "changes": changes
        }

    def add_component_css(self, component_name: str, css_rules: str) -> Dict:
        """
        Add new CSS rules for a component.
        """
        current_css = self.read_css()
        
        # Check if component already exists
        if f"/* {component_name} */" in current_css or f".{component_name}" in current_css:
            return {
                "success": False,
                "message": f"Component '{component_name}' may already exist in CSS"
            }
        
        # Add the new rules at the end (before any closing comments)
        new_css = current_css.rstrip() + f"\n\n/* {component_name} */\n{css_rules}\n"
        
        success = self.write_css(new_css)
        
        return {
            "success": success,
            "message": f"Added {component_name} styles" if success else "Failed to add styles"
        }

    def update_css_variable(self, var_name: str, new_value: str) -> Dict:
        """
        Update a CSS custom property value.
        """
        css = self.read_css()
        
        # Pattern to match CSS variable in :root
        pattern = rf'(--{var_name}:\s*)[^;]+;'
        
        if re.search(pattern, css):
            new_css = re.sub(pattern, f'\\1{new_value};', css)
            success = self.write_css(new_css)
            return {
                "success": success,
                "message": f"Updated --{var_name} to {new_value}"
            }
        else:
            return {
                "success": False,
                "message": f"Variable --{var_name} not found"
            }

    def analyze_responsive_issues(self) -> Dict:
        """
        Analyze CSS for common responsive issues.
        """
        css = self.read_css()
        issues = []
        
        # Check for fixed widths that might break on mobile
        fixed_widths = re.findall(r'width:\s*(\d+)px', css)
        large_fixed = [w for w in fixed_widths if int(w) > 400]
        if large_fixed:
            issues.append({
                "type": "fixed_width",
                "count": len(large_fixed),
                "suggestion": "Consider using max-width or percentage for large fixed widths"
            })
        
        # Check for media query coverage
        media_queries = re.findall(r'@media[^{]+', css)
        if len(media_queries) < 3:
            issues.append({
                "type": "media_queries",
                "count": len(media_queries),
                "suggestion": "Consider adding more breakpoints for better responsiveness"
            })
        
        # Check for touch target sizes
        small_buttons = re.findall(r'min-(?:width|height):\s*(3\d|[12]\d)px', css)
        if small_buttons:
            issues.append({
                "type": "touch_targets",
                "count": len(small_buttons),
                "suggestion": "Touch targets should be at least 44px, ideally 48px"
            })
        
        return {
            "issues": issues,
            "score": max(0, 100 - (len(issues) * 15)),
            "recommendation": "Run fixes with fix_responsive_issues()"
        }

    def implement_design_change(self, description: str) -> Dict:
        """
        Uses AI to implement a design change based on natural language description.
        """
        if not self.node_url:
            return {"error": "STUDIO_NODE_URL not configured"}
        
        css = self.read_css()
        
        # Truncate CSS to fit in context
        css_sample = css[:8000] if len(css) > 8000 else css
        
        prompt = f"""You are a Design Engineer. Implement this change: "{description}"

Current CSS (truncated):
{css_sample}

Return ONLY a JSON response with this structure:
{{
    "search": "exact CSS to find and replace (or null if adding new)",
    "replace": "new CSS content",
    "explanation": "what this change does"
}}

Be precise with the search string - it must match exactly.
"""
        
        import requests
        
        try:
            payload = {
                "prompt": prompt,
                "model": "mistral",
                "system_prompt": "You are an expert CSS engineer. Output ONLY valid JSON."
            }
            response = requests.post(f"{self.node_url}/generate", json=payload, timeout=60)
            response.raise_for_status()
            
            content = response.json().get("response", "")
            
            # Clean markdown
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            change = json.loads(content.strip())
            
            # Apply the change
            if change.get("search"):
                success, msg = self.find_and_replace_css(change["search"], change["replace"])
            else:
                # Adding new CSS
                current = self.read_css()
                new_css = current + "\n" + change["replace"]
                success = self.write_css(new_css)
                msg = "Added new CSS"
            
            return {
                "success": success,
                "explanation": change.get("explanation", ""),
                "message": msg
            }
            
        except Exception as e:
            logger.error(f"Design change failed: {e}")
            return {"error": str(e)}

    def quick_fix(self, issue_type: str) -> Dict:
        """
        Apply quick fixes for common issues.
        """
        fixes = {
            "mobile_nav": self.fix_mobile_nav,
            "footer_overlap": self.fix_footer_sidebar_overlap,
        }
        
        if issue_type in fixes:
            return fixes[issue_type]()
        
        return {"error": f"Unknown issue type: {issue_type}. Available: {list(fixes.keys())}"}


if __name__ == "__main__":
    engineer = DesignEngineer()
    
    # Test responsive analysis
    print("Analyzing responsive issues...")
    issues = engineer.analyze_responsive_issues()
    print(json.dumps(issues, indent=2))
    
    # Test mobile nav fix (dry run - just show what would change)
    print("\nMobile nav fix would apply:")
    print("- Background: #121212 (matte black)")
    print("- Text: #FFFFFF (white)")
