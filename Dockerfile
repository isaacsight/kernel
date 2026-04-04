FROM node:20-alpine

LABEL maintainer="kernel.chat group"
LABEL description="kbot — Open-source terminal AI agent. 764+ tools, 35 agents, 20 providers. Dreams, learns, watches your system. MIT."
LABEL org.opencontainers.image.source="https://github.com/isaacsight/kernel"
LABEL org.opencontainers.image.license="MIT"
LABEL org.opencontainers.image.title="kbot"
LABEL org.opencontainers.image.description="Open-source terminal AI agent with 764+ tools, 35 specialist agents, and 20 AI providers. Plug kbot into Claude Code, Cursor, VS Code, Zed, or Neovim as an MCP tool provider."
LABEL org.opencontainers.image.vendor="kernel.chat"
LABEL org.opencontainers.image.url="https://kernel.chat"

RUN npm install -g @kernel.chat/kbot@latest

# Create working directory for context gathering
WORKDIR /workspace

# Create non-root user for security
RUN adduser -D -u 1000 kbot && \
    mkdir -p /home/kbot/.kbot && \
    chown -R kbot:kbot /home/kbot /workspace
USER kbot

# Config volume for persistent memory and API keys
VOLUME ["/home/kbot/.kbot"]

# Health check — verify kbot is installed and responsive
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD kbot --version || exit 1

# Default: start MCP server on stdio for Glama inspection and IDE integration
ENTRYPOINT ["kbot"]
CMD ["ide", "mcp"]
