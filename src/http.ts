import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from './server.ts';

const { values } = parseArgs({
  options: {
    port: { type: 'string', short: 'p', default: process.env.PORT ?? '3000' },
    stateless: { type: 'boolean', default: false },
  },
});

const PORT = parseInt(values.port!, 10);
const STATELESS = values.stateless!;
const HOST = process.env.HOST ?? '127.0.0.1';
const allowedHosts = process.env.ALLOWED_HOSTS?.split(',');
const app = createMcpExpressApp(
  allowedHosts ? { host: '0.0.0.0', allowedHosts } : undefined,
);

if (STATELESS) {
  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    await server.close();
  });

  app.get('/mcp', async (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'SSE not supported in stateless mode' },
      id: null,
    });
  });

  app.delete('/mcp', async (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Sessions not supported in stateless mode',
      },
      id: null,
    });
  });
} else {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport);
        },
      });

      transport.onclose = () => {
        const id = [...transports.entries()].find(
          ([, candidate]) => candidate === transport,
        )?.[0];
        if (id) transports.delete(id);
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
  });

  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'No valid session ID' },
      id: null,
    });
  });

  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      transports.delete(sessionId);
      return;
    }
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'No valid session ID' },
      id: null,
    });
  });
}

app.listen(PORT, HOST, () => {
  const mode = STATELESS ? 'stateless' : 'stateful';
  console.log(
    `tool-name-normalization-mcp-server (${mode}) listening on http://${HOST}:${PORT}/mcp`,
  );
});
