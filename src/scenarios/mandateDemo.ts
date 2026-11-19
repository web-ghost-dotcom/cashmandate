import type { NetworkProvider } from 'cashscript';
import type { AgentRoster } from '../core/agentRoster';
import { instantiateMandateContract } from '../core/mandateContract';
import type { BlockedAttempt, LedgerEntry, MandateRecord } from '../core/mandateRecord';
import {
  serializeMandateTerms,
  type MandateTerms,
} from '../core/terms';
import {
  agentSpend,
  buildAgentSpend,
  findVaultUtxo,
  fundVault,
  ownerRevoke,
  recipientAddressFor,
  type TransactionReceipt,
} from '../core/vault';
import { SPEND_FEE_SATOSHIS } from '../core/constants';

export interface MandateDemoContext {
  readonly provider: NetworkProvider;
  readonly roster: AgentRoster;
  readonly network: MandateRecord['network'];
  /** Resolves once the transaction has at least one confirmation. A no-op on the mock network. */
  readonly waitForConfirmation: (transactionId: string) => Promise<void>;
  readonly onProgress: (message: string) => void;
}

const NOT_FINAL_PATTERN = /BIP68|non-final|nonfinal/i;
const FINALITY_RETRY_INTERVAL_MILLISECONDS = 20_000;
const FINALITY_RETRY_LIMIT = 180;

/**
 * Electrum servers can report a confirmation before the node that relays
 * transactions has processed the block. Spends of a just-confirmed output are
 * retried while the node still considers them non-final.
 */
async function retryWhileNotFinal<Result>(action: () => Promise<Result>): Promise<Result> {
  for (let attemptNumber = 1; ; attemptNumber += 1) {
    try {
      return await action();
    } catch (failure) {
      const isNotFinal = failure instanceof Error && NOT_FINAL_PATTERN.test(failure.message);
      if (!isNotFinal || attemptNumber >= FINALITY_RETRY_LIMIT) {
        throw failure;
      }
      await new Promise(function pause(resolvePause) {
        setTimeout(resolvePause, FINALITY_RETRY_INTERVAL_MILLISECONDS);
      });
    }
  }
}

export const DEMO_VAULT_SATOSHIS = 30_000n;
export const DEMO_PER_SPEND_LIMIT_SATOSHIS = 5_000n;
export const DEMO_MINIMUM_BLOCKS_BETWEEN_SPENDS = 1;

export async function runMandateDemo(context: MandateDemoContext): Promise<MandateRecord> {
  const { provider, roster, onProgress } = context;
  const terms: MandateTerms = {
    ownerPublicKeyHash: roster.owner.publicKeyHash,
    agentPublicKey: roster.agent.publicKey,
    approvedRecipients: [roster.merchantOne.publicKeyHash, roster.merchantTwo.publicKeyHash],
    perSpendLimitSatoshis: DEMO_PER_SPEND_LIMIT_SATOSHIS,
    minimumBlocksBetweenSpends: DEMO_MINIMUM_BLOCKS_BETWEEN_SPENDS,
  };
  const contract = instantiateMandateContract(terms, provider);
  const leftoverVaultOutputs = await contract.getUtxos();
  if (leftoverVaultOutputs.length > 0) {
    throw new Error(
      `Vault ${contract.address} already holds ${leftoverVaultOutputs.length} output(s). Revoke it before running the demo again.`,
    );
  }

  const ledger: LedgerEntry[] = [];
  const blockedAttempts: BlockedAttempt[] = [];

  onProgress('Owner funds the vault');
  const fundingReceipt = await fundVault({ provider, contract, owner: roster.owner, vaultSatoshis: DEMO_VAULT_SATOSHIS });
  ledger.push(describeLedgerEntry('funding', 'Owner funds the mandate vault', fundingReceipt, null, null, null));

  onProgress('Waiting for the vault funding to confirm');
  await context.waitForConfirmation(fundingReceipt.transactionId);

  const baseRequest = { provider, contract, terms, agent: roster.agent };

  onProgress('Attempt: payment above the per-spend limit');
  blockedAttempts.push(
    await recordBlockedAttempt(
      {
        attemptId: 'over-limit',
        title: 'Spend above the limit',
        description: `The agent tries to pay ${DEMO_PER_SPEND_LIMIT_SATOSHIS + 1_000n} satoshis; the mandate caps each spend at ${DEMO_PER_SPEND_LIMIT_SATOSHIS}.`,
        rule: 'spending-limit',
      },
      await buildAgentSpend({ ...baseRequest, recipientIndex: 0, paymentSatoshis: DEMO_PER_SPEND_LIMIT_SATOSHIS + 1_000n }),
      provider,
    ),
  );

  onProgress('Attempt: payment to an unapproved address');
  blockedAttempts.push(
    await recordBlockedAttempt(
      {
        attemptId: 'unapproved-recipient',
        title: 'Pay a stranger',
        description: 'The agent tries to pay an address that is not on the approved list.',
        rule: 'recipient-allowlist',
      },
      await buildAgentSpend({
        ...baseRequest,
        recipientIndex: 0,
        paymentSatoshis: 2_000n,
        paymentAddressOverride: roster.stranger.address,
      }),
      provider,
    ),
  );

  onProgress('Attempt: agent sweeps the vault to itself');
  blockedAttempts.push(
    await recordBlockedAttempt(
      {
        attemptId: 'agent-sweep',
        title: 'Sweep the vault',
        description: 'The agent tries to send nearly the whole vault to its own address.',
        rule: 'vault-return',
      },
      await buildAgentSpend({
        ...baseRequest,
        recipientIndex: 0,
        paymentSatoshis: DEMO_VAULT_SATOSHIS - SPEND_FEE_SATOSHIS - 1_000n,
        paymentAddressOverride: roster.agent.address,
      }),
      provider,
    ),
  );

  onProgress('Agent spends inside the mandate');
  const firstSpendReceipt = await retryWhileNotFinal(function sendFirstSpend() {
    return agentSpend({
      ...baseRequest,
      recipientIndex: 0,
      paymentSatoshis: 4_000n,
      memo: 'Invoice 1042: 24h price feed',
    });
  });
  ledger.push(
    describeLedgerEntry(
      'spend',
      'Agent pays Merchant One',
      firstSpendReceipt,
      4_000,
      recipientAddressFor(roster.merchantOne.publicKeyHash, contract.address),
      'Invoice 1042: 24h price feed',
    ),
  );

  // The mock network does not model how old an output is, so only a real
  // node can reject a spend of an output that is too young.
  if (context.network !== 'mocknet') {
    onProgress('Attempt: second spend before the interval has passed');
    blockedAttempts.push(
      await recordBlockedAttempt(
        {
          attemptId: 'too-soon',
          title: 'Spend again immediately',
          description: `The agent tries to spend the new vault output before ${DEMO_MINIMUM_BLOCKS_BETWEEN_SPENDS} block of age has passed.`,
          rule: 'rate-limit',
        },
        await buildAgentSpend({
          ...baseRequest,
          recipientIndex: 1,
          paymentSatoshis: 3_000n,
          vaultUtxo: await findVaultUtxo(contract),
        }),
        provider,
      ),
    );
  }

  onProgress('Waiting for the first spend to confirm');
  await context.waitForConfirmation(firstSpendReceipt.transactionId);

  onProgress('Agent spends again after the interval');
  const secondSpendReceipt = await retryWhileNotFinal(function sendSecondSpend() {
    return agentSpend({
      ...baseRequest,
      recipientIndex: 1,
      paymentSatoshis: 3_000n,
      memo: 'Invoice 1043: weather API credits',
    });
  });
  ledger.push(
    describeLedgerEntry(
      'spend',
      'Agent pays Merchant Two',
      secondSpendReceipt,
      3_000,
      recipientAddressFor(roster.merchantTwo.publicKeyHash, contract.address),
      'Invoice 1043: weather API credits',
    ),
  );

  onProgress('Owner revokes the mandate');
  const revokeReceipt = await ownerRevoke({ provider, contract, owner: roster.owner });
  ledger.push(describeLedgerEntry('revocation', 'Owner sweeps the remaining vault', revokeReceipt, null, null, null));

  return {
    schemaVersion: 1,
    network: context.network,
    title: 'Research agent mandate',
    contractAddress: contract.address,
    ownerAddress: roster.owner.address,
    agentAddress: roster.agent.address,
    terms: serializeMandateTerms(terms),
    recipients: [
      { label: 'Merchant One', address: recipientAddressFor(roster.merchantOne.publicKeyHash, contract.address) },
      { label: 'Merchant Two', address: recipientAddressFor(roster.merchantTwo.publicKeyHash, contract.address) },
    ],
    vaultSatoshis: Number(DEMO_VAULT_SATOSHIS),
    status: 'revoked',
    ledger,
    blockedAttempts,
  };
}

function describeLedgerEntry(
  kind: LedgerEntry['kind'],
  label: string,
  receipt: TransactionReceipt,
  paymentSatoshis: number | null,
  recipientAddress: string | null,
  memo: string | null,
): LedgerEntry {
  return { kind, label, transactionId: receipt.transactionId, paymentSatoshis, recipientAddress, memo };
}

type AttemptDescription = Omit<BlockedAttempt, 'rejectionMessage'>;

/**
 * Broadcasts the transaction without the SDK's local script check, so the
 * rejection recorded is the one the network returns.
 */
async function recordBlockedAttempt(
  description: AttemptDescription,
  rogueTransaction: Awaited<ReturnType<typeof buildAgentSpend>>,
  provider: NetworkProvider,
): Promise<BlockedAttempt> {
  const rawTransactionHex = rogueTransaction.build();
  try {
    const acceptedTransactionId = await provider.sendRawTransaction(rawTransactionHex);
    throw new Error(
      `Attempt ${description.attemptId} was accepted by the network as ${acceptedTransactionId}; the mandate failed to block it`,
    );
  } catch (rejection) {
    if (rejection instanceof Error && rejection.message.includes('was accepted by the network')) {
      throw rejection;
    }
    const rejectionText = rejection instanceof Error ? rejection.message : String(rejection);
    const firstLine = rejectionText.split('\n').find(function isNotBlank(line) {
      return line.trim().length > 0;
    });
    return { ...description, rejectionMessage: firstLine ?? 'Rejected by the network' };
  }
}
