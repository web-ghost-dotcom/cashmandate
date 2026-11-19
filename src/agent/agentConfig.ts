import { readFileSync } from 'node:fs';
import { ElectrumNetworkProvider, Network } from 'cashscript';
import { z } from 'zod';
import { createAgentIdentityFromHex } from '../core/identity';
import { deserializeMandateTerms } from '../core/terms';
import type { MandateAgentToolsConfig } from './mandateAgentTools';

const agentConfigSchema = z.object({
  agentPrivateKeyHex: z.string().length(64),
  recipientLabels: z.array(z.string()),
  terms: z.object({
    ownerPublicKeyHashHex: z.string(),
    agentPublicKeyHex: z.string(),
    approvedRecipientsHex: z.array(z.string()),
    perSpendLimitSatoshis: z.number().int(),
    minimumBlocksBetweenSpends: z.number().int(),
  }),
});

export type AgentConfigFile = z.infer<typeof agentConfigSchema>;

export interface LoadedAgentConfig {
  readonly toolsConfig: MandateAgentToolsConfig;
  readonly provider: ElectrumNetworkProvider;
}

/**
 * The agent process holds only the agent key and the public terms. The owner
 * key never reaches it, which is the point of the mandate.
 */
export async function loadAgentConfig(configFilePath: string): Promise<LoadedAgentConfig> {
  let parsedConfig: AgentConfigFile;
  try {
    parsedConfig = agentConfigSchema.parse(JSON.parse(readFileSync(configFilePath, 'utf-8')));
  } catch (failure) {
    const reason = failure instanceof Error ? failure.message : String(failure);
    throw new Error(`Agent config ${configFilePath} is unreadable or invalid: ${reason}`);
  }
  const provider = new ElectrumNetworkProvider(Network.CHIPNET, { manualConnectionManagement: true });
  await provider.connect();
  return {
    provider,
    toolsConfig: {
      provider,
      terms: deserializeMandateTerms(parsedConfig.terms),
      agent: createAgentIdentityFromHex('agent', parsedConfig.agentPrivateKeyHex, 'chipnet'),
      recipientLabels: parsedConfig.recipientLabels,
    },
  };
}
