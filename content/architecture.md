---
title: System Architecture
date: 2025-12-16
slug: architecture
type: page
---

# System Architecture

The "IanSight" System operates as a dual-layer architecture: a **Public Presence** (the website) and a **Private Studio** (the brain/admin system).

```mermaid
graph TD
    subgraph public_zone ["Public Zone (Port 8000)"]
        Server["FastAPI Server<br>server.py"]
        Docs["Static Site<br>/docs"]
        WS_Chat["WebSocket<br>/ws/chat"]
        FrontEnd["Frontend SPA<br>frontend/dist"]
        
        Server --> Docs
        Server --> FrontEnd
        Server --> WS_Chat
    end

    subgraph studio_zone ["Studio Zone (Admin Port 5001)"]
        AdminApp["Flask Admin App<br>admin/app.py"]
        AdminCore["Admin Core<br>admin/core.py"]
        Builder["Build Script<br>build.py"]
        
        subgraph engineers_group ["Engineers (Agents)"]
            Architect
            Alchemist["Alchemist<br>(Content Gen)"]
            Broadcaster["Broadcaster<br>(Social/TikTok)"]
            Guardian["Guardian<br>(Safety)"]
            Evolution["Evolution Loop<br>(Background Process)"]
            ManyOthers["80+ Specialized Agents..."]
        end
        
        AdminApp --> AdminCore
        AdminCore --> Alchemist
        Builder --> Architect
        AdminCore --> Broadcaster
        Evolution --> AdminCore
    end

    subgraph data_infra ["Data & Infrastructure"]
        Content["Content Store<br>/content (*.md)"]
        Brain["Brain State<br>/admin/brain"]
        Ollama["Ollama (Local LLM)"]
        TikTok["TikTok API"]
    end

    %% Relationships
    Builder -- Reads --> Content
    Builder -- Generates --> Docs
    
    AdminCore -- Reads/Writes --> Content
    AdminCore -- Uses --> Ollama
    Broadcaster -- Uploads --> TikTok
    
    WS_Chat -- Simulates --> Engineers
    
    classDef public fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef studio fill:#f3e5f5,stroke:#4a148c,stroke-width:2px;
    classDef data fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    
    class Server,Docs,WS_Chat,FrontEnd public;
    class AdminApp,AdminCore,Builder,Architect,Alchemist,Broadcaster,Guardian,Evolution,ManyOthers studio;
    class Content,Brain,Ollama,TikTok data;
```

## Core Components

### 1. The Public Server (`server.py`)
- **Technology**: FastAPI
- **Port**: 8000
- **Role**: Serves the generated static site (`docs/`) and the client-side application (`frontend/dist`).
- **Features**:
  - WebSockets for "Chat with Team" (`core.team.team_orchestrator`).
  - Public APIs for health checks and inquiry forms.
  - Mobile client support via CORS and asset mounting.

### 2. The Admin Studio (`admin/`)
- **Technology**: Flask (`admin/app.py`) + Custom Python Modules
- **Port**: 5001
- **Role**: The "Mission Control" for managing content, media, and evolution.
- **Key Modules**:
  - **`admin/core.py`**: The central business logic hub. Handles persistence, AI generation pipelines, and server management.
  - **`build.py`**: A custom static site generator. It uses the `Architect` agent to register plugins (like `Guardian`) and processes markdown from `content/` into `docs/`.

### 3. The Federation of Engineers (`admin/engineers/`)
A massive suite of specialized Python classes acting as agents.
- **Architect**: Manages system design and build hooks.
- **Alchemist**: Generates content using LLMs (Ollama/Google).
- **Broadcaster**: Handles video generation and TikTok uploading.
- **Guardian**: Audits content for safety and quality.
- **Evolution Loop**: A background process that continuously "improves" the system.
- **Others**: `VideoEditor`, `SocialEngine`, `Librarian`, `Weaver`, etc.

### 4. Data Flow
1.  **Content Creation**: New content is created manually or via `Alchemist` in `admin/` and saved to `content/` as Markdown.
2.  **Build Process**: `build.py` reads `content/`, applies templates, and generates HTML in `docs/`.
3.  **Deployment**: `server.py` serves the new `docs/`. The `Broadcaster` may automatically generate a video summary and upload it to TikTok.
