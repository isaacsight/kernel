FROM node:20-alpine

LABEL maintainer="kernel.chat group"
LABEL description="kbot — Multi-channel AI agent. 25 agents, 290+ tools, 20 providers. Email agent, iMessage agent, kbot init."
LABEL org.opencontainers.image.source="https://github.com/isaacsight/kernel"
LABEL org.opencontainers.image.license="MIT"

RUN npm install -g @kernel.chat/kbot@latest

# Config volume for persistent memory and API keys
VOLUME ["/root/.kbot"]

ENTRYPOINT ["kbot"]
CMD ["--help"]
