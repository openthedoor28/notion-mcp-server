# MCP Catalog submission

Staged files for submitting this server to the [Docker MCP Catalog](https://hub.docker.com/mcp).

The `notion` slug in `docker/mcp-registry` is taken by the official Notion MCP server
(`makenotion/notion-mcp-server`). This submission uses the slug `notion-mcp-awkoy` to
position it as a community alternative with batch operations.

## Submitting

1. Fork [`docker/mcp-registry`](https://github.com/docker/mcp-registry).
2. Create the server directory and copy files in:

   ```bash
   mkdir -p servers/notion-mcp-awkoy
   cp server.yaml ../mcp-registry/servers/notion-mcp-awkoy/server.yaml
   cp ../../Dockerfile ../mcp-registry/servers/notion-mcp-awkoy/Dockerfile
   ```

3. Edit `server.yaml` to add the exact commit SHA you want Docker to build from:

   ```yaml
   source:
     project: https://github.com/awkoy/notion-mcp-server
     commit: <SHA>
   ```

4. Open a PR against `docker/mcp-registry`. Review SLA is typically ~24h.

Once merged, Docker builds the image under `mcp/notion-mcp-awkoy` and lists the server
in the Docker Desktop MCP Toolkit for one-click install from Claude Desktop, Cursor,
Continue.dev, and other MCP clients.
