# Tool-Name Normalization MCP Server - Test Plan

This document describes how to determine, per MCP host, whether the host invokes
a tool by its **exact advertised name** or **munges** the name (lowercasing,
snake-casing, or stripping spaces) before sending `tools/call`. The goal is to
answer:

- Does the host connect in HTTP stateful mode? In stateless mode?
- For each advertised casing style, what name does the server actually receive
  on `tools/call`?
- Specifically: are `SCREAMING_SNAKE_TOOL`, `camelCaseTool`, `PascalCaseTool`,
  and `Glean Search` invoked verbatim, or transformed?
- Does the host even advertise a tool whose name has a space or capitals, or
  does it drop/reject it at `tools/list` time?

Cursor is the host of record for this experiment: PR
[#147939](https://github.com/askscio/scio/pull/147939) (May 2025) added
server-side lowercasing because Cursor munged `Glean Search` -> `glean_search`
and then invoked the munged name. We want to know whether that is still true.

## How the server reports munging

Every advertised tool routes through a single catch-all `tools/call` handler. It
records and echoes the **exact** name received, even when that name matches no
advertised tool (so a munged call is captured, not rejected). Two readouts:

- The tool result text: `Received tools/call name: "<name>"` plus whether it
  exactly matched an advertised name.
- The `report_call_log` tool: the full ordered history of received names.
- The Render service logs also print `[tool-name-probe] tools/call name=... matched=...`.

**Interpretation:** if every advertised name comes back `matched=YES`, the host
invokes verbatim and server-side case normalization is unnecessary. Any
`matched=NO` row shows the host munged that name — record the exact
transformation (e.g. `SCREAMING_SNAKE_TOOL` -> `screaming_snake_tool`,
`Glean Search` -> `glean_search`).

## Advertised tools

| Tool name | Style |
| --- | --- |
| `snake_case_tool` | control (already snake_case) |
| `camelCaseTool` | camelCase |
| `PascalCaseTool` | PascalCase |
| `SCREAMING_SNAKE_TOOL` | CAPITAL_CASE (pyagents action-name analog) |
| `kebab-case-tool` | kebab-case |
| `mixedCASE_Tool_v2` | mixed |
| `addCommentToJiraIssue` | real external-gateway example (#240517) |
| `Glean Search` | contains a space (the literal #147939 case) |
| `report_call_log` | aggregator; returns the received-name history |

## Setup

Use the public Render deployments by default:

```text
Stateless: https://tool-name-normalization-mcp-server-stateless.onrender.com/mcp
Stateful:  https://tool-name-normalization-mcp-server-stateful.onrender.com/mcp
```

To compare against a local server, start it from the repo root in a separate
terminal.

Local stateful HTTP:

```bash
mise run start:http
```

Local stateless HTTP:

```bash
mise run start:http -- --stateless
```

Local endpoint: `http://127.0.0.1:3000/mcp`

Quick local sanity check of the probe mechanism itself (not a host test):

```bash
node testing/probe.mjs http://127.0.0.1:3000/mcp
```

## Host Matrix

Run the sequence for each supported host/mode pair.

| Host           | HTTP stateful | HTTP stateless | Notes |
| -------------- | ------------- | -------------- | ----- |
| Cursor         |               |                | host of record (#147939) |
| Cursor Agent   |               |                |       |
| Claude Code    |               |                |       |
| Claude Desktop |               |                |       |
| VS Code        |               |                |       |
| ChatGPT        |               |                |       |

## Test Procedure

For each host and HTTP mode, record: host + version, mode, date, connection
result, and the full received-name table.

### 1. Connect and list

Paste this prompt:

```text
List the tools available from the tool-name-normalization MCP server. Show the exact tool names verbatim. Do not call any tools yet.
```

Record the names exactly as the host displays them. If the host shows
`glean_search` instead of `Glean Search`, or lowercases any name here, that is
already evidence of list-time munging — note it.

### 2. Call every probe tool

Paste this prompt:

```text
Call each of these tools from the tool-name-normalization MCP server once, with no arguments, in order: snake_case_tool, camelCaseTool, PascalCaseTool, SCREAMING_SNAKE_TOOL, kebab-case-tool, mixedCASE_Tool_v2, addCommentToJiraIssue, and the tool named "Glean Search". For each, report the "Received tools/call name" line from the result verbatim.
```

If the host cannot call one (e.g. it refuses the spaced name), record that as a
distinct outcome.

### 3. Dump the log

Paste this prompt:

```text
Call the tool-name-normalization MCP tool report_call_log with no arguments and paste the full result verbatim.
```

This is the authoritative readout. Cross-check against the Render service logs
(`[tool-name-probe] ...`) if available.

## Results Template

Copy this block for each host/mode pair.

```text
Host:
Version/build:
Mode: HTTP stateful | HTTP stateless
Date:
Connection result:
List-time munging observed (step 1):

| Advertised name        | Received name | Verbatim? |
| ---------------------- | ------------- | --------- |
| snake_case_tool        |               |           |
| camelCaseTool          |               |           |
| PascalCaseTool         |               |           |
| SCREAMING_SNAKE_TOOL   |               |           |
| kebab-case-tool        |               |           |
| mixedCASE_Tool_v2      |               |           |
| addCommentToJiraIssue  |               |           |
| Glean Search           |               |           |

Conclusion (verbatim / munged + transformation rule):
```
