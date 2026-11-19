import { SPEND_FEE_SATOSHIS } from './constants';
import type { MandateTerms } from './terms';

export type PolicyRule = 'spending-limit' | 'recipient-allowlist' | 'rate-limit' | 'vault-return';

export interface SpendProposal {
  readonly paymentSatoshis: bigint;
  /** Index into the approved list, or null when the payee is not on it. */
  readonly approvedRecipientIndex: number | null;
  /** Blocks of age the vault output has accumulated. */
  readonly vaultAgeInBlocks: number;
  readonly vaultSatoshis: bigint;
}

export interface RuleResult {
  readonly rule: PolicyRule;
  readonly passed: boolean;
  readonly explanation: string;
}

export interface PolicyVerdict {
  readonly isAllowed: boolean;
  readonly results: readonly RuleResult[];
}

/**
 * A readable model of what the covenant enforces. The contract is the source
 * of truth; tests assert this function and the contract agree.
 */
function describePaceResult(requiredBlocks: number, ageInBlocks: number, isOldEnough: boolean): string {
  if (requiredBlocks === 0) {
    return 'The mandate sets no minimum wait between spends';
  }
  return isOldEnough
    ? `The vault output is ${describeBlocks(ageInBlocks)} old, enough for a ${describeBlocks(requiredBlocks)} interval`
    : `The vault output is ${describeBlocks(ageInBlocks)} old; ${describeBlocks(requiredBlocks)} required`;
}

export function evaluateSpendProposal(terms: MandateTerms, proposal: SpendProposal): PolicyVerdict {
  const withinLimit = proposal.paymentSatoshis <= terms.perSpendLimitSatoshis;
  const recipientApproved =
    proposal.approvedRecipientIndex !== null &&
    proposal.approvedRecipientIndex >= 0 &&
    proposal.approvedRecipientIndex < terms.approvedRecipients.length;
  const oldEnough = proposal.vaultAgeInBlocks >= terms.minimumBlocksBetweenSpends;
  const remainder = proposal.vaultSatoshis - proposal.paymentSatoshis - SPEND_FEE_SATOSHIS;
  const remainderReturned = remainder >= 0n;

  const results: RuleResult[] = [
    {
      rule: 'spending-limit',
      passed: withinLimit,
      explanation: withinLimit
        ? `${proposal.paymentSatoshis} is within the ${terms.perSpendLimitSatoshis} satoshi limit`
        : `${proposal.paymentSatoshis} exceeds the ${terms.perSpendLimitSatoshis} satoshi limit`,
    },
    {
      rule: 'recipient-allowlist',
      passed: recipientApproved,
      explanation: recipientApproved
        ? 'The payee is on the approved list'
        : 'The payee is not on the approved list',
    },
    {
      rule: 'rate-limit',
      passed: oldEnough,
      explanation: describePaceResult(terms.minimumBlocksBetweenSpends, proposal.vaultAgeInBlocks, oldEnough),
    },
    {
      rule: 'vault-return',
      passed: remainderReturned,
      explanation: remainderReturned
        ? `${remainder} satoshis return to the vault`
        : 'The vault cannot cover the payment and the fee',
    },
  ];

  return { isAllowed: results.every(isPassed), results };
}

function describeBlocks(blockCount: number): string {
  return blockCount === 1 ? '1 block' : `${blockCount} blocks`;
}

function isPassed(result: RuleResult): boolean {
  return result.passed;
}
