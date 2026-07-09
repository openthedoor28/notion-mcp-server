# syntax=docker/dockerfile:1

FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --ignore-scripts --omit-dev

COPY . .

RUN npm run build

RUN npm link


FROM node:20-slim

COPY --from=builder /usr/local/lib/node_modules/@notionhq/notion-mcp-server /usr/local/lib/node_modules/@notionhq/notion-mcp-server

COPY --from=builder /usr/local/bin/notion-mcp-server /usr/local/bin/notion-mcp-server


ENV OPENAPI_MCP_HEADERS="{}"


ENTRYPOINT ["notion-mcp-server","--transport","http","--host","0.0.0.0"]
