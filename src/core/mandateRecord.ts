import { z } from 'zod';

const ledgerEntrySchema = z.object({
  kind: z.enum(['funding', 'spend', 'revocation']),
  label: z.string(),
  transactionId: z.string().length(64),
  paymentSatoshis: z.number().nullable(),
  recipientAddress: z.string().nullable(),
  memo: z.string().nullable(),
});

const blockedAttemptSchema = z.object({
  attemptId: z.string(),
  title: z.string(),
  description: z.string(),
  rule: z.enum(['spending-limit', 'recipient-allowlist', 'rate-limit', 'vault-return']),
  /** Verbatim first line of the rejection returned when the transaction was broadcast. */
  rejectionMessage: z.string(),
});

export const mandateRecordSchema = z.object({
  schemaVersion: z.literal(1),
  network: z.enum(['chipnet', 'mainnet', 'mocknet']),
  title: z.string(),
  contractAddress: z.string(),
  ownerAddress: z.string(),
  agentAddress: z.string(),
  terms: z.object({
    ownerPublicKeyHashHex: z.string(),
    agentPublicKeyHex: z.string(),
    approvedRecipientsHex: z.array(z.string()),
    perSpendLimitSatoshis: z.number(),
    minimumBlocksBetweenSpends: z.number(),
  }),
  recipients: z.array(z.object({ label: z.string(), address: z.string() })),
  vaultSatoshis: z.number(),
  status: z.enum(['active', 'revoked']),
  ledger: z.array(ledgerEntrySchema),
  blockedAttempts: z.array(blockedAttemptSchema),
});

export type MandateRecord = z.infer<typeof mandateRecordSchema>;
export type LedgerEntry = MandateRecord['ledger'][number];
export type BlockedAttempt = MandateRecord['blockedAttempts'][number];
