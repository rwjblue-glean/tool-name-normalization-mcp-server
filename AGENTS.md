# tool-name-normalization-mcp-server

HTTP MCP server for testing whether MCP hosts (notably Cursor) munge tool names
(lowercase / snake-case) before invoking `tools/call`.

## Commands

- `mise run start:http` - Run as HTTP (stateful) MCP server (default port 3000)
- `mise run start:http -- --stateless` - Run HTTP server in stateless mode
- `mise run start:http -- --port 8080` - Custom port
- `mise run typecheck` - Type-check with `tsc --noEmit`
- `mise run format` / `format-check` - Prettier
- `node testing/probe.mjs [url]` - Local smoke test against a running server

## Architecture

- `src/server.ts` - Low-level `Server` with a catch-all `CallTool` handler that
  records and echoes the EXACT name received, so a munged name (matching no
  advertised tool) is captured rather than rejected. Advertises tools across
  every casing style plus a stable `report_call_log` tool.
- `src/http.ts` - Streamable HTTP transport entry point (stateful by default,
  `--stateless` flag). Copied from the elicitation/timeout testing servers.

## Conventions

- TypeScript with Node's native type stripping (`--experimental-strip-types`),
  no build step; `.ts` extensions in imports; ESM only.
- Prettier with single quotes + trailing commas.
- mise for tool management (Node via `mise/config.toml`).
- HTTP-only; no stdio transport.

jj-commit-default: auto
