import { decodeCashAddress } from '@bitauth/libauth';
import type { NetworkProvider } from 'cashscript';
import { MAXIMUM_MEMO_BYTES } from '../core/constants';
import type { AgentIdentity } from '../core/identity';
import { instantiateMandateContract } from '../core/mandateContract';
import type { MandateTerms } from '../core/terms';
import { agentSpend, findVaultUtxo, recipientAddressFor } from '../core/vault';

export interface ApprovedRecipientView {
  readonly index: number;
  readonly label: string;
  readonly address: string;
}

export interface MandateView {
  readonly vaultAddress: string;
  readonly vaultBalanceSatoshis: number;
  readonly perSpendLimitSatoshis: number;
  readonly minimumBlocksBetweenSpends: number;
  readonly approvedRecipients: readonly ApprovedRecipientView[];
}

export type PaymentResult =
  | { readonly accepted: true; readonly transactionId: string; readonly paidSatoshis: number }
  | { readonly accepted: false; readonly refusedBy: 'covenant' | 'request'; readonly reason: string };

export interface MandateAgentToolsConfig {
  readonly provider: NetworkProvider;
  readonly terms: MandateTerms;
  readonly agent: AgentIdentity;
  /** Human names for the approved recipients, in the same order as the terms. */
  readonly recipientLabels: readonly string[];
}

export interface MandateAgentTools {
  getMandate(): Promise<MandateView>;
  pay(recipientAddress: string, amountSatoshis: number, memo: string | undefined): Promise<PaymentResult>;
}

const UNLISTED_RECIPIENT_INDEX = 0;
const NETWORK_REFUSAL_PATTERN = /Require statement failed|script|verify|rejected|non-final|bad-txns/i;
const DEBUG_LINK_MARKER = 'WARNING:';

function isValidCashAddress(address: string): boolean {
  return typeof decodeCashAddress(address) !== 'string';
}

/**
 * The surface an agent sees. It deliberately performs no policy checks of its
 * own: a payment the mandate forbids is built, signed with the agent key and
 * broadcast, so the refusal the agent receives is the covenant's, not ours.
 */
export function createMandateAgentTools(config: MandateAgentToolsConfig): MandateAgentTools {
  const { provider, terms, agent, recipientLabels } = config;
  const contract = instantiateMandateContract(terms, provider);

  function listApprovedRecipients(): ApprovedRecipientView[] {
    return terms.approvedRecipients.map(function describeRecipient(recipientHash, recipientIndex) {
      return {
        index: recipientIndex,
        label: recipientLabels[recipientIndex] ?? `recipient ${recipientIndex}`,
        address: recipientAddressFor(recipientHash, contract.address),
      };
    });
  }

  async function getMandate(): Promise<MandateView> {
    const vaultUtxos = await contract.getUtxos();
    const vaultBalance = vaultUtxos.reduce(function addValue(total, utxo) {
      return total + utxo.satoshis;
    }, 0n);
    return {
      vaultAddress: contract.address,
      vaultBalanceSatoshis: Number(vaultBalance),
      perSpendLimitSatoshis: Number(terms.perSpendLimitSatoshis),
      minimumBlocksBetweenSpends: terms.minimumBlocksBetweenSpends,
      approvedRecipients: listApprovedRecipients(),
    };
  }

  async function pay(
    recipientAddress: string,
    amountSatoshis: number,
    memo: string | undefined,
  ): Promise<PaymentResult> {
    if (!isValidCashAddress(recipientAddress)) {
      return { accepted: false, refusedBy: 'request', reason: `"${recipientAddress}" is not a valid cash address` };
    }
    if (!Number.isInteger(amountSatoshis) || amountSatoshis <= 0) {
      return { accepted: false, refusedBy: 'request', reason: 'amountSatoshis must be a positive whole number' };
    }
    if (memo !== undefined && new TextEncoder().encode(memo).length > MAXIMUM_MEMO_BYTES) {
      return { accepted: false, refusedBy: 'request', reason: `memo is longer than ${MAXIMUM_MEMO_BYTES} bytes` };
    }

    const approvedMatch = listApprovedRecipients().find(function matchesAddress(approved) {
      return approved.address === recipientAddress;
    });
    try {
      await findVaultUtxo(contract);
      const receipt = await agentSpend({
        provider,
        contract,
        terms,
        agent,
        recipientIndex: approvedMatch?.index ?? UNLISTED_RECIPIENT_INDEX,
        paymentSatoshis: BigInt(amountSatoshis),
        ...(memo === undefined ? {} : { memo }),
        ...(approvedMatch === undefined ? { paymentAddressOverride: recipientAddress } : {}),
      });
      return { accepted: true, transactionId: receipt.transactionId, paidSatoshis: amountSatoshis };
    } catch (failure) {
      const fullMessage = failure instanceof Error ? failure.message : String(failure);
      const reason = fullMessage.split(DEBUG_LINK_MARKER)[0]?.trim() ?? fullMessage;
      const wasRefusedByNetwork = NETWORK_REFUSAL_PATTERN.test(reason);
      return { accepted: false, refusedBy: wasRefusedByNetwork ? 'covenant' : 'request', reason };
    }
  }

  return { getMandate, pay };
}
