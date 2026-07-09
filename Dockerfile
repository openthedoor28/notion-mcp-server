FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --ignore-scripts --omit-dev

COPY . .

RUN npm run build

RUN npm link


FROM node:20-slim

COPY scripts/notion-openapi.json /usr/local/scripts/

COPY --from=builder /usr/local/lib/node_modules/@notionhq/notion-mcp-server /usr/local/lib/node_modules/@notionhq/notion-mcp-server

COPY --from=builder /usr/local/bin/notion-mcp-server /usr/local/bin/notion-mcp-server


ENV MCP_TRANSPORT=http
ENV HOST=0.0.0.0
ENV PORT=3000


ENTRYPOINT ["notion-mcp-server"]
