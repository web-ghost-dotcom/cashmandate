import { sha256 } from '@bitauth/libauth';
import { RECIPIENT_ENTRY_BYTE_LENGTH } from './constants';
import { InvalidMandateTermsError } from './errors';
import { decodeHex, encodeHex } from './hex';

const PUBLIC_KEY_HASH_BYTE_LENGTH = 20;
const COMPRESSED_PUBLIC_KEY_BYTE_LENGTH = 33;
const MAXIMUM_APPROVED_RECIPIENTS = 16;
const MAXIMUM_RELATIVE_BLOCKS = 65_535;
const DUST_LIMIT_SATOSHIS = 546n;

export interface MandateTerms {
  readonly ownerPublicKeyHash: Uint8Array;
  readonly agentPublicKey: Uint8Array;
  /** Public key hashes the agent may pay, in a fixed order. */
  readonly approvedRecipients: readonly Uint8Array[];
  readonly perSpendLimitSatoshis: bigint;
  readonly minimumBlocksBetweenSpends: number;
}

/** JSON-safe form of MandateTerms. */
export interface SerializedMandateTerms {
  readonly ownerPublicKeyHashHex: string;
  readonly agentPublicKeyHex: string;
  readonly approvedRecipientsHex: string[];
  readonly perSpendLimitSatoshis: number;
  readonly minimumBlocksBetweenSpends: number;
}

export function concatenateRecipients(approvedRecipients: readonly Uint8Array[]): Uint8Array {
  const concatenated = new Uint8Array(approvedRecipients.length * RECIPIENT_ENTRY_BYTE_LENGTH);
  for (const [recipientIndex, recipientHash] of approvedRecipients.entries()) {
    concatenated.set(recipientHash, recipientIndex * RECIPIENT_ENTRY_BYTE_LENGTH);
  }
  return concatenated;
}

export function computeApprovedRecipientsHash(approvedRecipients: readonly Uint8Array[]): Uint8Array {
  return sha256.hash(concatenateRecipients(approvedRecipients));
}

export function validateMandateTerms(terms: MandateTerms): void {
  if (terms.ownerPublicKeyHash.length !== PUBLIC_KEY_HASH_BYTE_LENGTH) {
    throw new InvalidMandateTermsError('owner public key hash must be 20 bytes');
  }
  if (terms.agentPublicKey.length !== COMPRESSED_PUBLIC_KEY_BYTE_LENGTH) {
    throw new InvalidMandateTermsError('agent key must be a 33-byte compressed public key');
  }
  if (terms.approvedRecipients.length === 0) {
    throw new InvalidMandateTermsError('at least one approved recipient is required');
  }
  if (terms.approvedRecipients.length > MAXIMUM_APPROVED_RECIPIENTS) {
    throw new InvalidMandateTermsError(`no more than ${MAXIMUM_APPROVED_RECIPIENTS} recipients are supported`);
  }
  for (const [recipientIndex, recipientHash] of terms.approvedRecipients.entries()) {
    if (recipientHash.length !== RECIPIENT_ENTRY_BYTE_LENGTH) {
      throw new InvalidMandateTermsError(`recipient ${recipientIndex} must be a 20-byte public key hash`);
    }
  }
  if (terms.perSpendLimitSatoshis < DUST_LIMIT_SATOSHIS) {
    throw new InvalidMandateTermsError(`per-spend limit must be at least ${DUST_LIMIT_SATOSHIS} satoshis`);
  }
  const isWholeBlockCount = Number.isInteger(terms.minimumBlocksBetweenSpends);
  if (!isWholeBlockCount || terms.minimumBlocksBetweenSpends < 0 || terms.minimumBlocksBetweenSpends > MAXIMUM_RELATIVE_BLOCKS) {
    throw new InvalidMandateTermsError(`interval must be a whole number of blocks from 0 to ${MAXIMUM_RELATIVE_BLOCKS}`);
  }
}

export function serializeMandateTerms(terms: MandateTerms): SerializedMandateTerms {
  return {
    ownerPublicKeyHashHex: encodeHex(terms.ownerPublicKeyHash),
    agentPublicKeyHex: encodeHex(terms.agentPublicKey),
    approvedRecipientsHex: terms.approvedRecipients.map(function encodeRecipient(recipientHash) {
      return encodeHex(recipientHash);
    }),
    perSpendLimitSatoshis: Number(terms.perSpendLimitSatoshis),
    minimumBlocksBetweenSpends: terms.minimumBlocksBetweenSpends,
  };
}

export function deserializeMandateTerms(serialized: SerializedMandateTerms): MandateTerms {
  const terms: MandateTerms = {
    ownerPublicKeyHash: decodeHex(serialized.ownerPublicKeyHashHex, PUBLIC_KEY_HASH_BYTE_LENGTH),
    agentPublicKey: decodeHex(serialized.agentPublicKeyHex, COMPRESSED_PUBLIC_KEY_BYTE_LENGTH),
    approvedRecipients: serialized.approvedRecipientsHex.map(function decodeRecipient(recipientHex) {
      return decodeHex(recipientHex, RECIPIENT_ENTRY_BYTE_LENGTH);
    }),
    perSpendLimitSatoshis: BigInt(serialized.perSpendLimitSatoshis),
    minimumBlocksBetweenSpends: serialized.minimumBlocksBetweenSpends,
  };
  validateMandateTerms(terms);
  return terms;
}
