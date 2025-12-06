"""
The Web Designer - UI/UX Design Agent

Specializes in visual design decisions, color theory, typography,
and creating cohesive design systems for web interfaces.
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector

logger = logging.getLogger("WebDesigner")


class WebDesigner:
    """
    The Web Designer (UI/UX Specialist)
    
    Mission: Create beautiful, intuitive, and cohesive web experiences.
    
    Responsibilities:
    - Design system creation and maintenance
    - Color palette and typography decisions
    - Component visual design
    - Mobile-first responsive design
    - Dark mode and accessibility compliance
    - Visual hierarchy and spacing
    """
    
    def __init__(self):
        self.name = "The Web Designer"
        self.role = "UI/UX Design Specialist"
        self.node_url = os.environ.get("STUDIO_NODE_URL")
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        
        # Design tokens based on the current design system
        self.design_tokens = {
            "colors": {
                "bg_primary": "#020202",
                "bg_secondary": "#080808",
                "bg_tertiary": "#0F0F0F",
                "bg_matte": "#121212",
                "bg_elevated": "#1A1A1A",
                "text_primary": "#FFFFFF",
                "text_secondary": "#A1A1AA",
                "text_tertiary": "#52525B",
                "accent_primary": "#00D6A3",
                "accent_hover": "#00FFC2",
                "border_subtle": "rgba(255, 255, 255, 0.04)",
                "border_emphasis": "#1F1F1F"
            },
            "typography": {
                "font_display": "'Inter', -apple-system, sans-serif",
                "font_body": "'Inter', -apple-system, sans-serif",
                "font_mono": "'JetBrains Mono', 'Fira Code', monospace",
                "scale": {
                    "6xl": "72px",
                    "5xl": "60px",
                    "4xl": "48px",
                    "3xl": "36px",
                    "2xl": "30px",
                    "xl": "24px",
                    "lg": "20px",
                    "base": "16px",
                    "sm": "14px",
                    "xs": "12px"
                }
            },
            "spacing": {
                "1": "4px",
                "2": "8px",
                "3": "12px",
                "4": "16px",
                "5": "24px",
                "6": "32px",
                "7": "48px",
                "8": "64px",
                "9": "96px",
                "10": "128px"
            },
            "radius": {
                "sm": "8px",
                "md": "16px",
                "lg": "24px"
            }
        }

    def audit_component(self, component_name: str, current_css: str) -> Dict:
        """
        Audits a UI component and provides design recommendations.
        """
        logger.info(f"Auditing component: {component_name}")
        
        recommendations = []
        
        # Check for accessibility issues
        if "#000000" in current_css or "#000" in current_css:
            recommendations.append({
                "type": "accessibility",
                "issue": "Pure black background may cause eye strain",
                "suggestion": f"Use matte black ({self.design_tokens['colors']['bg_matte']}) for better readability"
            })
            
        # Check for contrast issues
        if "text-secondary" in current_css and "bg-primary" in current_css:
            recommendations.append({
                "type": "contrast",
                "issue": "Secondary text on primary background may have low contrast",
                "suggestion": "Consider using text-primary (#FFFFFF) for important content"
            })
            
        # Check for mobile considerations
        if "44px" in current_css or "40px" in current_css:
            pass  # Good touch target
        elif "min-width" in current_css or "min-height" in current_css:
            recommendations.append({
                "type": "mobile",
                "issue": "Touch targets may be too small",
                "suggestion": "Minimum touch target should be 48px for mobile"
            })

        return {
            "component": component_name,
            "recommendations": recommendations,
            "score": 100 - (len(recommendations) * 10)
        }

    def generate_color_palette(self, base_color: str = "#00D6A3", mode: str = "dark") -> Dict:
        """
        Generates a cohesive color palette based on a base accent color.
        """
        logger.info(f"Generating {mode} mode palette from {base_color}")
        
        if mode == "dark":
            return {
                "background": {
                    "primary": "#020202",
                    "secondary": "#080808",
                    "tertiary": "#0F0F0F",
                    "matte": "#121212",
                    "elevated": "#1A1A1A",
                    "overlay": "rgba(0, 0, 0, 0.8)"
                },
                "text": {
                    "primary": "#FFFFFF",
                    "secondary": "#A1A1AA",
                    "tertiary": "#52525B",
                    "inverse": "#000000"
                },
                "accent": {
                    "primary": base_color,
                    "hover": self._lighten_color(base_color, 0.2),
                    "subtle": f"rgba({self._hex_to_rgb(base_color)}, 0.08)",
                    "glow": f"0 0 20px rgba({self._hex_to_rgb(base_color)}, 0.15)"
                },
                "border": {
                    "subtle": "rgba(255, 255, 255, 0.04)",
                    "emphasis": "#1F1F1F",
                    "focus": base_color
                },
                "status": {
                    "success": "#22C55E",
                    "warning": "#EAB308",
                    "error": "#EF4444",
                    "info": "#3B82F6"
                }
            }
        else:
            # Light mode palette
            return {
                "background": {
                    "primary": "#FFFFFF",
                    "secondary": "#FAFAFA",
                    "tertiary": "#F5F5F5"
                },
                "text": {
                    "primary": "#18181B",
                    "secondary": "#52525B",
                    "tertiary": "#A1A1AA"
                },
                "accent": {
                    "primary": base_color
                }
            }

    def suggest_component_style(self, component_type: str) -> Dict:
        """
        Suggests styling for common UI components.
        """
        styles = {
            "modal": {
                "background": self.design_tokens["colors"]["bg_matte"],
                "border": self.design_tokens["colors"]["border_subtle"],
                "border_radius": self.design_tokens["radius"]["md"],
                "padding": self.design_tokens["spacing"]["6"],
                "text_color": self.design_tokens["colors"]["text_primary"],
                "shadow": "0 20px 40px -10px rgba(0, 0, 0, 0.5)",
                "z_index": "9999"
            },
            "dropdown": {
                "background": self.design_tokens["colors"]["bg_matte"],
                "border": self.design_tokens["colors"]["border_emphasis"],
                "border_radius": self.design_tokens["radius"]["sm"],
                "item_padding": f"{self.design_tokens['spacing']['3']} {self.design_tokens['spacing']['4']}",
                "item_hover_bg": self.design_tokens["colors"]["bg_elevated"],
                "z_index": "9999"
            },
            "mobile_nav": {
                "background": self.design_tokens["colors"]["bg_matte"],
                "text_color": self.design_tokens["colors"]["text_primary"],
                "link_size": self.design_tokens["typography"]["scale"]["2xl"],
                "link_weight": "600",
                "link_padding": f"{self.design_tokens['spacing']['3']} {self.design_tokens['spacing']['5']}",
                "close_button_size": "48px",
                "z_index": "9999"
            },
            "button_primary": {
                "background": self.design_tokens["colors"]["accent_primary"],
                "text_color": "#000000",
                "font_weight": "600",
                "padding": f"{self.design_tokens['spacing']['4']} {self.design_tokens['spacing']['6']}",
                "border_radius": self.design_tokens["radius"]["md"],
                "min_height": "48px"
            },
            "card": {
                "background": self.design_tokens["colors"]["bg_secondary"],
                "border": self.design_tokens["colors"]["border_subtle"],
                "border_radius": self.design_tokens["radius"]["md"],
                "padding": self.design_tokens["spacing"]["6"],
                "hover_shadow": "0 20px 40px -10px rgba(0, 0, 0, 0.5)"
            }
        }
        
        return styles.get(component_type, {
            "note": f"No predefined style for '{component_type}'. Consider defining one."
        })

    def generate_css_variables(self) -> str:
        """
        Generates CSS custom properties from design tokens.
        """
        css = ":root {\n"
        css += "    /* Colors - Studio OS Dark Mode */\n"
        for name, value in self.design_tokens["colors"].items():
            css += f"    --{name.replace('_', '-')}: {value};\n"
        
        css += "\n    /* Typography */\n"
        for name, value in self.design_tokens["typography"]["scale"].items():
            css += f"    --text-{name}: {value};\n"
            
        css += "\n    /* Spacing */\n"
        for name, value in self.design_tokens["spacing"].items():
            css += f"    --space-{name}: {value};\n"
            
        css += "\n    /* Radius */\n"
        for name, value in self.design_tokens["radius"].items():
            css += f"    --radius-{name}: {value};\n"
            
        css += "}\n"
        return css

    def _hex_to_rgb(self, hex_color: str) -> str:
        """Convert hex to RGB string."""
        hex_color = hex_color.lstrip('#')
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return f"{r}, {g}, {b}"
    
    def _lighten_color(self, hex_color: str, amount: float) -> str:
        """Lighten a hex color by a percentage."""
        hex_color = hex_color.lstrip('#')
        r = min(255, int(int(hex_color[0:2], 16) + (255 * amount)))
        g = min(255, int(int(hex_color[2:4], 16) + (255 * amount)))
        b = min(255, int(int(hex_color[4:6], 16) + (255 * amount)))
        return f"#{r:02x}{g:02x}{b:02x}"

    def review_design(self, page_screenshot_path: str = None) -> Dict:
        """
        Reviews a page design and provides feedback.
        For now, returns design principles checklist.
        """
        return {
            "checklist": [
                {"item": "Visual hierarchy", "description": "Is the most important content most prominent?"},
                {"item": "Consistency", "description": "Are similar elements styled similarly?"},
                {"item": "Spacing", "description": "Is there enough whitespace?"},
                {"item": "Typography", "description": "Are font sizes, weights appropriate?"},
                {"item": "Color contrast", "description": "Is text readable on all backgrounds?"},
                {"item": "Touch targets", "description": "Are interactive elements at least 48px?"},
                {"item": "Focus states", "description": "Can keyboard users see focus?"},
                {"item": "Loading states", "description": "Are loading states defined?"},
                {"item": "Error states", "description": "Are error states styled?"},
                {"item": "Empty states", "description": "Are empty states designed?"}
            ],
            "principles": [
                "Dark mode first, light mode optional",
                "Mobile-first responsive design",
                "Micro-animations for delight",
                "Generous spacing for breathing room",
                "Accent color for emphasis, not decoration"
            ]
        }


if __name__ == "__main__":
    designer = WebDesigner()
    
    # Test color palette generation
    palette = designer.generate_color_palette()
    print("Generated Palette:")
    print(json.dumps(palette, indent=2))
    
    # Test component style suggestion
    mobile_nav_style = designer.suggest_component_style("mobile_nav")
    print("\nMobile Nav Style:")
    print(json.dumps(mobile_nav_style, indent=2))
    
    # Generate CSS variables
    css_vars = designer.generate_css_variables()
    print("\nCSS Variables:")
    print(css_vars[:500] + "...")
