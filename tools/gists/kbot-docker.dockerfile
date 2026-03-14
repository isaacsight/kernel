# K:BOT Docker Image
#
# Run kbot in containers for CI, sandboxed execution, or server deployments.
#
# Build:
#   docker build -t kbot -f kbot-docker.dockerfile .
#
# Run interactively:
#   docker run -it -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY kbot
#
# One-shot:
#   docker run -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY kbot "explain quicksort"
#
# Mount your project:
#   docker run -it \
#     -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
#     -v $(pwd):/workspace \
#     -w /workspace \
#     kbot
#
# HTTP server mode:
#   docker run -d \
#     -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
#     -p 7437:7437 \
#     kbot serve --port 7437
#
# MCP server mode (for editor integration over stdio):
#   docker run -i \
#     -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
#     kbot ide mcp

FROM node:20-alpine

# Install git (required for git tools) and common utilities
RUN apk add --no-cache git openssh-client curl

# Install kbot globally
RUN npm install -g @kernel.chat/kbot

# Create a non-root user for safer execution
RUN adduser -D kbot
USER kbot

# Create workspace and kbot config directories
RUN mkdir -p /home/kbot/.kbot /home/kbot/workspace
WORKDIR /home/kbot/workspace

# Health check for server mode
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -sf http://localhost:7437/health || exit 1

# Default: interactive mode
ENTRYPOINT ["kbot"]
