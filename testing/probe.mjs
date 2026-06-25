// Local smoke test: verifies the server echoes back the EXACT tools/call name
// it receives, including names that match no advertised tool. This validates
// the probe mechanism itself; the real experiment is connecting Cursor.
//
// Usage: node testing/probe.mjs [http://host/mcp]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.argv[2] ?? 'http://127.0.0.1:3000/mcp';
const client = new Client({ name: 'probe', version: '0.0.1' });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

const { tools } = await client.listTools();
console.log(
  'advertised:',
  tools.map((t) => t.name),
);

// Send a mix of verbatim and deliberately-munged names. The server should
// report each back exactly as received.
const names = [
  'SCREAMING_SNAKE_TOOL',
  'screaming_snake_tool',
  'camelCaseTool',
  'camel_case_tool',
  'addCommentToJiraIssue',
  'Glean Search',
  'glean_search',
  'totally_made_up_name',
];
for (const name of names) {
  const r = await client.callTool({ name, arguments: {} });
  const firstTwo = r.content?.[0]?.text?.split('\n').slice(0, 2).join(' | ');
  console.log(`called ${JSON.stringify(name)} -> ${firstTwo}`);
}

const log = await client.callTool({ name: 'report_call_log', arguments: {} });
console.log('\n' + log.content[0].text);

await client.close();
