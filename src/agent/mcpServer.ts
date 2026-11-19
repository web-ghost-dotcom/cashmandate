import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadAgentConfig } from './agentConfig';
import { createMandateAgentTools, type MandateAgentTools } from './mandateAgentTools';

const SERVER_NAME = 'cashmandate';
const SERVER_VERSION = '0.1.0';

function asTextResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
}

export function buildMandateMcpServer(tools: MandateAgentTools): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    'get_mandate',
    {
      description:
        'Read the spending mandate: the vault balance, the per-payment limit, the minimum blocks between payments, and the approved recipients.',
      inputSchema: {},
    },
    async function handleGetMandate() {
      return asTextResult(await tools.getMandate());
    },
  );

  server.registerTool(
    'pay',
    {
      description:
        'Pay a recipient from the mandate vault. The Bitcoin Cash covenant enforces the mandate; a payment it forbids is refused by the network and the refusal is returned.',
      inputSchema: {
        recipientAddress: z.string().describe('Bitcoin Cash chipnet address to pay'),
        amountSatoshis: z.number().int().describe('Amount in satoshis'),
        memo: z.string().optional().describe('Short on-chain note saying why this payment is made'),
      },
    },
    async function handlePay(input) {
      return asTextResult(await tools.pay(input.recipientAddress, input.amountSatoshis, input.memo));
    },
  );

  return server;
}

async function main(): Promise<void> {
  const configFilePath = process.env.CASHMANDATE_AGENT_CONFIG;
  if (configFilePath === undefined) {
    throw new Error('CASHMANDATE_AGENT_CONFIG must point at an agent config file');
  }
  const { toolsConfig } = await loadAgentConfig(configFilePath);
  const server = buildMandateMcpServer(createMandateAgentTools(toolsConfig));
  await server.connect(new StdioServerTransport());
}

main().catch(function reportFailure(failure) {
  process.stderr.write(`cashmandate MCP server failed: ${failure instanceof Error ? failure.message : String(failure)}\n`);
  process.exit(1);
});
