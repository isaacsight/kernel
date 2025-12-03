from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical, Grid
from textual.widgets import Header, Footer, Button, Static, ListView, ListItem, Label, Input, TextArea, Markdown, Select, Log, TabbedContent, TabPane
from textual.screen import Screen, ModalScreen
from textual.binding import Binding
import core
import os
import datetime

# Import Engineers for direct interaction
from engineers.guardian import Guardian
from engineers.editor import Editor
from engineers.librarian import Librarian

class AgentCard(Static):
    """A widget to display agent status and actions."""
    def __init__(self, name, role, icon="🤖", status="Idle"):
        super().__init__()
        self.agent_name = name
        self.agent_role = role
        self.agent_icon = icon
        self.agent_status = status

    def compose(self) -> ComposeResult:
        yield Label(f"{self.agent_icon} {self.agent_name}", classes="agent-name")
        yield Label(self.agent_role, classes="agent-role")
        yield Label(f"Status: {self.agent_status}", classes="agent-status", id=f"status-{self.agent_name.lower().replace(' ', '-')}")
        yield Container(id=f"actions-{self.agent_name.lower().replace(' ', '-')}", classes="agent-actions")

class PostListItem(ListItem):
    def __init__(self, post):
        super().__init__()
        self.post = post

    def compose(self) -> ComposeResult:
        title = self.post.get('title', 'Untitled')
        date = self.post.get('date', 'No Date')
        yield Label(f"{title} ({date})")

class EditorScreen(Screen):
    BINDINGS = [("escape", "app.pop_screen", "Cancel"), ("ctrl+s", "save_post", "Save")]

    def __init__(self, post=None):
        super().__init__()
        self.post = post or {}
        self.filename = self.post.get('filename')

    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Input(placeholder="Title", value=self.post.get('title', ''), id="title"),
            Input(placeholder="Date (YYYY-MM-DD)", value=str(self.post.get('date', '')), id="date"),
            Input(placeholder="Category", value=self.post.get('category', ''), id="category"),
            Input(placeholder="Tags (comma separated)", value=str(self.post.get('tags', '')), id="tags"),
            TextArea(self.post.get('content', ''), id="content", show_line_numbers=True),
            id="editor-container"
        )
        yield Footer()

    def action_save_post(self):
        title = self.query_one("#title", Input).value
        date = self.query_one("#date", Input).value
        category = self.query_one("#category", Input).value
        tags = self.query_one("#tags", Input).value
        content = self.query_one("#content", TextArea).text
        
        core.save_post(self.filename, title, date, category, tags, content)
        self.app.pop_screen()
        self.app.notify("Post saved!")

class AIGenerationModal(ModalScreen):
    def compose(self) -> ComposeResult:
        yield Container(
            Label("Commission The Alchemist"),
            Label("Topic:", classes="label"),
            Input(placeholder="Enter a topic...", id="topic"),
            Label("Model Provider:", classes="label"),
            Select([("Gemini (Google)", "gemini"), ("Hugging Face (Mistral/Open)", "huggingface"), ("Remote Worker (Windows)", "remote")], value="gemini", id="provider"),
            Horizontal(
                Button("Generate", variant="primary", id="generate"),
                Button("Cancel", variant="error", id="cancel"),
                classes="buttons"
            ),
            id="dialog"
        )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "generate":
            topic = self.query_one("#topic", Input).value
            provider = self.query_one("#provider", Select).value
            if topic:
                self.app.notify(f"Alchemist is researching '{topic}' with {provider}...")
                try:
                    filename = core.generate_ai_post(topic, provider=provider)
                    self.app.notify(f"Draft created: {filename}")
                    self.dismiss(True)
                except Exception as e:
                    self.app.notify(f"Error: {e}", severity="error")
        elif event.button.id == "cancel":
            self.dismiss(False)

class BlogTUI(App):
    CSS = """
    Screen {
        layout: horizontal;
    }
    
    /* General Layout */
    #main-tabs {
        height: 1fr;
    }
    
    /* Dashboard / Mission Control */
    #mission-control {
        layout: grid;
        grid-size: 3;
        grid-gutter: 1;
        padding: 1;
    }
    
    AgentCard {
        background: $surface;
        border: solid $accent;
        height: 100%;
        padding: 1;
    }
    
    .agent-name {
        text-style: bold;
        color: $text;
    }
    .agent-role {
        color: $text-muted;
        margin-bottom: 1;
    }
    .agent-status {
        color: $success;
    }
    
    /* Server Logs Panel */
    #server-panel {
        column-span: 3;
        height: 20;
        border-top: solid $secondary;
        background: $surface-darken-1;
        padding: 1;
    }
    
    /* Posts View */
    #sidebar {
        width: 30;
        background: $panel;
        border-right: vkey $accent;
    }
    #main {
        width: 1fr;
        padding: 1;
    }
    PostListItem {
        padding: 1;
        border-bottom: solid $primary-background-lighten-1;
    }
    PostListItem:hover {
        background: $accent;
    }
    
    /* Dialogs */
    #dialog {
        padding: 2;
        background: $surface;
        border: solid $accent;
        width: 60;
        height: auto;
        align: center middle;
    }
    .label {
        margin-top: 1;
    }
    .buttons {
        margin-top: 2;
        align: center middle;
    }
    Button {
        margin: 0 1;
    }
    """

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("n", "new_post", "New Post"),
        ("r", "refresh_posts", "Refresh"),
        ("g", "generate_ai", "Commission Alchemist"),
        ("p", "publish_git", "Publish (Git)"),
        ("s", "start_server", "Start Server"),
        ("x", "stop_server", "Stop Server"),
    ]

    def compose(self) -> ComposeResult:
        yield Header()
        with TabbedContent(initial="mission-control", id="main-tabs"):
            
            # 1. Mission Control
            with TabPane("Mission Control", id="mission-control-tab"):
                yield Container(
                    # Agent Grid
                    Grid(
                        AgentCard("The Alchemist", "Content Generator", "⚗️", "Ready"),
                        AgentCard("The Guardian", "Safety Officer", "🛡️", "Active"),
                        AgentCard("The Editor", "Style & Quality", "✍️", "Active"),
                        AgentCard("The Librarian", "Knowledge Graph", "📚", "Indexing"),
                        AgentCard("The Architect", "System Architect", "🏗️", "Remote"),
                        AgentCard("The Operator", "System Manager", "⚙️", "Running"),
                        AgentCard("The Visionary", "Visual Design", "👁️", "Dreaming"),
                        id="mission-control"
                    ),
                    # Server Logs / System Status
                    Container(
                        Label("System Logs", classes="label"),
                        Log(id="server-logs"),
                        Horizontal(
                            Button("Start Server", variant="success", id="start-server"),
                            Button("Stop Server", variant="error", id="stop-server"),
                            classes="buttons"
                        ),
                        id="server-panel"
                    )
                )

            # 2. Content Studio
            with TabPane("Content Studio", id="posts"):
                yield Container(
                    ListView(id="post-list"),
                    id="sidebar"
                )
                yield Container(
                    Markdown("# Select a post to edit or press 'n' to create new."),
                    id="main"
                )
                
        yield Footer()

    def on_mount(self) -> None:
        self.server_manager = core.ServerManager()
        self.refresh_posts()
        self.set_interval(2, self.update_server_status)
        
        # Add actions to cards dynamically
        self.setup_agent_actions()

    def setup_agent_actions(self):
        # Alchemist
        alchemist_actions = self.query_one("#actions-the-alchemist", Container)
        alchemist_actions.mount(Button("Commission Post", variant="primary", id="btn-commission"))
        
        # Guardian
        guardian_actions = self.query_one("#actions-the-guardian", Container)
        guardian_actions.mount(Button("Audit Latest", id="btn-audit-safety"))
        
        # Librarian
        librarian_actions = self.query_one("#actions-the-librarian", Container)
        librarian_actions.mount(Button("Rebuild Graph", id="btn-rebuild-graph"))

        # Architect
        architect_actions = self.query_one("#actions-the-architect", Container)
        architect_actions.mount(Button("Audit Codebase", id="btn-audit-code"))

        # Operator
        operator_actions = self.query_one("#actions-the-operator", Container)
        operator_actions.mount(Button("Force Evolution", variant="warning", id="btn-evolve"))

    def update_server_status(self):
        status = self.server_manager.get_status()
        # Update Operator Card Status
        op_status = self.query_one("#status-the-operator", Label)
        op_status.update(f"Status: {status}")
        
        if status == "Running":
            op_status.styles.color = "green"
            logs = self.server_manager.get_logs()
            log_view = self.query_one("#server-logs", Log)
            log_view.clear()
            log_view.write(logs)
        else:
            op_status.styles.color = "red"

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn_id = event.button.id
        
        if btn_id == "start-server":
            self.action_start_server()
        elif btn_id == "stop-server":
            self.action_stop_server()
        elif btn_id == "btn-commission":
            self.action_generate_ai()
        elif btn_id == "btn-rebuild-graph":
            self.app.notify("Librarian is rebuilding the graph...")
            try:
                librarian = Librarian()
                posts = core.get_posts()
                librarian.build_graph(posts)
                self.app.notify("Knowledge Graph updated.")
            except Exception as e:
                self.app.notify(f"Error: {e}", severity="error")
        elif btn_id == "btn-audit-safety":
            self.app.notify("Guardian is auditing the latest post...")
            # Logic to audit latest post
            pass
        elif btn_id == "btn-audit-code":
            self.app.notify("The Architect is analyzing the codebase (Remote)...")
            try:
                from engineers.architect import Architect
                report = Architect().audit_system()
                self.app.push_screen(ModalScreen(Label(report, classes="report-text")))
            except Exception as e:
                self.app.notify(f"Error: {e}", severity="error")
        elif btn_id == "btn-evolve":
            self.app.notify("Initiating Evolution Cycle... This may take a minute.")
            try:
                from engineers.operator import Operator
                report = Operator().evolve()
                self.app.push_screen(ModalScreen(Label(report, classes="report-text")))
            except Exception as e:
                self.app.notify(f"Evolution Error: {e}", severity="error")

    def refresh_posts(self):
        posts = core.get_posts()
        list_view = self.query_one("#post-list", ListView)
        list_view.clear()
        for post in posts:
            list_view.append(PostListItem(post))

    def on_list_view_selected(self, event: ListView.Selected):
        post = event.item.post
        self.push_screen(EditorScreen(post))

    def action_start_server(self):
        msg = self.server_manager.start_server()
        self.notify(msg)
        self.update_server_status()

    def action_stop_server(self):
        msg = self.server_manager.stop_server()
        self.notify(msg)
        self.update_server_status()

    def action_new_post(self):
        self.push_screen(EditorScreen())

    def action_refresh_posts(self):
        self.refresh_posts()
        self.notify("Posts refreshed")

    def action_generate_ai(self):
        def check_result(result):
            if result:
                self.refresh_posts()
        self.push_screen(AIGenerationModal(), check_result)

    def action_publish_git(self):
        try:
            msg = core.publish_git()
            self.notify(msg)
        except Exception as e:
            self.notify(f"Error: {e}", severity="error")

if __name__ == "__main__":
    app = BlogTUI()
    app.run()
