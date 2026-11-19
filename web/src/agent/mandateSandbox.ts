import { MockNetworkProvider, randomUtxo } from 'cashscript';
import { z } from 'zod';
import { createMandateAgentTools, type MandateAgentTools, type MandateView } from '../../../src/agent/mandateAgentTools';
import { generateAgentIdentity } from '../../../src/core/identity';
import { instantiateMandateContract } from '../../../src/core/mandateContract';
import type { MandateTerms } from '../../../src/core/terms';
import { ownerRevoke } from '../../../src/core/vault';
import type { AgentTool } from './modelClient';

export const VAULT_FUNDS_SATOSHIS = 30_000n;
export const LIMIT_CHOICES_SATOSHIS = [1_000, 2_000, 5_000] as const;
const SANDBOX_NETWORK = 'mocknet';
const SUPPLIER_LABELS = ['Price Feed Co', 'Weather API'] as const;

const paySchema = z.object({
  recipientAddress: z.string().describe('Bitcoin Cash address to pay'),
  amountSatoshis: z.number().int().describe('Amount in satoshis'),
  memo: z.string().optional().describe('Short on-chain note saying why this payment is made'),
});

export interface PaymentRecord {
  readonly recipient: string;
  readonly satoshis: number;
  readonly memo: string;
  readonly outcome: 'paid' | 'refused';
}

export interface MandateSandbox {
  readonly tools: readonly AgentTool[];
  readMandate(): Promise<MandateView>;
  readPayments(): readonly PaymentRecord[];
  revokeAsOwner(): Promise<string>;
}

/** An address the mandate does not approve, for the vendor message that tries to redirect a payment. */
export function createUnapprovedAddress(): string {
  return generateAgentIdentity('stranger', SANDBOX_NETWORK).address;
}

/**
 * A private mandate on a simulated network. The CashMandate covenant is the
 * real script, so a payment it forbids is refused in this tab exactly as on
 * chipnet; only the network and the keys are throwaway.
 */
export function createMandateSandbox(perSpendLimitSatoshis: number): MandateSandbox {
  const provider = new MockNetworkProvider();
  const owner = generateAgentIdentity('owner', SANDBOX_NETWORK);
  const agent = generateAgentIdentity('agent', SANDBOX_NETWORK);
  const suppliers = SUPPLIER_LABELS.map(function createSupplier(label) {
    return generateAgentIdentity(label, SANDBOX_NETWORK);
  });

  const terms: MandateTerms = {
    ownerPublicKeyHash: owner.publicKeyHash,
    agentPublicKey: agent.publicKey,
    approvedRecipients: suppliers.map(function toHash(supplier) {
      return supplier.publicKeyHash;
    }),
    perSpendLimitSatoshis: BigInt(perSpendLimitSatoshis),
    minimumBlocksBetweenSpends: 0,
  };
  const contract = instantiateMandateContract(terms, provider);
  provider.addUtxo(contract.address, randomUtxo({ satoshis: VAULT_FUNDS_SATOSHIS }));

  const agentApi: MandateAgentTools = createMandateAgentTools({ provider, terms, agent, recipientLabels: SUPPLIER_LABELS });
  const payments: PaymentRecord[] = [];

  async function pay(toolArguments: Record<string, unknown>) {
    const input = paySchema.parse(toolArguments);
    const result = await agentApi.pay(input.recipientAddress, input.amountSatoshis, input.memo);
    payments.push({
      recipient: input.recipientAddress,
      satoshis: input.amountSatoshis,
      memo: input.memo ?? '',
      outcome: result.accepted ? 'paid' : 'refused',
    });
    return result;
  }

  const tools: AgentTool[] = [
    {
      name: 'get_mandate',
      description:
        'Read the spending mandate: the vault balance, the per-payment limit, the minimum blocks between payments, and the approved recipients.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        return agentApi.getMandate();
      },
    },
    {
      name: 'pay',
      description:
        'Pay a recipient from the mandate vault. The Bitcoin Cash covenant enforces the mandate; a payment it forbids is refused by the network and the refusal is returned.',
      parameters: z.toJSONSchema(paySchema),
      execute: pay,
    },
  ];

  async function revokeAsOwner(): Promise<string> {
    const receipt = await ownerRevoke({ provider, contract, owner });
    return receipt.transactionId;
  }

  return {
    tools,
    readMandate: agentApi.getMandate,
    readPayments: function readPayments() {
      return [...payments];
    },
    revokeAsOwner,
  };
}
