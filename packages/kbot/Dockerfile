FROM node:20-alpine

LABEL maintainer="kernel.chat group"
LABEL description="kbot — Universal AI agent for your terminal. 11 specialist agents, 214 tools, 20 providers."
LABEL org.opencontainers.image.source="https://github.com/isaacsight/kernel"
LABEL org.opencontainers.image.license="MIT"

RUN npm install -g @kernel.chat/kbot@latest

# Config volume for persistent memory and API keys
VOLUME ["/root/.kbot"]

ENTRYPOINT ["kbot"]
CMD ["--help"]
