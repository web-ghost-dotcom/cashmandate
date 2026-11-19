import { CashAddressType, decodeCashAddress } from '@bitauth/libauth';
import { RECIPIENT_ENTRY_BYTE_LENGTH } from '../../../src/core/constants';
import { decodeHex } from '../../../src/core/hex';
import { instantiateMandateContract } from '../../../src/core/mandateContract';
import {
  serializeMandateTerms,
  validateMandateTerms,
  type MandateTerms,
  type SerializedMandateTerms,
} from '../../../src/core/terms';
import { getChainProvider } from './chain';

const COMPRESSED_PUBLIC_KEY_BYTE_LENGTH = 33;

export interface MandateDraftRequest {
  readonly ownerAddress: string;
  readonly agentPublicKeyHex: string;
  /** One address per line. */
  readonly recipientAddressesText: string;
  readonly perSpendLimitSatoshis: string;
  readonly minimumBlocksBetweenSpends: string;
}

export interface MandateDraft {
  readonly contractAddress: string;
  readonly terms: SerializedMandateTerms;
}

export class DraftValidationError extends Error {
  public constructor(
    public readonly fieldName: string,
    message: string,
  ) {
    super(message);
    this.name = 'DraftValidationError';
  }
}

function decodePublicKeyHash(address: string, fieldName: string): Uint8Array {
  const decodedAddress = decodeCashAddress(address.trim());
  if (typeof decodedAddress === 'string') {
    throw new DraftValidationError(fieldName, `"${address.trim()}" is not a valid Bitcoin Cash address.`);
  }
  const isPayToPublicKeyHash =
    decodedAddress.type === CashAddressType.p2pkh || decodedAddress.type === CashAddressType.p2pkhWithTokens;
  if (!isPayToPublicKeyHash || decodedAddress.payload.length !== RECIPIENT_ENTRY_BYTE_LENGTH) {
    throw new DraftValidationError(fieldName, 'Use a standard single-key address, not a script address.');
  }
  return decodedAddress.payload;
}

function parseWholeNumber(text: string, fieldName: string, minimum: number): number {
  const parsedNumber = Number(text.trim());
  if (!Number.isInteger(parsedNumber) || parsedNumber < minimum) {
    throw new DraftValidationError(fieldName, `Enter a whole number, at least ${minimum}.`);
  }
  return parsedNumber;
}

export function draftMandate(request: MandateDraftRequest): MandateDraft {
  const ownerPublicKeyHash = decodePublicKeyHash(request.ownerAddress, 'owner');

  let agentPublicKey: Uint8Array;
  try {
    agentPublicKey = decodeHex(request.agentPublicKeyHex, COMPRESSED_PUBLIC_KEY_BYTE_LENGTH);
  } catch {
    throw new DraftValidationError('agent', 'Enter a 33-byte compressed public key as 66 hexadecimal characters.');
  }

  const recipientLines = request.recipientAddressesText
    .split('\n')
    .map(function trimLine(line) {
      return line.trim();
    })
    .filter(function isNotBlank(line) {
      return line.length > 0;
    });
  const approvedRecipients = recipientLines.map(function decodeRecipient(line) {
    return decodePublicKeyHash(line, 'recipients');
  });

  const terms: MandateTerms = {
    ownerPublicKeyHash,
    agentPublicKey,
    approvedRecipients,
    perSpendLimitSatoshis: BigInt(parseWholeNumber(request.perSpendLimitSatoshis, 'limit', 546)),
    minimumBlocksBetweenSpends: parseWholeNumber(request.minimumBlocksBetweenSpends, 'interval', 0),
  };

  try {
    validateMandateTerms(terms);
  } catch (validationFailure) {
    const message = validationFailure instanceof Error ? validationFailure.message : 'Invalid terms';
    throw new DraftValidationError('terms', message);
  }

  const contract = instantiateMandateContract(terms, getChainProvider());
  return { contractAddress: contract.address, terms: serializeMandateTerms(terms) };
}
