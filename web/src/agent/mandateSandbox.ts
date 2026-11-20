import { binToHex, decodeCashAddress } from '@bitauth/libauth';
import { ElectrumNetworkProvider, MockNetworkProvider, Network, randomUtxo, type NetworkProvider } from 'cashscript';
import { z } from 'zod';
import { createMandateAgentTools, type MandateAgentTools, type MandateView } from '../../../src/agent/mandateAgentTools';
import { generateAgentIdentity, type AgentIdentity, type SupportedNetwork } from '../../../src/core/identity';
import { instantiateMandateContract } from '../../../src/core/mandateContract';
import type { MandateTerms } from '../../../src/core/terms';
import { ownerRevoke } from '../../../src/core/vault';
import type { AgentTool } from './modelClient';

export const VAULT_FUNDS_SATOSHIS = 30_000n;
export const LIMIT_CHOICES_SATOSHIS = [1_000, 2_000, 5_000] as const;
const SANDBOX_NETWORK = 'mocknet';
const MAINNET_NETWORK = 'mainnet';
const SUPPLIER_LABELS = ['Price Feed Co', 'Weather API'] as const;
const PUBLIC_KEY_HASH_BYTE_LENGTH = 20;

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

export interface MandateWorld {
  readonly tools: readonly AgentTool[];
  readonly vaultAddress: string;
  readMandate(): Promise<MandateView>;
  readPayments(): readonly PaymentRecord[];
  /** Sweeps the vault with the owner key. The destination defaults to the owner's own address. */
  revokeAsOwner(destinationAddress?: string): Promise<string>;
}

/** An address the mandate does not approve, for the vendor message that tries to redirect a payment. */
export function createUnapprovedAddress(network: SupportedNetwork = SANDBOX_NETWORK): string {
  return generateAgentIdentity('stranger', network).address;
}

function publicKeyHashOf(address: string): Uint8Array {
  const decoded = decodeCashAddress(address);
  if (typeof decoded === 'string' || decoded.payload.length !== PUBLIC_KEY_HASH_BYTE_LENGTH) {
    throw new Error(`Cannot use ${address} as an approved recipient`);
  }
  return decoded.payload;
}

interface MandateSetup {
  readonly provider: NetworkProvider;
  readonly owner: AgentIdentity;
  readonly agent: AgentIdentity;
  readonly supplierHashes: readonly Uint8Array[];
  readonly perSpendLimitSatoshis: number;
}

function assembleMandate(setup: MandateSetup) {
  const { provider, owner, agent, supplierHashes, perSpendLimitSatoshis } = setup;
  const terms: MandateTerms = {
    ownerPublicKeyHash: owner.publicKeyHash,
    agentPublicKey: agent.publicKey,
    approvedRecipients: [...supplierHashes],
    perSpendLimitSatoshis: BigInt(perSpendLimitSatoshis),
    minimumBlocksBetweenSpends: 0,
  };
  const contract = instantiateMandateContract(terms, provider);
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

  async function revokeAsOwner(destinationAddress?: string): Promise<string> {
    const receipt = await ownerRevoke({
      provider,
      contract,
      owner,
      ...(destinationAddress === undefined ? {} : { destinationAddress }),
    });
    return receipt.transactionId;
  }

  const world: MandateWorld = {
    tools,
    vaultAddress: contract.address,
    readMandate: agentApi.getMandate,
    readPayments: function readPayments() {
      return [...payments];
    },
    revokeAsOwner,
  };
  return world;
}

/**
 * A private mandate on a simulated network. The CashMandate covenant is the
 * real script, so a payment it forbids is refused in this tab exactly as on
 * chipnet; only the network and the keys are throwaway.
 */
export function createMandateSandbox(perSpendLimitSatoshis: number): MandateWorld {
  const provider = new MockNetworkProvider();
  const owner = generateAgentIdentity('owner', SANDBOX_NETWORK);
  const agent = generateAgentIdentity('agent', SANDBOX_NETWORK);
  const supplierHashes = SUPPLIER_LABELS.map(function createSupplier(label) {
    return generateAgentIdentity(label, SANDBOX_NETWORK).publicKeyHash;
  });
  const world = assembleMandate({ provider, owner, agent, supplierHashes, perSpendLimitSatoshis });
  provider.addUtxo(world.vaultAddress, randomUtxo({ satoshis: VAULT_FUNDS_SATOSHIS }));
  return world;
}

export interface MainnetMandate {
  readonly world: MandateWorld;
  readonly provider: NetworkProvider;
  readonly exportKeys: () => string;
}

/**
 * A mandate on Bitcoin Cash mainnet. The owner and agent keys are generated in
 * this tab, and both approved suppliers are addresses of the user's own wallet,
 * so every payment the agent makes comes back to them.
 */
export function createMainnetMandate(perSpendLimitSatoshis: number, supplierAddresses: readonly string[]): MainnetMandate {
  const provider = new ElectrumNetworkProvider(Network.MAINNET);
  const owner = generateAgentIdentity('owner', MAINNET_NETWORK);
  const agent = generateAgentIdentity('agent', MAINNET_NETWORK);
  const world = assembleMandate({
    provider,
    owner,
    agent,
    supplierHashes: supplierAddresses.map(publicKeyHashOf),
    perSpendLimitSatoshis,
  });
  function exportKeys(): string {
    return JSON.stringify(
      {
        network: MAINNET_NETWORK,
        vaultAddress: world.vaultAddress,
        ownerPrivateKeyHex: binToHex(owner.privateKey),
        agentPrivateKeyHex: binToHex(agent.privateKey),
      },
      null,
      2,
    );
  }
  return { world, provider, exportKeys };
}
