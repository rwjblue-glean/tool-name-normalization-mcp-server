import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Tool names deliberately span casing styles. The question under test: does the
// MCP host (Cursor) invoke a tool by the EXACT advertised name, or does it
// munge the name (lowercase / snake-case) before sending tools/call? Each name
// is also a valid MCP tool name ([A-Za-z0-9_-]) so the host has no excuse to
// reject it.
export const testToolNames = [
  'snake_case_tool', // control: already snake_case, must round-trip
  'camelCaseTool', // camelCase -> lowercased? snake-split?
  'PascalCaseTool', // leading capital
  'SCREAMING_SNAKE_TOOL', // CAPITAL_CASE: the pyagents action-name analog
  'kebab-case-tool', // hyphens are valid name chars
  'mixedCASE_Tool_v2', // mixed bag
  'addCommentToJiraIssue', // the real external-gateway example from #240517
  'Glean Search', // contains a SPACE: the exact name #147939 saw munged to glean_search
] as const;

const cReportToolName = 'report_call_log';

type CallRecord = { received: string; matched: boolean; at: string };

// Module-level so the log accumulates across requests in BOTH stateless (a new
// server per request) and stateful (a server per session) modes.
const callLog: CallRecord[] = [];

export function createServer(): Server {
  const server = new Server(
    { name: 'tool-name-normalization-mcp-server', version: '0.0.1' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      ...testToolNames.map((name) => ({
        name,
        description:
          `Casing probe. Call this tool; it reports the EXACT name the server ` +
          `received, so we can see whether the host munged "${name}".`,
        inputSchema: { type: 'object' as const, properties: {} },
      })),
      {
        name: cReportToolName,
        description:
          'Returns the log of every tools/call name this server has received ' +
          '(received name + whether it exactly matched an advertised name), to ' +
          'detect host-side tool-name munging.',
        inputSchema: { type: 'object' as const, properties: {} },
      },
    ],
  }));

  // Catch-all: handles EVERY tools/call regardless of name, so a munged name
  // that matches no advertised tool is still captured rather than rejected.
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const received = request.params.name;

    if (received === cReportToolName) {
      return textResult(formatLog());
    }

    const matched = (testToolNames as readonly string[]).includes(received);
    callLog.push({ received, matched, at: new Date().toISOString() });
    console.error(
      `[tool-name-probe] tools/call name=${JSON.stringify(received)} matched=${matched}`,
    );

    return textResult(
      [
        `Received tools/call name: ${JSON.stringify(received)}`,
        `Exact match to an advertised name: ${matched ? 'YES' : 'NO (munged?)'}`,
        '',
        `Advertised names: ${testToolNames.join(', ')}`,
      ].join('\n'),
    );
  });

  return server;
}

function formatLog(): string {
  if (callLog.length === 0) {
    return 'No tool calls received yet.';
  }
  const lines = callLog.map(
    (r, i) =>
      `${i + 1}. received=${JSON.stringify(r.received)} matched=${r.matched ? 'YES' : 'NO'} at=${r.at}`,
  );
  const munged = callLog.filter((r) => !r.matched).length;
  return [
    `Tool-call name log (${callLog.length} calls, ${munged} did not match an advertised name):`,
    ...lines,
  ].join('\n');
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}
