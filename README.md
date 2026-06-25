# tool-name-normalization-mcp-server

A throwaway HTTP MCP server to answer one question empirically:

> **Does the MCP host (Cursor specifically) invoke a tool by the exact advertised
> name, or does it munge the name (lowercase / snake-case) first?**

This matters because Glean's MCP server dispatches tool calls by exact,
case-sensitive name lookup. PR
[#147939](https://github.com/askscio/scio/pull/147939) (May 2025) added
server-side lowercasing specifically because Cursor at the time normalized
`Glean Search` → `glean_search` client-side and then invoked the munged name,
breaking lookup. We want to know whether that's still true before dropping
case normalization from the server (so built-in / pyagents `CAPITAL_CASE` names
and external camelCase gateway names can be preserved verbatim).

## How it works

The server advertises tools spanning every casing style:

| Tool name | Style |
|---|---|
| `snake_case_tool` | control (already snake_case) |
| `camelCaseTool` | camelCase |
| `PascalCaseTool` | PascalCase |
| `SCREAMING_SNAKE_TOOL` | CAPITAL_CASE (pyagents action-name analog) |
| `kebab-case-tool` | kebab-case |
| `mixedCASE_Tool_v2` | mixed |
| `addCommentToJiraIssue` | the real external-gateway example |
| `Glean Search` | contains a space — the literal #147939 case |

It uses a **catch-all `tools/call` handler**, so even a call whose name matches
no advertised tool is captured (not rejected). Every call echoes the exact
received name; `report_call_log` dumps the full advertised-vs-received history.

If Cursor calls `SCREAMING_SNAKE_TOOL` verbatim → no munging, case preservation
is safe. If it arrives as `screaming_snake_tool` (or `camelCaseTool` arrives as
`camelcasetool` / `camel_case_tool`) → Cursor still munges, and we need
tolerant inbound matching on the server.

## Local

```bash
mise run start:http              # stateful, port 3000
node testing/probe.mjs           # smoke test against it
```

## Deploy (Render)

`render.yaml` defines two free web services (`-stateless` and `-stateful`).
Connect the GitHub repo as a Render Blueprint; stable URLs:

- `https://tool-name-normalization-mcp-server-stateless.onrender.com/mcp`
- `https://tool-name-normalization-mcp-server-stateful.onrender.com/mcp`

## Test with Cursor

1. Add the deployed URL as an MCP server in Cursor settings.
2. In chat, ask Cursor to call each tool from this server, then call
   `report_call_log`.
3. Compare `received` vs the advertised names. Server-side logs
   (`[tool-name-probe] …`) in the Render dashboard show the same data.
