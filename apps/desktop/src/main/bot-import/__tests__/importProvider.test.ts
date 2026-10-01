import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { translateRequest } from '@cindy/anthropic-responses-bridge';

vi.mock('@cindy/mcps', () => ({ resolveLiziMcpSessionContext: () => ({ sessionId: 'fixture-session' }) }));
vi.mock('../host.js', () => ({
  listCompanionImportSources: vi.fn(), previewCompanionImport: vi.fn(),
  startCompanionImport: vi.fn(async () => ({ status: 'running' })), getCompanionImportResult: vi.fn(),
}));
vi.mock('../../appSessionState.js', () => ({ activeOwnerScopeKey: () => 'fixture-owner', isAppSessionBoundaryPending: () => false }));
vi.mock('../../localDb/client/current.js', () => ({ getDbClient: () => ({ drizzle: {
  select: (fields: Record<string, unknown>) => {
    const query = { from: () => query, where: () => query,
      limit: async () => 'source' in fields ? [{ source: 'desktop', status: 'active', remoteHostId: null }] : [] };
    return query;
  },
} }) }));
import { createCompanionImportProvider } from '../importProvider.js';
import { startCompanionImport } from '../host.js';

let client: Client;
let server: McpServer;
beforeEach(async () => {
  vi.clearAllMocks();
  const config = createCompanionImportProvider().toClaudeSdkConfig!({} as never) as { instance: McpServer };
  server = config.instance;
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'fixture', version: '1' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});
afterEach(async () => { await client.close(); await server.close(); });

it('serializes import ranges as fixed-length homogeneous arrays through MCP and the Responses bridge', async () => {
  const { tools } = await client.listTools();
  const tool = tools.find(tool => tool.name === 'import_agent')!;
  const request = translateRequest({ model: 'xai/grok-4.7', messages: [], max_tokens: 128,
    tools: [{ name: tool.name, description: tool.description, input_schema: tool.inputSchema }] }, { model: 'grok-4.7' });
  expect(request.tools).toEqual([expect.objectContaining({ type: 'function', name: 'import_agent',
    parameters: expect.objectContaining({ properties: expect.objectContaining({ selection: expect.objectContaining({
      properties: expect.objectContaining({ entryRanges: {
        type: 'array', items: { type: 'array', minItems: 2, maxItems: 2,
          items: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } },
      } }),
    }) }) }),
  })]);
});

it.each([undefined, [], [[0, 0], [2, 3]], [[Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]]].map(entryRanges => ({ entryRanges })))('preserves valid selections: $entryRanges', async ({ entryRanges }) => {
  const selection = { previewId: 'preview', requestId: 'request', name: 'Ada', entryIds: entryRanges === undefined ? ['legacy-entry'] : [], takeover: false,
    ...(entryRanges === undefined ? {} : { entryRanges }) };
  const result = await client.callTool({ name: 'import_agent', arguments: { operation: 'start', selection } });
  expect(result.isError).not.toBe(true);
  expect(startCompanionImport).toHaveBeenCalledWith({ ...selection, deferSetup: true }, 'command:fixture-session');
});

it.each([[[0]], [[0, 1, 2]], [[-1, 0]], [[0.5, 1]], [[0, Number.MAX_SAFE_INTEGER + 1]]].map(entryRanges => ({ entryRanges })))('rejects malformed ranges before importing: $entryRanges', async ({ entryRanges }) => {
  const result = await client.callTool({ name: 'import_agent', arguments: { operation: 'start', selection: {
    previewId: 'preview', requestId: 'request', name: 'Ada', entryIds: [], takeover: false, entryRanges,
  } } });
  expect(result.isError).toBe(true);
  expect(startCompanionImport).not.toHaveBeenCalled();
});
