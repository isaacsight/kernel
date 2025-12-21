#!/usr/bin/env python3
"""
CodeLens - AI Code Review & Improvement Agent
A powerful desktop application for AI-powered code review, improvement, and refactoring.
"""

import json
import os
import sys
import threading
import re
from pathlib import Path
from datetime import datetime
from typing import Optional, Callable
import difflib

# Install dependencies if needed
def install_deps():
    import subprocess
    deps = ["anthropic", "google-generativeai", "customtkinter", "pygments"]
    for dep in deps:
        try:
            if dep == "google-generativeai":
                __import__("google.generativeai")
            else:
                __import__(dep.replace("-", ""))
        except ImportError:
            print(f"Installing {dep}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", dep, "-q"])

install_deps()

import customtkinter as ctk
from tkinter import filedialog, messagebox
import tkinter as tk
from pygments import highlight
from pygments.lexers import get_lexer_by_name, guess_lexer, get_lexer_for_filename
from pygments.formatters import HtmlFormatter
import anthropic
import google.generativeai as genai

# Configure appearance
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# Colors
COLORS = {
    "bg_primary": "#0a0a0c",
    "bg_secondary": "#12121a",
    "bg_tertiary": "#1a1a24",
    "bg_card": "#22222e",
    "bg_hover": "#2a2a38",
    "border": "#2e2e3a",
    "border_focus": "#3e3e4a",
    "accent": "#22d3ee",
    "accent_hover": "#0891b2",
    "accent_secondary": "#8b5cf6",
    "text_primary": "#fafafa",
    "text_secondary": "#a1a1aa",
    "text_muted": "#71717a",
    "error": "#f87171",
    "warning": "#fbbf24",
    "info": "#60a5fa",
    "success": "#4ade80",
    "diff_add": "#22c55e",
    "diff_remove": "#ef4444",
}

CONFIG_PATH = Path.home() / ".codelens" / "config.json"


class AIProvider:
    """Base class for AI providers."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    def call(self, system_prompt: str, user_message: str, max_tokens: int = 4096) -> str:
        raise NotImplementedError


class AnthropicProvider(AIProvider):
    """Anthropic Claude provider."""
    
    def call(self, system_prompt: str, user_message: str, max_tokens: int = 4096) -> str:
        client = anthropic.Anthropic(api_key=self.api_key)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}]
        )
        return response.content[0].text


class GeminiProvider(AIProvider):
    """Google Gemini provider."""
    
    def call(self, system_prompt: str, user_message: str, max_tokens: int = 4096) -> str:
        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system_prompt
        )
        response = model.generate_content(user_message)
        return response.text


class AutoCompleter:
    def __init__(self, editor: ctk.CTkTextbox):
        self.ctk_textbox = editor
        self.text_widget = editor._textbox
        self.popup: Optional[tk.Toplevel] = None
        self.listbox: Optional[tk.Listbox] = None
        self.current_matches = []
        self.prefix_len = 0
        
        # Bind events to internal text widget for better control
        self.text_widget.bind("<KeyRelease>", self.on_key_release, add="+")
        self.text_widget.bind("<FocusOut>", self.hide_suggestions, add="+")
        self.text_widget.bind("<Tab>", self.on_tab_key, add="+")
        self.text_widget.bind("<Return>", self.on_enter_key, add="+")
        self.text_widget.bind("<Up>", self.on_up_row, add="+")
        self.text_widget.bind("<Down>", self.on_down_row, add="+")
        self.text_widget.bind("<Escape>", self.hide_suggestions, add="+")
        
    def on_key_release(self, event):
        if event.keysym in ("Up", "Down", "Return", "Tab", "Escape", "Shift_L", "Shift_R", "Control_L", "Control_R"):
            return
        self.check_completion()
        
    def check_completion(self):
        text_before = self.text_widget.get("insert linestart", "insert")
        match = re.search(r'(\w+)$', text_before)
        
        if not match:
            self.hide_suggestions()
            return
            
        prefix = match.group(1)
        if len(prefix) < 2:
            self.hide_suggestions()
            return
            
        # Scan entire document for completion candidates
        content = self.text_widget.get("1.0", "end-1c")
        # Find all words of length 2+
        all_words = set(re.findall(r'\b\w{2,}\b', content))
        suggestions = sorted([w for w in all_words if w.startswith(prefix) and w != prefix])
        
        if not suggestions:
            self.hide_suggestions()
            return
            
        self.show_suggestions(suggestions, prefix)
        
    def show_suggestions(self, matches, prefix):
        if not self.popup:
            self.popup = tk.Toplevel(self.text_widget)
            self.popup.wm_overrideredirect(True)
            self.popup.configure(bg=COLORS["bg_card"])
            
            self.listbox = tk.Listbox(
                self.popup, font=("Consolas", 12),
                bg=COLORS["bg_card"], fg=COLORS["text_primary"],
                selectbackground=COLORS["accent"], selectforeground=COLORS["bg_primary"],
                borderwidth=1, relief="solid", highlightthickness=0
            )
            self.listbox.pack(fill="both", expand=True)
            
        self.current_matches = matches
        self.prefix_len = len(prefix)
        
        self.listbox.delete(0, "end")
        for w in matches:
            self.listbox.insert("end", w)
        self.listbox.selection_set(0)
        
        # Calculate position
        bbox = self.text_widget.bbox("insert")
        if bbox:
            x, y, _, h = bbox
            root_x = self.text_widget.winfo_rootx() + x
            root_y = self.text_widget.winfo_rooty() + y + h
            self.popup.geometry(f"250x150+{root_x}+{root_y}")
            self.popup.deiconify()
            self.popup.lift()
            
    def hide_suggestions(self, event=None):
        if self.popup:
            self.popup.destroy()
            self.popup = None
            
    def on_tab_key(self, event):
        if self.popup:
            self.accept_suggestion()
            return "break"
            
    def on_enter_key(self, event):
        if self.popup:
            self.accept_suggestion()
            return "break"
            
    def on_up_row(self, event):
        if self.popup:
            self.listbox.event_generate("<Up>")
            return "break"
            
    def on_down_row(self, event):
        if self.popup:
            self.listbox.event_generate("<Down>")
            return "break"
            
    def accept_suggestion(self):
        if not self.popup: return
        
        sel = self.listbox.curselection()
        if not sel: return
        
        word = self.listbox.get(sel[0])
        
        # Replace prefix with word
        self.text_widget.delete(f"insert-{self.prefix_len}c", "insert")
        self.text_widget.insert("insert", word)
        self.hide_suggestions()


class DiffViewer(ctk.CTkToplevel):
    """Window for viewing and applying code diffs."""
    
    def __init__(self, parent, original: str, improved: str, on_apply: Callable):
        super().__init__(parent)
        
        self.title("Review Changes")
        self.geometry("1000x700")
        self.configure(fg_color=COLORS["bg_primary"])
        self.transient(parent)
        
        self.original = original
        self.improved = improved
        self.on_apply = on_apply
        
        self.build_ui()
        
        # Center window
        self.update_idletasks()
        x = parent.winfo_x() + (parent.winfo_width() - 1000) // 2
        y = parent.winfo_y() + (parent.winfo_height() - 700) // 2
        self.geometry(f"+{x}+{y}")
    
    def build_ui(self):
        # Header
        header = ctk.CTkFrame(self, fg_color=COLORS["bg_secondary"], height=60)
        header.pack(fill="x")
        header.pack_propagate(False)
        
        title = ctk.CTkLabel(
            header,
            text="📝 Review Proposed Changes",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color=COLORS["text_primary"]
        )
        title.pack(side="left", padx=20, pady=15)
        
        # View mode buttons
        mode_frame = ctk.CTkFrame(header, fg_color="transparent")
        mode_frame.pack(side="right", padx=20)
        
        self.view_mode = ctk.StringVar(value="split")
        
        self.split_btn = ctk.CTkButton(
            mode_frame,
            text="Split View",
            width=100,
            height=32,
            fg_color=COLORS["accent"],
            text_color=COLORS["bg_primary"],
            command=lambda: self.set_view_mode("split")
        )
        self.split_btn.pack(side="left", padx=5)
        
        self.unified_btn = ctk.CTkButton(
            mode_frame,
            text="Unified Diff",
            width=100,
            height=32,
            fg_color=COLORS["bg_card"],
            command=lambda: self.set_view_mode("unified")
        )
        self.unified_btn.pack(side="left", padx=5)
        
        # Content area
        self.content_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.content_frame.pack(fill="both", expand=True, padx=20, pady=15)
        
        self.show_split_view()
        
        # Footer with buttons
        footer = ctk.CTkFrame(self, fg_color=COLORS["bg_secondary"], height=70)
        footer.pack(fill="x", side="bottom")
        footer.pack_propagate(False)
        
        btn_frame = ctk.CTkFrame(footer, fg_color="transparent")
        btn_frame.pack(expand=True)
        
        discard_btn = ctk.CTkButton(
            btn_frame,
            text="Discard Changes",
            width=140,
            height=40,
            fg_color=COLORS["bg_card"],
            hover_color=COLORS["bg_hover"],
            command=self.destroy
        )
        discard_btn.pack(side="left", padx=10, pady=15)
        
        apply_btn = ctk.CTkButton(
            btn_frame,
            text="✓ Apply Changes",
            width=140,
            height=40,
            fg_color=COLORS["success"],
            hover_color="#16a34a",
            text_color=COLORS["bg_primary"],
            command=self.apply_changes
        )
        apply_btn.pack(side="left", padx=10, pady=15)
    
    def set_view_mode(self, mode: str):
        self.view_mode.set(mode)
        
        # Update button styles
        if mode == "split":
            self.split_btn.configure(fg_color=COLORS["accent"], text_color=COLORS["bg_primary"])
            self.unified_btn.configure(fg_color=COLORS["bg_card"], text_color=COLORS["text_primary"])
        else:
            self.unified_btn.configure(fg_color=COLORS["accent"], text_color=COLORS["bg_primary"])
            self.split_btn.configure(fg_color=COLORS["bg_card"], text_color=COLORS["text_primary"])
        
        for widget in self.content_frame.winfo_children():
            widget.destroy()
        
        if mode == "split":
            self.show_split_view()
        else:
            self.show_unified_view()
    
    def show_split_view(self):
        self.content_frame.grid_columnconfigure((0, 1), weight=1)
        self.content_frame.grid_rowconfigure(0, weight=1)
        
        # Original
        orig_frame = ctk.CTkFrame(self.content_frame, fg_color=COLORS["bg_secondary"], corner_radius=10)
        orig_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        
        orig_label = ctk.CTkLabel(
            orig_frame,
            text="Original Code",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=COLORS["error"]
        )
        orig_label.pack(pady=(15, 10))
        
        orig_text = ctk.CTkTextbox(
            orig_frame,
            font=ctk.CTkFont(family="Consolas", size=12),
            fg_color=COLORS["bg_primary"],
            text_color=COLORS["text_primary"],
            wrap="none"
        )
        orig_text.pack(fill="both", expand=True, padx=15, pady=(0, 15))
        orig_text.insert("1.0", self.original)
        orig_text.configure(state="disabled")
        
        # Improved
        new_frame = ctk.CTkFrame(self.content_frame, fg_color=COLORS["bg_secondary"], corner_radius=10)
        new_frame.grid(row=0, column=1, sticky="nsew", padx=(10, 0))
        
        new_label = ctk.CTkLabel(
            new_frame,
            text="Improved Code",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=COLORS["success"]
        )
        new_label.pack(pady=(15, 10))
        
        new_text = ctk.CTkTextbox(
            new_frame,
            font=ctk.CTkFont(family="Consolas", size=12),
            fg_color=COLORS["bg_primary"],
            text_color=COLORS["text_primary"],
            wrap="none"
        )
        new_text.pack(fill="both", expand=True, padx=15, pady=(0, 15))
        new_text.insert("1.0", self.improved)
        new_text.configure(state="disabled")
    
    def show_unified_view(self):
        diff_frame = ctk.CTkFrame(self.content_frame, fg_color=COLORS["bg_secondary"], corner_radius=10)
        diff_frame.pack(fill="both", expand=True)
        
        diff_text = ctk.CTkTextbox(
            diff_frame,
            font=ctk.CTkFont(family="Consolas", size=12),
            fg_color=COLORS["bg_primary"],
            wrap="none"
        )
        diff_text.pack(fill="both", expand=True, padx=15, pady=15)
        
        # Generate unified diff
        orig_lines = self.original.splitlines(keepends=True)
        new_lines = self.improved.splitlines(keepends=True)
        diff = difflib.unified_diff(orig_lines, new_lines, fromfile='original', tofile='improved')
        
        diff_content = ''.join(diff)
        diff_text.insert("1.0", diff_content if diff_content else "No differences found.")
        diff_text.configure(state="disabled")
    
    def apply_changes(self):
        self.on_apply(self.improved)
        self.destroy()


class ChatMessage(ctk.CTkFrame):
    """A single chat message in the AI assistant panel."""
    
    def __init__(self, parent, role: str, content: str, **kwargs):
        super().__init__(parent, fg_color="transparent", **kwargs)
        
        is_user = role == "user"
        
        # Message bubble
        bubble = ctk.CTkFrame(
            self,
            fg_color=COLORS["accent"] if is_user else COLORS["bg_card"],
            corner_radius=12
        )
        bubble.pack(
            anchor="e" if is_user else "w",
            padx=(50 if not is_user else 10, 10 if not is_user else 50),
            pady=5
        )
        
        # Role label
        role_text = "You" if is_user else "🤖 AI"
        role_label = ctk.CTkLabel(
            bubble,
            text=role_text,
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=COLORS["bg_primary"] if is_user else COLORS["text_muted"]
        )
        role_label.pack(anchor="w", padx=12, pady=(8, 2))
        
        # Content
        content_label = ctk.CTkLabel(
            bubble,
            text=content,
            font=ctk.CTkFont(size=13),
            text_color=COLORS["bg_primary"] if is_user else COLORS["text_primary"],
            wraplength=400,
            justify="left"
        )
        content_label.pack(anchor="w", padx=12, pady=(2, 10))


class CodeLensApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("CodeLens — AI Code Review & Improvement Agent")
        self.geometry("1600x950")
        self.minsize(1200, 800)
        
        self.configure(fg_color=COLORS["bg_primary"])
        
        # State
        self.anthropic_api_key = ""
        self.gemini_api_key = ""
        self.selected_provider = "anthropic"
        self.current_file = None
        self.current_language = "python"
        self.is_processing = False
        self.chat_history = []
        self.undo_stack = []
        self.redo_stack = []
        
        # Load config
        self.load_config()
        
        # Build UI
        self.build_ui()
        
        # Check for API key
        if not self.anthropic_api_key and not self.gemini_api_key:
            self.after(500, self.show_settings_dialog)
    
    def load_config(self):
        if CONFIG_PATH.exists():
            try:
                config = json.loads(CONFIG_PATH.read_text())
                self.anthropic_api_key = config.get("anthropic_api_key", "")
                self.gemini_api_key = config.get("gemini_api_key", "")
                self.selected_provider = config.get("selected_provider", "anthropic")
            except:
                pass
    
    def save_config(self):
        CONFIG_PATH.parent.mkdir(exist_ok=True)
        CONFIG_PATH.write_text(json.dumps({
            "anthropic_api_key": self.anthropic_api_key,
            "gemini_api_key": self.gemini_api_key,
            "selected_provider": self.selected_provider
        }))
    
    def get_provider(self) -> Optional[AIProvider]:
        if self.selected_provider == "anthropic" and self.anthropic_api_key:
            return AnthropicProvider(self.anthropic_api_key)
        elif self.selected_provider == "gemini" and self.gemini_api_key:
            return GeminiProvider(self.gemini_api_key)
        return None
    
    def build_ui(self):
        # Header
        self.build_header()
        
        # Main content with three panels
        self.main_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.main_frame.pack(fill="both", expand=True, padx=15, pady=(0, 15))
        
        self.main_frame.grid_columnconfigure(0, weight=3)  # Code editor
        self.main_frame.grid_columnconfigure(1, weight=2)  # Results/Chat
        self.main_frame.grid_rowconfigure(0, weight=1)
        
        # Left: Code editor panel
        self.build_editor_panel()
        
        # Right: Tabbed panel (Review Results / AI Chat)
        self.build_right_panel()
    
    def build_header(self):
        header = ctk.CTkFrame(self, fg_color=COLORS["bg_secondary"], height=65)
        header.pack(fill="x")
        header.pack_propagate(False)
        
        # Logo
        logo_frame = ctk.CTkFrame(header, fg_color="transparent")
        logo_frame.pack(side="left", padx=20, pady=12)
        
        logo_icon = ctk.CTkLabel(logo_frame, text="🔍", font=ctk.CTkFont(size=22))
        logo_icon.pack(side="left", padx=(0, 8))
        
        logo_text = ctk.CTkLabel(
            logo_frame,
            text="CodeLens",
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color=COLORS["text_primary"]
        )
        logo_text.pack(side="left")
        
        version_label = ctk.CTkLabel(
            logo_frame,
            text="Pro",
            font=ctk.CTkFont(size=10, weight="bold"),
            text_color=COLORS["accent"],
            fg_color=COLORS["bg_card"],
            corner_radius=4,
            padx=6,
            pady=2
        )
        version_label.pack(side="left", padx=(8, 0))
        
        # Right controls
        controls = ctk.CTkFrame(header, fg_color="transparent")
        controls.pack(side="right", padx=20)
        
        # Provider selector
        self.provider_var = ctk.StringVar(
            value="Claude" if self.selected_provider == "anthropic" else "Gemini"
        )
        provider_menu = ctk.CTkOptionMenu(
            controls,
            variable=self.provider_var,
            values=["Claude", "Gemini"],
            width=100,
            height=32,
            fg_color=COLORS["bg_card"],
            button_color=COLORS["bg_card"],
            button_hover_color=COLORS["bg_hover"],
            dropdown_fg_color=COLORS["bg_card"],
            command=self.on_provider_change
        )
        provider_menu.pack(side="left", padx=10)
        
        # Settings button
        settings_btn = ctk.CTkButton(
            controls,
            text="⚙️",
            width=40,
            height=32,
            fg_color=COLORS["bg_card"],
            hover_color=COLORS["bg_hover"],
            command=self.show_settings_dialog
        )
        settings_btn.pack(side="left", padx=5)
        
        # Status
        self.status_frame = ctk.CTkFrame(controls, fg_color=COLORS["bg_card"], corner_radius=16)
        self.status_frame.pack(side="left", padx=(10, 0))
        
        self.status_dot = ctk.CTkLabel(
            self.status_frame, text="●", font=ctk.CTkFont(size=10),
            text_color=COLORS["success"]
        )
        self.status_dot.pack(side="left", padx=(12, 4), pady=6)
        
        self.status_text = ctk.CTkLabel(
            self.status_frame, text="Ready",
            font=ctk.CTkFont(size=12), text_color=COLORS["text_secondary"]
        )
        self.status_text.pack(side="left", padx=(0, 12), pady=6)
    
    def build_editor_panel(self):
        panel = ctk.CTkFrame(self.main_frame, fg_color=COLORS["bg_secondary"], corner_radius=12)
        panel.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        
        # Toolbar
        toolbar = ctk.CTkFrame(panel, fg_color=COLORS["bg_tertiary"], height=50)
        toolbar.pack(fill="x")
        toolbar.pack_propagate(False)
        
        # File controls
        file_frame = ctk.CTkFrame(toolbar, fg_color="transparent")
        file_frame.pack(side="left", padx=10, pady=8)
        
        open_btn = ctk.CTkButton(
            file_frame, text="📁 Open", width=80, height=34,
            fg_color=COLORS["bg_card"], hover_color=COLORS["bg_hover"],
            command=self.open_file
        )
        open_btn.pack(side="left", padx=3)
        
        open_folder_btn = ctk.CTkButton(
            file_frame, text="📂 Folder", width=80, height=34,
            fg_color=COLORS["bg_card"], hover_color=COLORS["bg_hover"],
            command=self.open_folder
        )
        open_folder_btn.pack(side="left", padx=3)
        
        save_btn = ctk.CTkButton(
            file_frame, text="💾 Save", width=80, height=34,
            fg_color=COLORS["bg_card"], hover_color=COLORS["bg_hover"],
            command=self.save_file
        )
        save_btn.pack(side="left", padx=3)
        
        # Undo/Redo
        edit_frame = ctk.CTkFrame(toolbar, fg_color="transparent")
        edit_frame.pack(side="left", padx=10)
        
        self.undo_btn = ctk.CTkButton(
            edit_frame, text="↶", width=34, height=34,
            fg_color=COLORS["bg_card"], hover_color=COLORS["bg_hover"],
            command=self.undo, state="disabled"
        )
        self.undo_btn.pack(side="left", padx=2)
        
        self.redo_btn = ctk.CTkButton(
            edit_frame, text="↷", width=34, height=34,
            fg_color=COLORS["bg_card"], hover_color=COLORS["bg_hover"],
            command=self.redo, state="disabled"
        )
        self.redo_btn.pack(side="left", padx=2)
        
        # File info
        self.file_label = ctk.CTkLabel(
            toolbar, text="No file open",
            font=ctk.CTkFont(size=12), text_color=COLORS["text_muted"]
        )
        self.file_label.pack(side="right", padx=15)
        
        # Code editor
        editor_frame = ctk.CTkFrame(panel, fg_color="transparent")
        editor_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Line numbers + editor container
        self.editor_container = ctk.CTkFrame(editor_frame, fg_color=COLORS["bg_primary"], corner_radius=8)
        self.editor_container.pack(fill="both", expand=True)
        
        self.code_editor = ctk.CTkTextbox(
            self.editor_container,
            font=ctk.CTkFont(family="Consolas", size=13),
            fg_color=COLORS["bg_primary"],
            text_color=COLORS["text_primary"],
            wrap="none",
            undo=True
        )
        self.code_editor.pack(fill="both", expand=True, padx=5, pady=5)
        self.code_editor.insert("1.0", "# Paste your code here or open a file\n# Then use the action buttons below to:\n#   🔍 Review - Find issues and get suggestions\n#   ✨ Improve - Auto-fix and enhance code\n#   🔧 Refactor - Restructure and optimize\n#   💡 Explain - Understand what code does\n#   💬 Chat - Ask questions about your code\n\ndef example():\n    pass\n")
        
        # Initialize AutoCompleter
        self.autocompleter = AutoCompleter(self.code_editor)

        
        # Action buttons bar
        actions = ctk.CTkFrame(panel, fg_color=COLORS["bg_tertiary"], height=60)
        actions.pack(fill="x", side="bottom")
        actions.pack_propagate(False)
        
        actions_inner = ctk.CTkFrame(actions, fg_color="transparent")
        actions_inner.pack(expand=True, pady=10)
        
        # Review button
        self.review_btn = ctk.CTkButton(
            actions_inner,
            text="🔍 Review Code",
            width=130, height=40,
            fg_color=COLORS["accent"],
            hover_color=COLORS["accent_hover"],
            text_color=COLORS["bg_primary"],
            font=ctk.CTkFont(size=13, weight="bold"),
            command=self.run_review
        )
        self.review_btn.pack(side="left", padx=5)
        
        # Improve button
        self.improve_btn = ctk.CTkButton(
            actions_inner,
            text="✨ Improve Code",
            width=130, height=40,
            fg_color=COLORS["accent_secondary"],
            hover_color="#7c3aed",
            text_color=COLORS["text_primary"],
            font=ctk.CTkFont(size=13, weight="bold"),
            command=self.run_improve
        )
        self.improve_btn.pack(side="left", padx=5)
        
        # Refactor button
        self.refactor_btn = ctk.CTkButton(
            actions_inner,
            text="🔧 Refactor",
            width=110, height=40,
            fg_color=COLORS["bg_card"],
            hover_color=COLORS["bg_hover"],
            font=ctk.CTkFont(size=13),
            command=self.show_refactor_menu
        )
        self.refactor_btn.pack(side="left", padx=5)
        
        # Explain button
        self.explain_btn = ctk.CTkButton(
            actions_inner,
            text="💡 Explain",
            width=100, height=40,
            fg_color=COLORS["bg_card"],
            hover_color=COLORS["bg_hover"],
            font=ctk.CTkFont(size=13),
            command=self.run_explain
        )
        self.explain_btn.pack(side="left", padx=5)
    
    def build_right_panel(self):
        panel = ctk.CTkFrame(self.main_frame, fg_color=COLORS["bg_secondary"], corner_radius=12)
        panel.grid(row=0, column=1, sticky="nsew")
        
        # Tab buttons
        tab_frame = ctk.CTkFrame(panel, fg_color=COLORS["bg_tertiary"], height=50)
        tab_frame.pack(fill="x")
        tab_frame.pack_propagate(False)
        
        self.current_tab = ctk.StringVar(value="review")
        
        self.tab_review_btn = ctk.CTkButton(
            tab_frame, text="📋 Review Results", width=140, height=36,
            fg_color=COLORS["accent"], text_color=COLORS["bg_primary"],
            command=lambda: self.switch_tab("review")
        )
        self.tab_review_btn.pack(side="left", padx=(10, 5), pady=7)
        
        self.tab_chat_btn = ctk.CTkButton(
            tab_frame, text="💬 AI Chat", width=100, height=36,
            fg_color=COLORS["bg_card"], hover_color=COLORS["bg_hover"],
            command=lambda: self.switch_tab("chat")
        )
        self.tab_chat_btn.pack(side="left", padx=5, pady=7)
        
        # Content area
        self.right_content = ctk.CTkFrame(panel, fg_color="transparent")
        self.right_content.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Build both tabs
        self.build_review_tab()
        self.build_chat_tab()
        
        # Show review tab by default
        self.chat_frame.pack_forget()
    
    def build_review_tab(self):
        self.review_frame = ctk.CTkFrame(self.right_content, fg_color="transparent")
        self.review_frame.pack(fill="both", expand=True)
        
        # Scrollable results
        self.results_scroll = ctk.CTkScrollableFrame(
            self.review_frame, fg_color="transparent"
        )
        self.results_scroll.pack(fill="both", expand=True)
        
        # Placeholder
        self.show_review_placeholder()
    
    def build_chat_tab(self):
        self.chat_frame = ctk.CTkFrame(self.right_content, fg_color="transparent")
        self.chat_frame.pack(fill="both", expand=True)
        
        # Chat messages area
        self.chat_scroll = ctk.CTkScrollableFrame(
            self.chat_frame, fg_color="transparent"
        )
        self.chat_scroll.pack(fill="both", expand=True, pady=(0, 10))
        
        # Input area
        input_frame = ctk.CTkFrame(self.chat_frame, fg_color=COLORS["bg_card"], corner_radius=10)
        input_frame.pack(fill="x")
        
        self.chat_input = ctk.CTkTextbox(
            input_frame, height=60,
            font=ctk.CTkFont(size=13),
            fg_color=COLORS["bg_primary"],
            text_color=COLORS["text_primary"],
            wrap="word"
        )
        self.chat_input.pack(fill="x", padx=10, pady=(10, 5))
        self.chat_input.insert("1.0", "Ask about your code...")
        self.chat_input.bind("<FocusIn>", self.on_chat_focus)
        self.chat_input.bind("<Control-Return>", lambda e: self.send_chat_message())
        
        send_btn = ctk.CTkButton(
            input_frame, text="Send (Ctrl+Enter)", width=130, height=35,
            fg_color=COLORS["accent"], hover_color=COLORS["accent_hover"],
            text_color=COLORS["bg_primary"],
            command=self.send_chat_message
        )
        send_btn.pack(anchor="e", padx=10, pady=(0, 10))
    
    def switch_tab(self, tab: str):
        self.current_tab.set(tab)
        
        if tab == "review":
            self.tab_review_btn.configure(fg_color=COLORS["accent"], text_color=COLORS["bg_primary"])
            self.tab_chat_btn.configure(fg_color=COLORS["bg_card"], text_color=COLORS["text_primary"])
            self.chat_frame.pack_forget()
            self.review_frame.pack(fill="both", expand=True)
        else:
            self.tab_chat_btn.configure(fg_color=COLORS["accent"], text_color=COLORS["bg_primary"])
            self.tab_review_btn.configure(fg_color=COLORS["bg_card"], text_color=COLORS["text_primary"])
            self.review_frame.pack_forget()
            self.chat_frame.pack(fill="both", expand=True)
    
    def show_review_placeholder(self):
        for widget in self.results_scroll.winfo_children():
            widget.destroy()
        
        placeholder = ctk.CTkFrame(self.results_scroll, fg_color="transparent")
        placeholder.pack(expand=True, pady=100)
        
        icon = ctk.CTkLabel(placeholder, text="📋", font=ctk.CTkFont(size=48))
        icon.pack(pady=(0, 10))
        
        text = ctk.CTkLabel(
            placeholder, text="Click 'Review Code' to analyze your code",
            font=ctk.CTkFont(size=14), text_color=COLORS["text_muted"]
        )
        text.pack()
    
    def show_loading(self, message: str = "Processing..."):
        for widget in self.results_scroll.winfo_children():
            widget.destroy()
        
        loading = ctk.CTkFrame(self.results_scroll, fg_color="transparent")
        loading.pack(expand=True, pady=100)
        
        spinner = ctk.CTkLabel(loading, text="⏳", font=ctk.CTkFont(size=48))
        spinner.pack(pady=(0, 10))
        
        text = ctk.CTkLabel(
            loading, text=message,
            font=ctk.CTkFont(size=14), text_color=COLORS["text_secondary"]
        )
        text.pack()
    
    def set_status(self, text: str, color: str = None):
        self.status_text.configure(text=text)
        if color:
            self.status_dot.configure(text_color=color)
    
    def on_provider_change(self, value: str):
        self.selected_provider = "anthropic" if value == "Claude" else "gemini"
        self.save_config()
    
    def on_chat_focus(self, event):
        content = self.chat_input.get("1.0", "end").strip()
        if content == "Ask about your code...":
            self.chat_input.delete("1.0", "end")
    
    # ==================== FILE OPERATIONS ====================
    
    def open_file(self):
        filetypes = [
            ("All Code Files", "*.py *.js *.ts *.jsx *.tsx *.java *.cpp *.c *.go *.rs *.rb *.php *.html *.css"),
            ("Python", "*.py"), ("JavaScript", "*.js *.ts *.jsx *.tsx"),
            ("All Files", "*.*")
        ]
        path = filedialog.askopenfilename(filetypes=filetypes)
        if path:
            try:
                content = Path(path).read_text(errors='ignore')
                self.code_editor.delete("1.0", "end")
                self.code_editor.insert("1.0", content)
                self.current_file = path
                self.file_label.configure(text=Path(path).name)
                
                # Detect language
                try:
                    lexer = get_lexer_for_filename(path)
                    self.current_language = lexer.name.lower()
                except:
                    self.current_language = "text"
                
                self.undo_stack.clear()
                self.redo_stack.clear()
                self.update_undo_buttons()
            except Exception as e:
                messagebox.showerror("Error", f"Could not open file: {e}")
    
    def open_folder(self):
        path = filedialog.askdirectory()
        if path:
            extensions = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php'}
            content_parts = []
            
            folder = Path(path)
            for file in folder.rglob("*"):
                if file.suffix in extensions and '.git' not in str(file) and 'node_modules' not in str(file):
                    try:
                        text = file.read_text(errors='ignore')
                        rel_path = file.relative_to(folder)
                        content_parts.append(f"# ===== {rel_path} =====\n{text}")
                    except:
                        pass
            
            if content_parts:
                self.code_editor.delete("1.0", "end")
                self.code_editor.insert("1.0", "\n\n".join(content_parts))
                self.current_file = path
                self.file_label.configure(text=f"📂 {folder.name} ({len(content_parts)} files)")
            else:
                messagebox.showinfo("Info", "No code files found in folder.")
    
    def save_file(self):
        if not self.current_file or Path(self.current_file).is_dir():
            path = filedialog.asksaveasfilename(
                defaultextension=".py",
                filetypes=[("Python", "*.py"), ("JavaScript", "*.js"), ("All Files", "*.*")]
            )
            if not path:
                return
            self.current_file = path
            self.file_label.configure(text=Path(path).name)
        
        try:
            content = self.code_editor.get("1.0", "end-1c")
            Path(self.current_file).write_text(content)
            self.set_status("Saved", COLORS["success"])
        except Exception as e:
            messagebox.showerror("Error", f"Could not save file: {e}")
    
    def push_undo(self):
        content = self.code_editor.get("1.0", "end-1c")
        self.undo_stack.append(content)
        self.redo_stack.clear()
        self.update_undo_buttons()
    
    def undo(self):
        if self.undo_stack:
            current = self.code_editor.get("1.0", "end-1c")
            self.redo_stack.append(current)
            previous = self.undo_stack.pop()
            self.code_editor.delete("1.0", "end")
            self.code_editor.insert("1.0", previous)
            self.update_undo_buttons()
    
    def redo(self):
        if self.redo_stack:
            current = self.code_editor.get("1.0", "end-1c")
            self.undo_stack.append(current)
            next_state = self.redo_stack.pop()
            self.code_editor.delete("1.0", "end")
            self.code_editor.insert("1.0", next_state)
            self.update_undo_buttons()
    
    def update_undo_buttons(self):
        self.undo_btn.configure(state="normal" if self.undo_stack else "disabled")
        self.redo_btn.configure(state="normal" if self.redo_stack else "disabled")
    
    # ==================== AI OPERATIONS ====================
    
    def get_code(self) -> str:
        return self.code_editor.get("1.0", "end-1c").strip()
    
    def run_in_thread(self, func: Callable, *args):
        thread = threading.Thread(target=func, args=args)
        thread.start()
    
    def run_review(self):
        code = self.get_code()
        if not code:
            messagebox.showwarning("Warning", "Please enter some code to review.")
            return
        
        provider = self.get_provider()
        if not provider:
            self.show_settings_dialog()
            return
        
        self.switch_tab("review")
        self.is_processing = True
        self.set_status("Reviewing...", COLORS["warning"])
        self.show_loading("Analyzing code...")
        
        self.run_in_thread(self._do_review, code, provider)
    
    def _do_review(self, code: str, provider: AIProvider):
        system_prompt = """You are an expert code review agent. Perform a comprehensive code review covering security, performance, code style, potential bugs, and best practices.

Respond with a JSON object in this exact format:
{
    "summary": {
        "errors": <number>,
        "warnings": <number>,
        "info": <number>,
        "score": <number 0-100>,
        "overview": "<brief 1-2 sentence summary>"
    },
    "issues": [
        {
            "severity": "error" | "warning" | "info" | "success",
            "category": "<category>",
            "line": <line number or null>,
            "message": "<description>",
            "suggestion": "<code fix or null>"
        }
    ]
}

Include positive feedback with severity "success" for good practices.
DO NOT include any text outside the JSON object."""

        try:
            result_text = provider.call(system_prompt, f"Review this code:\n\n```\n{code}\n```")
            result_text = result_text.replace('```json', '').replace('```', '').strip()
            result = json.loads(result_text)
            self.after(0, lambda: self._show_review_results(result))
        except Exception as e:
            self.after(0, lambda: self._show_error(str(e)))
    
    def _show_review_results(self, result: dict):
        self.is_processing = False
        self.set_status("Review complete", COLORS["success"])
        
        for widget in self.results_scroll.winfo_children():
            widget.destroy()
        
        summary = result.get("summary", {})
        issues = result.get("issues", [])
        
        # Summary cards
        summary_frame = ctk.CTkFrame(self.results_scroll, fg_color="transparent")
        summary_frame.pack(fill="x", pady=(0, 15))
        
        score = summary.get("score", 0)
        score_color = COLORS["success"] if score >= 80 else COLORS["warning"] if score >= 60 else COLORS["error"]
        
        cards_data = [
            ("Errors", summary.get("errors", 0), COLORS["error"]),
            ("Warnings", summary.get("warnings", 0), COLORS["warning"]),
            ("Info", summary.get("info", 0), COLORS["info"]),
            ("Score", score, score_color),
        ]
        
        for label, value, color in cards_data:
            card = ctk.CTkFrame(summary_frame, fg_color=COLORS["bg_card"], corner_radius=8, width=80)
            card.pack(side="left", expand=True, fill="x", padx=3)
            
            val_label = ctk.CTkLabel(card, text=str(value), font=ctk.CTkFont(size=24, weight="bold"), text_color=color)
            val_label.pack(pady=(10, 0))
            
            name_label = ctk.CTkLabel(card, text=label, font=ctk.CTkFont(size=10), text_color=COLORS["text_muted"])
            name_label.pack(pady=(0, 10))
        
        # Overview
        if summary.get("overview"):
            overview = ctk.CTkLabel(
                self.results_scroll, text=summary["overview"],
                font=ctk.CTkFont(size=12), text_color=COLORS["text_secondary"],
                wraplength=400
            )
            overview.pack(pady=(0, 15))
        
        # Issues
        for issue in issues:
            self._create_issue_card(issue)
    
    def _create_issue_card(self, issue: dict):
        card = ctk.CTkFrame(self.results_scroll, fg_color=COLORS["bg_card"], corner_radius=8)
        card.pack(fill="x", pady=4)
        
        severity = issue.get("severity", "info")
        colors = {"error": COLORS["error"], "warning": COLORS["warning"], "info": COLORS["info"], "success": COLORS["success"]}
        color = colors.get(severity, COLORS["info"])
        
        # Header
        header = ctk.CTkFrame(card, fg_color="transparent")
        header.pack(fill="x", padx=12, pady=(10, 5))
        
        badge = ctk.CTkLabel(header, text=severity.upper(), font=ctk.CTkFont(size=10, weight="bold"), text_color=color)
        badge.pack(side="left")
        
        category = ctk.CTkLabel(header, text=f" • {issue.get('category', '')}", font=ctk.CTkFont(size=11), text_color=COLORS["text_muted"])
        category.pack(side="left")
        
        if issue.get("line"):
            line_label = ctk.CTkLabel(header, text=f"Line {issue['line']}", font=ctk.CTkFont(family="Consolas", size=10), text_color=COLORS["text_muted"])
            line_label.pack(side="right")
        
        # Message
        msg = ctk.CTkLabel(card, text=issue.get("message", ""), font=ctk.CTkFont(size=12), text_color=COLORS["text_primary"], wraplength=380, justify="left", anchor="w")
        msg.pack(fill="x", padx=12, pady=(0, 8))
        
        # Suggestion
        if issue.get("suggestion"):
            suggestion_frame = ctk.CTkFrame(card, fg_color=COLORS["bg_tertiary"], corner_radius=6)
            suggestion_frame.pack(fill="x", padx=12, pady=(0, 10))
            
            suggestion_text = ctk.CTkLabel(
                suggestion_frame, text=issue["suggestion"],
                font=ctk.CTkFont(family="Consolas", size=11), text_color=COLORS["accent"],
                wraplength=360, justify="left", anchor="w"
            )
            suggestion_text.pack(padx=10, pady=8)
    
    def run_improve(self):
        code = self.get_code()
        if not code:
            messagebox.showwarning("Warning", "Please enter some code to improve.")
            return
        
        provider = self.get_provider()
        if not provider:
            self.show_settings_dialog()
            return
        
        self.switch_tab("review")
        self.is_processing = True
        self.set_status("Improving...", COLORS["warning"])
        self.show_loading("Improving code...")
        
        self.run_in_thread(self._do_improve, code, provider)
    
    def _do_improve(self, code: str, provider: AIProvider):
        system_prompt = """You are an expert code improvement agent. Improve the given code by:
- Fixing any bugs or issues
- Improving performance where possible
- Enhancing readability and code style
- Adding helpful comments where appropriate
- Following best practices for the language

Return ONLY the improved code, no explanations. Keep the same overall structure and functionality."""

        try:
            improved = provider.call(system_prompt, f"Improve this code:\n\n```\n{code}\n```")
            # Clean markdown code blocks
            improved = re.sub(r'^```\w*\n?', '', improved)
            improved = re.sub(r'\n?```$', '', improved)
            improved = improved.strip()
            
            self.after(0, lambda: self._show_diff(code, improved))
        except Exception as e:
            self.after(0, lambda: self._show_error(str(e)))
    
    def _show_diff(self, original: str, improved: str):
        self.is_processing = False
        self.set_status("Review changes", COLORS["info"])
        
        def apply_changes(new_code: str):
            self.push_undo()
            self.code_editor.delete("1.0", "end")
            self.code_editor.insert("1.0", new_code)
            self.set_status("Changes applied", COLORS["success"])
        
        DiffViewer(self, original, improved, apply_changes)
    
    def show_refactor_menu(self):
        menu = ctk.CTkToplevel(self)
        menu.title("Refactor Options")
        menu.geometry("300x400")
        menu.configure(fg_color=COLORS["bg_secondary"])
        menu.transient(self)
        menu.grab_set()
        
        # Center
        menu.update_idletasks()
        x = self.winfo_x() + (self.winfo_width() - 300) // 2
        y = self.winfo_y() + (self.winfo_height() - 400) // 2
        menu.geometry(f"+{x}+{y}")
        
        title = ctk.CTkLabel(menu, text="🔧 Refactor Options", font=ctk.CTkFont(size=16, weight="bold"))
        title.pack(pady=(20, 15))
        
        options = [
            ("Extract Function", "Extract selected code into a new function"),
            ("Rename Variables", "Improve variable names for clarity"),
            ("Add Type Hints", "Add type annotations (Python)"),
            ("Optimize Imports", "Clean up and organize imports"),
            ("Add Documentation", "Generate docstrings and comments"),
            ("Simplify Logic", "Simplify complex conditionals"),
            ("Convert to Modern Syntax", "Use modern language features"),
        ]
        
        for opt_name, opt_desc in options:
            btn = ctk.CTkButton(
                menu, text=opt_name, width=260, height=40,
                fg_color=COLORS["bg_card"], hover_color=COLORS["bg_hover"],
                anchor="w", font=ctk.CTkFont(size=13),
                command=lambda n=opt_name, m=menu: self._run_refactor(n, m)
            )
            btn.pack(pady=4)
    
    def _run_refactor(self, refactor_type: str, menu_window):
        menu_window.destroy()
        
        code = self.get_code()
        if not code:
            return
        
        provider = self.get_provider()
        if not provider:
            self.show_settings_dialog()
            return
        
        self.switch_tab("review")
        self.is_processing = True
        self.set_status(f"Refactoring: {refactor_type}...", COLORS["warning"])
        self.show_loading(f"Applying: {refactor_type}...")
        
        self.run_in_thread(self._do_refactor, code, refactor_type, provider)
    
    def _do_refactor(self, code: str, refactor_type: str, provider: AIProvider):
        prompts = {
            "Extract Function": "Extract logical sections of the code into well-named functions. Keep the same functionality.",
            "Rename Variables": "Rename variables to be more descriptive and follow naming conventions. Keep the same functionality.",
            "Add Type Hints": "Add Python type hints to all function parameters and return values. Keep the same functionality.",
            "Optimize Imports": "Organize and optimize the imports. Remove unused imports, sort them properly. Keep the same functionality.",
            "Add Documentation": "Add comprehensive docstrings to all functions and classes. Add helpful inline comments. Keep the same functionality.",
            "Simplify Logic": "Simplify complex conditionals and logic. Make the code more readable. Keep the same functionality.",
            "Convert to Modern Syntax": "Convert the code to use modern language features and syntax. Use f-strings, walrus operator, match statements, etc where appropriate. Keep the same functionality.",
        }
        
        system_prompt = f"""You are an expert code refactoring agent. Your task: {prompts.get(refactor_type, 'Improve the code.')}

Return ONLY the refactored code, no explanations."""

        try:
            improved = provider.call(system_prompt, f"Refactor this code:\n\n```\n{code}\n```")
            improved = re.sub(r'^```\w*\n?', '', improved)
            improved = re.sub(r'\n?```$', '', improved)
            improved = improved.strip()
            
            self.after(0, lambda: self._show_diff(code, improved))
        except Exception as e:
            self.after(0, lambda: self._show_error(str(e)))
    
    def run_explain(self):
        code = self.get_code()
        if not code:
            messagebox.showwarning("Warning", "Please enter some code to explain.")
            return
        
        provider = self.get_provider()
        if not provider:
            self.show_settings_dialog()
            return
        
        self.switch_tab("chat")
        self.add_chat_message("user", "Explain this code to me")
        self.run_in_thread(self._do_explain, code, provider)
    
    def _do_explain(self, code: str, provider: AIProvider):
        system_prompt = """You are a helpful coding assistant. Explain the given code in a clear, educational way.
Cover:
- What the code does overall
- Key functions/classes and their purposes
- Any notable patterns or techniques used
- Potential issues or improvements

Be concise but thorough."""

        try:
            explanation = provider.call(system_prompt, f"Explain this code:\n\n```\n{code}\n```")
            self.after(0, lambda: self.add_chat_message("assistant", explanation))
        except Exception as e:
            self.after(0, lambda: self.add_chat_message("assistant", f"Error: {e}"))
    
    def send_chat_message(self):
        message = self.chat_input.get("1.0", "end").strip()
        if not message or message == "Ask about your code...":
            return
        
        provider = self.get_provider()
        if not provider:
            self.show_settings_dialog()
            return
        
        self.chat_input.delete("1.0", "end")
        self.add_chat_message("user", message)
        
        code = self.get_code()
        self.run_in_thread(self._do_chat, message, code, provider)
    
    def _do_chat(self, message: str, code: str, provider: AIProvider):
        system_prompt = """You are a helpful coding assistant. The user has code open in their editor and is asking questions about it.
Be helpful, concise, and provide code examples when relevant.
If they ask you to modify code, provide the complete modified version."""

        context = f"Current code in editor:\n```\n{code}\n```\n\nUser question: {message}" if code else message

        try:
            response = provider.call(system_prompt, context)
            self.after(0, lambda: self.add_chat_message("assistant", response))
        except Exception as e:
            self.after(0, lambda: self.add_chat_message("assistant", f"Error: {e}"))
    
    def add_chat_message(self, role: str, content: str):
        msg = ChatMessage(self.chat_scroll, role, content)
        msg.pack(fill="x", pady=2)
        self.chat_history.append({"role": role, "content": content})
        
        # Scroll to bottom
        self.chat_scroll._parent_canvas.yview_moveto(1.0)
    
    def _show_error(self, error: str):
        self.is_processing = False
        self.set_status("Error", COLORS["error"])
        
        for widget in self.results_scroll.winfo_children():
            widget.destroy()
        
        error_frame = ctk.CTkFrame(self.results_scroll, fg_color="transparent")
        error_frame.pack(expand=True, pady=100)
        
        icon = ctk.CTkLabel(error_frame, text="⚠️", font=ctk.CTkFont(size=48))
        icon.pack(pady=(0, 10))
        
        text = ctk.CTkLabel(error_frame, text=f"Error: {error}", font=ctk.CTkFont(size=13), text_color=COLORS["error"], wraplength=350)
        text.pack()
        
        if "api" in error.lower() or "key" in error.lower():
            fix_btn = ctk.CTkButton(error_frame, text="Update API Keys", fg_color=COLORS["bg_card"], command=self.show_settings_dialog)
            fix_btn.pack(pady=(15, 0))
    
    def show_settings_dialog(self):
        dialog = ctk.CTkToplevel(self)
        dialog.title("Settings")
        dialog.geometry("500x450")
        dialog.configure(fg_color=COLORS["bg_secondary"])
        dialog.transient(self)
        dialog.grab_set()
        
        dialog.update_idletasks()
        x = self.winfo_x() + (self.winfo_width() - 500) // 2
        y = self.winfo_y() + (self.winfo_height() - 450) // 2
        dialog.geometry(f"+{x}+{y}")
        
        title = ctk.CTkLabel(dialog, text="🔑 API Configuration", font=ctk.CTkFont(size=18, weight="bold"))
        title.pack(pady=(25, 5))
        
        desc = ctk.CTkLabel(dialog, text="Enter API keys for the providers you want to use", font=ctk.CTkFont(size=12), text_color=COLORS["text_secondary"])
        desc.pack(pady=(0, 20))
        
        # Anthropic
        anthropic_frame = ctk.CTkFrame(dialog, fg_color=COLORS["bg_card"], corner_radius=10)
        anthropic_frame.pack(fill="x", padx=30, pady=(0, 10))
        
        ctk.CTkLabel(anthropic_frame, text="🟠 Anthropic Claude", font=ctk.CTkFont(size=14, weight="bold"), text_color=COLORS["accent"]).pack(anchor="w", padx=15, pady=(12, 5))
        ctk.CTkLabel(anthropic_frame, text="console.anthropic.com", font=ctk.CTkFont(size=10), text_color=COLORS["text_muted"]).pack(anchor="w", padx=15)
        
        anthropic_entry = ctk.CTkEntry(anthropic_frame, width=410, height=40, placeholder_text="sk-ant-api...", font=ctk.CTkFont(family="Consolas", size=12), fg_color=COLORS["bg_primary"], show="•")
        anthropic_entry.pack(padx=15, pady=(8, 15))
        if self.anthropic_api_key:
            anthropic_entry.insert(0, self.anthropic_api_key)
        
        # Gemini
        gemini_frame = ctk.CTkFrame(dialog, fg_color=COLORS["bg_card"], corner_radius=10)
        gemini_frame.pack(fill="x", padx=30, pady=(0, 10))
        
        ctk.CTkLabel(gemini_frame, text="🔵 Google Gemini", font=ctk.CTkFont(size=14, weight="bold"), text_color="#4285f4").pack(anchor="w", padx=15, pady=(12, 5))
        ctk.CTkLabel(gemini_frame, text="aistudio.google.com", font=ctk.CTkFont(size=10), text_color=COLORS["text_muted"]).pack(anchor="w", padx=15)
        
        gemini_entry = ctk.CTkEntry(gemini_frame, width=410, height=40, placeholder_text="AIza...", font=ctk.CTkFont(family="Consolas", size=12), fg_color=COLORS["bg_primary"], show="•")
        gemini_entry.pack(padx=15, pady=(8, 15))
        if self.gemini_api_key:
            gemini_entry.insert(0, self.gemini_api_key)
        
        # Default provider
        default_frame = ctk.CTkFrame(dialog, fg_color="transparent")
        default_frame.pack(fill="x", padx=30, pady=15)
        
        ctk.CTkLabel(default_frame, text="Default Provider:", font=ctk.CTkFont(size=12), text_color=COLORS["text_muted"]).pack(side="left")
        
        default_var = ctk.StringVar(value="Claude" if self.selected_provider == "anthropic" else "Gemini")
        default_menu = ctk.CTkOptionMenu(default_frame, variable=default_var, values=["Claude", "Gemini"], width=120, fg_color=COLORS["bg_card"])
        default_menu.pack(side="left", padx=(10, 0))
        
        # Buttons
        btn_frame = ctk.CTkFrame(dialog, fg_color="transparent")
        btn_frame.pack(fill="x", padx=30, pady=(10, 20))
        
        def save():
            self.anthropic_api_key = anthropic_entry.get().strip()
            self.gemini_api_key = gemini_entry.get().strip()
            self.selected_provider = "anthropic" if default_var.get() == "Claude" else "gemini"
            self.provider_var.set(default_var.get())
            self.save_config()
            dialog.destroy()
            self.set_status("Ready", COLORS["success"])
        
        ctk.CTkButton(btn_frame, text="Cancel", width=100, height=38, fg_color=COLORS["bg_card"], command=dialog.destroy).pack(side="left")
        ctk.CTkButton(btn_frame, text="Save", width=100, height=38, fg_color=COLORS["accent"], text_color=COLORS["bg_primary"], command=save).pack(side="right")


if __name__ == "__main__":
    app = CodeLensApp()
    app.mainloop()
