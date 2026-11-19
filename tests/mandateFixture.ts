import { MockNetworkProvider, randomUtxo } from 'cashscript';
import { generateAgentIdentity, type AgentIdentity } from '../src/core/identity';
import { instantiateMandateContract, type MandateContract } from '../src/core/mandateContract';
import type { MandateTerms } from '../src/core/terms';

export const VAULT_SATOSHIS = 40_000n;
export const PER_SPEND_LIMIT_SATOSHIS = 5_000n;
export const MINIMUM_BLOCKS_BETWEEN_SPENDS = 3;

export interface MandateFixture {
  readonly provider: MockNetworkProvider;
  readonly contract: MandateContract;
  readonly terms: MandateTerms;
  readonly owner: AgentIdentity;
  readonly agent: AgentIdentity;
  readonly merchantOne: AgentIdentity;
  readonly merchantTwo: AgentIdentity;
  readonly stranger: AgentIdentity;
}

export function createMandateFixture(): MandateFixture {
  const provider = new MockNetworkProvider();
  const owner = generateAgentIdentity('owner', 'mocknet');
  const agent = generateAgentIdentity('agent', 'mocknet');
  const merchantOne = generateAgentIdentity('merchant-one', 'mocknet');
  const merchantTwo = generateAgentIdentity('merchant-two', 'mocknet');
  const stranger = generateAgentIdentity('stranger', 'mocknet');

  const terms: MandateTerms = {
    ownerPublicKeyHash: owner.publicKeyHash,
    agentPublicKey: agent.publicKey,
    approvedRecipients: [merchantOne.publicKeyHash, merchantTwo.publicKeyHash],
    perSpendLimitSatoshis: PER_SPEND_LIMIT_SATOSHIS,
    minimumBlocksBetweenSpends: MINIMUM_BLOCKS_BETWEEN_SPENDS,
  };
  const contract = instantiateMandateContract(terms, provider);
  provider.addUtxo(contract.address, randomUtxo({ satoshis: VAULT_SATOSHIS }));

  return { provider, contract, terms, owner, agent, merchantOne, merchantTwo, stranger };
}
