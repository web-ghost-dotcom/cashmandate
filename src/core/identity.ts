import { SighashType, SignatureAlgorithm, SignatureTemplate } from 'cashscript';
import {
  CashAddressType,
  encodeCashAddress,
  generatePrivateKey,
  hash160,
  type CashAddressNetworkPrefix,
} from '@bitauth/libauth';
import { PRIVATE_KEY_BYTE_LENGTH } from './constants';
import { decodeHex, encodeHex } from './hex';

export type SupportedNetwork = 'mainnet' | 'chipnet' | 'testnet4' | 'testnet3' | 'regtest' | 'mocknet';

export interface AgentIdentity {
  readonly label: string;
  readonly privateKey: Uint8Array;
  readonly publicKey: Uint8Array;
  readonly publicKeyHash: Uint8Array;
  readonly address: string;
  /** Address form that can receive CashTokens. Same key, different version byte. */
  readonly tokenAddress: string;
  /** Schnorr signer: used for ordinary single-signature spends. */
  readonly signatureTemplate: SignatureTemplate;
  /** ECDSA signer: required for OP_CHECKMULTISIG, which rejects Schnorr signatures. */
  readonly multisigSignatureTemplate: SignatureTemplate;
}

function resolveAddressPrefix(network: SupportedNetwork): CashAddressNetworkPrefix {
  switch (network) {
    case 'mainnet':
      return 'bitcoincash' as CashAddressNetworkPrefix;
    case 'regtest':
      return 'bchreg' as CashAddressNetworkPrefix;
    default:
      return 'bchtest' as CashAddressNetworkPrefix;
  }
}

export function createAgentIdentity(
  label: string,
  privateKey: Uint8Array,
  network: SupportedNetwork,
): AgentIdentity {
  if (privateKey.length !== PRIVATE_KEY_BYTE_LENGTH) {
    throw new Error(`Private key for "${label}" must be ${PRIVATE_KEY_BYTE_LENGTH} bytes`);
  }
  const signatureTemplate = new SignatureTemplate(privateKey);
  const publicKey = signatureTemplate.publicKey;
  const publicKeyHash = hash160(publicKey);
  const addressPrefix = resolveAddressPrefix(network);
  const address = encodeCashAddress({
    prefix: addressPrefix,
    type: CashAddressType.p2pkh,
    payload: publicKeyHash,
  }).address;
  const tokenAddress = encodeCashAddress({
    prefix: addressPrefix,
    type: CashAddressType.p2pkhWithTokens,
    payload: publicKeyHash,
  }).address;
  const multisigSignatureTemplate = new SignatureTemplate(
    privateKey,
    SighashType.SIGHASH_ALL | SighashType.SIGHASH_UTXOS,
    SignatureAlgorithm.ECDSA,
  );

  return {
    label,
    privateKey,
    publicKey,
    publicKeyHash,
    address,
    tokenAddress,
    signatureTemplate,
    multisigSignatureTemplate,
  };
}

export function createAgentIdentityFromHex(
  label: string,
  privateKeyHex: string,
  network: SupportedNetwork,
): AgentIdentity {
  return createAgentIdentity(label, decodeHex(privateKeyHex, PRIVATE_KEY_BYTE_LENGTH), network);
}

export function generateAgentIdentity(label: string, network: SupportedNetwork): AgentIdentity {
  const privateKey = generatePrivateKey(function fillWithSecureRandomBytes() {
    return crypto.getRandomValues(new Uint8Array(PRIVATE_KEY_BYTE_LENGTH));
  });
  return createAgentIdentity(label, privateKey, network);
}

export function exportPrivateKeyHex(identity: AgentIdentity): string {
  return encodeHex(identity.privateKey);
}
