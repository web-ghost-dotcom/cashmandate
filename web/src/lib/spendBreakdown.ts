import { SPEND_FEE_SATOSHIS } from '../../../src/core/constants';
import type { MandateRecord } from '../../../src/core/mandateRecord';

export interface BreakdownSegment {
  readonly key: string;
  readonly label: string;
  readonly satoshis: number;
  readonly tone: 'payment-first' | 'payment-second' | 'fees' | 'returned';
}

const PAYMENT_TONES = ['payment-first', 'payment-second'] as const;

/** Accounts for every satoshi the owner put into the vault. */
export function computeSpendBreakdown(record: MandateRecord): BreakdownSegment[] {
  const segments: BreakdownSegment[] = [];
  let accountedSatoshis = 0;

  const spendEntries = record.ledger.filter(function isSpend(entry) {
    return entry.kind === 'spend';
  });
  for (const [spendIndex, entry] of spendEntries.entries()) {
    const recipient = record.recipients.find(function matchesAddress(candidate) {
      return candidate.address === entry.recipientAddress;
    });
    const paymentSatoshis = entry.paymentSatoshis ?? 0;
    accountedSatoshis += paymentSatoshis;
    segments.push({
      key: entry.transactionId,
      label: recipient?.label ?? 'Approved recipient',
      satoshis: paymentSatoshis,
      tone: PAYMENT_TONES[spendIndex % PAYMENT_TONES.length] ?? 'payment-first',
    });
  }

  const feeCount = record.ledger.filter(function paysSpendFee(entry) {
    return entry.kind !== 'funding';
  }).length;
  const feeSatoshis = feeCount * Number(SPEND_FEE_SATOSHIS);
  accountedSatoshis += feeSatoshis;
  segments.push({ key: 'fees', label: 'Miner fees', satoshis: feeSatoshis, tone: 'fees' });

  const returnedSatoshis = Math.max(record.vaultSatoshis - accountedSatoshis, 0);
  segments.push({
    key: 'returned',
    label: record.status === 'revoked' ? 'Returned to owner' : 'Still in the vault',
    satoshis: returnedSatoshis,
    tone: 'returned',
  });
  return segments;
}
