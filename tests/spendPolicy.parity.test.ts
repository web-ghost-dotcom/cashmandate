import { describe, expect, it } from 'vitest';
import { evaluateSpendProposal } from '../src/core/spendPolicy';
import { agentSpend } from '../src/core/vault';
import {
  MINIMUM_BLOCKS_BETWEEN_SPENDS,
  PER_SPEND_LIMIT_SATOSHIS,
  VAULT_SATOSHIS,
  createMandateFixture,
} from './mandateFixture';

interface ParityCase {
  readonly description: string;
  readonly paymentSatoshis: bigint;
  readonly useApprovedRecipient: boolean;
  readonly sequenceBlocks: number;
}

const PARITY_CASES: readonly ParityCase[] = [
  { description: 'in policy', paymentSatoshis: 4_000n, useApprovedRecipient: true, sequenceBlocks: MINIMUM_BLOCKS_BETWEEN_SPENDS },
  { description: 'at the limit', paymentSatoshis: PER_SPEND_LIMIT_SATOSHIS, useApprovedRecipient: true, sequenceBlocks: MINIMUM_BLOCKS_BETWEEN_SPENDS },
  { description: 'over the limit', paymentSatoshis: PER_SPEND_LIMIT_SATOSHIS + 1n, useApprovedRecipient: true, sequenceBlocks: MINIMUM_BLOCKS_BETWEEN_SPENDS },
  { description: 'unapproved payee', paymentSatoshis: 2_000n, useApprovedRecipient: false, sequenceBlocks: MINIMUM_BLOCKS_BETWEEN_SPENDS },
  { description: 'too soon', paymentSatoshis: 2_000n, useApprovedRecipient: true, sequenceBlocks: MINIMUM_BLOCKS_BETWEEN_SPENDS - 1 },
  { description: 'several rules broken', paymentSatoshis: 9_000n, useApprovedRecipient: false, sequenceBlocks: 0 },
];

describe('policy evaluator parity with the covenant', function describeParity() {
  for (const parityCase of PARITY_CASES) {
    it(`agrees with the contract: ${parityCase.description}`, async function () {
      const fixture = createMandateFixture();
      const verdict = evaluateSpendProposal(fixture.terms, {
        paymentSatoshis: parityCase.paymentSatoshis,
        approvedRecipientIndex: parityCase.useApprovedRecipient ? 0 : null,
        vaultAgeInBlocks: parityCase.sequenceBlocks,
        vaultSatoshis: VAULT_SATOSHIS,
      });

      let contractAccepted = true;
      try {
        await agentSpend({
          provider: fixture.provider,
          contract: fixture.contract,
          terms: fixture.terms,
          agent: fixture.agent,
          recipientIndex: 0,
          paymentSatoshis: parityCase.paymentSatoshis,
          sequenceBlocksOverride: parityCase.sequenceBlocks,
          ...(parityCase.useApprovedRecipient ? {} : { paymentAddressOverride: fixture.stranger.address }),
        });
      } catch {
        contractAccepted = false;
      }

      expect(verdict.isAllowed).toBe(contractAccepted);
    });
  }
});
