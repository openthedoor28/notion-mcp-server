# Streamable HTTP transport — design

**Date:** 2026-06-17
**Status:** implemented in v2.7.0
**Target release:** v2.7.0 (minor — additive feature, stdio default unchanged)

## Goal

Add a **Streamable HTTP** transport to the server so it can run as a remote/hosted
endpoint (web clients, ChatGPT connectors, networked Claude/Cursor), in addition
to the existing stdio transport. stdio remains the default; HTTP is opt-in.

## Decisions (resolved during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Auth/token model | **Single-tenant** — HTTP uses the same `NOTION_TOKEN` env as stdio | Minimal refactor; global `getClient()` stays. No per-request token threading. |
| Session model | **Stateful** (`mcp-session-id`, per-session server + transport) | Spec-standard; clients (Claude, MCP Inspector) negotiate sessions; supports server→client streams. |
| HTTP layer | **Node built-in `http`** (no Express) | Zero new direct dependencies — aligns with the project's minimal-dep / supply-chain posture. |
| Endpoint auth | **Optional bearer key** (`MCP_AUTH_TOKEN`); open if unset | Localhost bind (`127.0.0.1`) closes the main risk for the default dev case. |

### Non-goals (YAGNI)

- Multi-tenant / per-request Notion tokens (header-supplied).
- OAuth 2.1 authorization-server flow.
- Resumability / event-store / message replay.
- Custom/persistent session stores (in-memory map only).

These are explicitly out of scope; the architecture leaves room for them later but
does not build them.

## Competitor / reference findings

- **suekou/mcp-notion-server** (the high-star competitor): **stdio-only**, no HTTP at
  all. Its differentiator is React-based MCP Apps served over the protocol. Adding
  Streamable HTTP puts us ahead of it on transport.
- **makenotion/notion-mcp-server** (official): full Streamable HTTP via Express, and
  its structure matches this design almost 1:1 — validating the approach:
  stateful `transports[sessionId]` map, `StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID, onsessioninitialized, ...dnsRebinding })`, per-session server built via a factory and `connect()`-ed, `onclose` cleanup, POST reuse-or-init (gated by `isInitializeRequest`), GET SSE stream, DELETE terminate, unauthenticated `/health`, auth middleware scoped to `/mcp`.
- Adopted from the official server: use the SDK's **`isInitializeRequest`** helper to
  detect init requests (no extra dependency).
- Differs from the official server: they are auth-**secure-by-default** (auto-generate
  a token when none is provided). We chose optional-key + localhost bind instead.

## Architecture

### Refactor: singleton → factory

Today `src/server/index.ts` exports a module-singleton `server` (a `McpServer`), and
`registerAllTools()` / `registerAllPrompts()` import and mutate that singleton. Stateful
HTTP needs a **fresh `McpServer` per session**, so registration must be parameterized.

- `createServer(): McpServer` — builds a `McpServer` and registers tools, resources,
  and prompts onto it. Returns the configured instance.
- `registerAllTools(server)` / `registerAllPrompts(server)` — take the server as a
  parameter instead of importing the singleton.
- **Operation registry stays global.** `initOperations()` populates a global operation
  registry (operation *definitions*, not server state). It must be called **once** at
  process start, before any `createServer()`. `createServer()` only does
  `server.registerTool/registerResource/registerPrompt`, reading from the
  already-populated registry — so calling it per session never double-registers ops.

### Transport selection

`src/index.ts`:
1. `initOperations()` (once).
2. Parse transport config from env.
3. `MCP_TRANSPORT=stdio` (default) → `startStdio()`; `MCP_TRANSPORT=http` → `startHttp(config)`.

### Components

| Unit | File | Responsibility |
|---|---|---|
| `createServer()` | `src/server/index.ts` | Build + register a fresh `McpServer`. |
| `startStdio()` | `src/server/stdio.ts` | `createServer()` once, connect `StdioServerTransport` (current behavior + auth log line). |
| `startHttp(config)` | `src/server/http.ts` | Node `http` server, session map, routing, auth. |
| `parseHttpConfig(env)` | `src/config/http.ts` | Pure: env → `{ transport, port, host, authToken, allowedHosts, allowedOrigins }` with defaults. |
| `checkAuth(headers, expected)` | `src/server/auth.ts` | Pure: returns `{ ok }` or `{ ok:false, status, message }`. |

Keeping `startHttp`, config parsing, and auth as separate small units makes the two
pure functions (`parseHttpConfig`, `checkAuth`) unit-testable without a socket.

## HTTP behavior

Single path `/mcp` (+ `GET /health`):

- **POST /mcp**
  - `mcp-session-id` present and known → reuse that session's transport.
  - No session id and `isInitializeRequest(body)` → create `StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), onsessioninitialized: id => sessions[id]=transport, ...dnsRebinding })`; set `transport.onclose` to delete from map; `createServer().connect(transport)`.
  - Otherwise → `400` (no valid session).
  - Then `transport.handleRequest(req, res, body)`.
- **GET /mcp** — requires known `mcp-session-id` → `transport.handleRequest(req,res)` (opens the SSE stream). Else `400`.
- **DELETE /mcp** — requires known `mcp-session-id` → `transport.handleRequest` (terminate) and drop from map. Else `400`.
- **GET /health** — `200 {status,transport,port}`. **No auth.**
- Any other path/method → `404`.

### Body parsing

Node `http` has no JSON body parser. A small helper reads the request stream, enforces
a sane max size (e.g. 4 MB), and `JSON.parse`s it; malformed JSON → `400` with a
JSON-RPC error envelope.

## Config (env) — all optional; defaults preserve current stdio behavior

| env | default | meaning |
|---|---|---|
| `MCP_TRANSPORT` | `stdio` | `stdio` \| `http` |
| `PORT` | `3000` | listen port (http mode) |
| `HOST` | `127.0.0.1` | bind address (safe default; `0.0.0.0` is a deliberate opt-in) |
| `MCP_AUTH_TOKEN` | — | if set, require `Authorization: Bearer <token>` on `/mcp` |
| `MCP_ALLOWED_HOSTS` | host + localhost | comma-list for DNS-rebinding `Host` allowlist |
| `MCP_ALLOWED_ORIGINS` | localhost origins | comma-list for `Origin` allowlist |

`NOTION_TOKEN` is consumed exactly as today (access model unchanged).

## Security

- `checkAuth`: no `MCP_AUTH_TOKEN` configured → allow (open). Configured → compare the
  Bearer token using a constant-time comparison; `401` on missing, `403` on mismatch.
  `/health` always bypasses auth.
- Bind to `127.0.0.1` by default; binding `0.0.0.0` is an explicit operator choice.
- `enableDnsRebindingProtection: true` with `allowedHosts`/`allowedOrigins`.
- If `HOST` is non-loopback **and** `MCP_AUTH_TOKEN` is unset, log a clear startup
  warning ("HTTP endpoint exposed without auth — anyone reachable can act as your
  Notion token").

## Error handling

- Per-request try/catch → JSON-RPC `-32603` `500` if headers not yet sent.
- Unknown session on GET/DELETE → `400`.
- Auth failures → `401`/`403` JSON-RPC envelopes.
- Graceful shutdown: on `SIGINT`/`SIGTERM`, close all live transports and the http
  server, then exit.

## Testing (TDD)

**Unit (pure, no socket):**
- `parseHttpConfig`: defaults (stdio); `MCP_TRANSPORT=http` with/without `PORT`/`HOST`;
  allowlist parsing.
- `checkAuth`: unset → ok; correct Bearer → ok; missing → 401; wrong → 403.

**Integration (real `http` server on an ephemeral port, Notion client mocked):**
- `initialize` POST → `200` + `mcp-session-id` header present.
- Reuse session → `tools/list` returns `notion_execute` + `notion_describe`.
- `notion_describe` call returns a schema for a known operation.
- With `MCP_AUTH_TOKEN` set: `/mcp` without/with-wrong token → `401`/`403`;
  with correct token → `200`. `/health` → `200` regardless.
- POST without session id and non-init body → `400`.

Existing stdio tests must stay green (the factory refactor preserves behavior).

## Packaging / docs

- **Dockerfile/compose:** document `docker run -e MCP_TRANSPORT=http -e NOTION_TOKEN=… -p 3000:3000 …`; the image already runs `node build/index.js`, so no Dockerfile logic change beyond docs (optionally `EXPOSE 3000`).
- **README:** new "Remote / HTTP transport" section (enable, env table, auth, curl/Inspector example, security note).
- **CHANGELOG:** `## [2.7.0]` — Added: Streamable HTTP transport.

## File change summary

- `src/index.ts` — init ops once, choose transport.
- `src/server/index.ts` → factory `createServer()` (+ split `stdio.ts`, `http.ts`).
- `src/server/http.ts` — **new** (Node http server, sessions, routing).
- `src/server/auth.ts` — **new** (`checkAuth`).
- `src/config/http.ts` — **new** (`parseHttpConfig`).
- `src/tools/index.ts`, `src/prompts/index.ts` — take `server` param.
- `tests/http-config.test.ts`, `tests/http-auth.test.ts`, `tests/http-integration.test.ts` — **new**.
- `README.md`, `CHANGELOG.md`, Dockerfile docs.
