# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-05-26

### Breaking changes

- **Replaced five domain tools (`notion_pages`, `notion_blocks`, `notion_database`, `notion_comments`, `notion_users`) with two:** `notion_execute` and `notion_describe`. Any client that hard-codes the old tool names must rename — see [MIGRATION.md](./MIGRATION.md).
- The `action` / `params` envelope is gone. Call sites now pass `{ operation, payload }` directly.
- Renamed operations to verb-first names: `update_page_properties` → `set_page_title` (title rename) / `set_page_property` (single field) / `set_page_properties` (multi field), `get_comments` → `list_comments`, `retrieve_block` → `get_block`, `retrieve_block_children` → `get_block_children`, `append_block_children` → `append_blocks`, etc. Full mapping in MIGRATION.md.

### Added

- **`notion_execute`** — single tool that dispatches every operation by name.
- **`notion_describe`** — returns JSON Schema + a working example for any operation.
- **`get_block`** — retrieve a single block by ID (closes the v1 `retrieve_block` gap). Batchable.
- **`set_page_properties`** — set multiple page properties in a single API call (the multi-field equivalent of v1's `update_page_properties`). Batchable.
- **`notion://operations`** resource — a markdown cheat sheet of every supported operation.
- **Self-healing errors** — validation failures return `{ code, message, path, issues, schema, example, fix }`, so an LLM can correct a malformed payload in one round-trip.
- **Universal batch envelope** — every batchable op accepts `{ items: [...], atomic?: boolean, idempotency_key?: string, concurrency?: 1..10 }`. Per-item validation, per-item results, summary counts.
- **Atomic batches with best-effort rollback** — `atomic: true` aborts on the first failure and (where the op defines a `rollback`) archives entities created earlier in the batch.
- **Idempotency keys** — same `(operation, idempotency_key)` returns the cached batch result for 5 minutes (max 512 entries).
- **Markdown shortcut** — `create_page`, `append_blocks`, and `update_block` accept a `markdown` string. The remark / remark-gfm pipeline converts paragraphs, headings 1–3, bulleted / numbered lists, to-do items (including nested children), blockquotes, fenced code with language normalization, thematic breaks, images, and inline annotations (bold, italic, strikethrough, inline code, links).
- **Slim response shapers** — every read returns a compact projection by default; pass `verbose: true` to get the raw Notion SDK response.
- **JSON Schema `$defs` deduplication** — shared sub-schemas (rich text, parent, icon, file) are hoisted to `$defs` instead of being inlined, shrinking error envelopes significantly.
- **Improved error envelopes** — `code` + `message` + `fix` for restricted_resource, unauthorized, validation_error, conflict_error, etc.
- **Vitest smoke harness** (`npm test`) — covers the markdown parser, slim shapers, schema emitter (`$defs` hoisting), and dispatcher (validation paths, batch partial success, atomic rollback, idempotency dedupe).

### Changed

- Bumped to `zod@^4.4.3` (the 2.0.0 line targets Zod 4 only — Zod 3 is no longer supported).
- Default batch concurrency is 3 (matches Notion's rate-limit budget); max is 10.
- Notion errors now carry the path of the offending payload field where the SDK supplies one.

### Removed

- The 21 individual tool files under `src/tools/*.ts` have been deleted. The operation logic now lives in `src/operations/`, registered into a central dispatcher.
- The `handleNotionError` `CallToolResult` shim is gone — the dispatcher uses `toErrorEnvelope` directly.

## [1.4.0] — earlier

- Migrated to `zod@^4.4`. Restricted `z.url()` to http/https schemes.

## [1.3.0] — earlier

- Hardened Docker image, GHCR publish workflow, Docker Hub catalog submission.

## [1.2.x] — earlier

- README rewrite for PAT-first onboarding; final-review fixes on the OAuth auth gateway.
