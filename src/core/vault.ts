import {
  TransactionBuilder,
  type NetworkProvider,
  type SpendableUtxo,
} from 'cashscript';
import {
  MAXIMUM_MEMO_BYTES,
  MINIMUM_RELAY_FEE_RATE,
  SPEND_FEE_SATOSHIS,
} from './constants';
import {
  InsufficientFundsError,
  InvalidMandateTermsError,
  UnknownRecipientError,
  VaultNotFundedError,
} from './errors';
import { encodeUtf8 } from './hex';
import type { AgentIdentity } from './identity';
import type { MandateContract } from './mandateContract';
import { concatenateRecipients, type MandateTerms } from './terms';
import { encodeCashAddress, CashAddressType } from '@bitauth/libauth';

const FUNDING_FEE_BUFFER_SATOSHIS = 1500n;

export interface TransactionReceipt {
  readonly transactionId: string;
  readonly rawTransactionHex: string;
}

export interface FundVaultRequest {
  readonly provider: NetworkProvider;
  readonly contract: MandateContract;
  readonly owner: AgentIdentity;
  readonly vaultSatoshis: bigint;
}

/**
 * Describes one agent spend. The defaults are an honest spend; every field can
 * be overridden so tests and the demo can build the rogue spends the covenant
 * exists to refuse.
 */
export interface AgentSpendRequest {
  readonly provider: NetworkProvider;
  readonly contract: MandateContract;
  readonly terms: MandateTerms;
  readonly agent: AgentIdentity;
  readonly recipientIndex: number;
  readonly paymentSatoshis: bigint;
  readonly memo?: string;
  /** Pay this address instead of the approved recipient at recipientIndex. */
  readonly paymentAddressOverride?: string;
  /** Relative-block sequence on the vault input. Defaults to the mandate interval. */
  readonly sequenceBlocksOverride?: number;
  /** Spend this specific vault output instead of the largest one. */
  readonly vaultUtxo?: SpendableUtxo;
}

export interface OwnerRevokeRequest {
  readonly provider: NetworkProvider;
  readonly contract: MandateContract;
  readonly owner: AgentIdentity;
  /** Where the swept vault goes. Defaults to the owner's own address. */
  readonly destinationAddress?: string;
}

export async function findVaultUtxo(contract: MandateContract): Promise<SpendableUtxo> {
  const vaultUtxos = await contract.getUtxos();
  const largestUtxo = vaultUtxos.reduce(
    function keepLargest(currentLargest: SpendableUtxo | undefined, candidate: SpendableUtxo) {
      if (currentLargest === undefined || candidate.satoshis > currentLargest.satoshis) {
        return candidate;
      }
      return currentLargest;
    },
    undefined,
  );
  if (largestUtxo === undefined) {
    throw new VaultNotFundedError(contract.address);
  }
  return largestUtxo;
}

export function recipientAddressFor(recipientHash: Uint8Array, contractAddress: string): string {
  const addressPrefix = contractAddress.split(':')[0] ?? 'bchtest';
  return encodeCashAddress({
    prefix: addressPrefix as Parameters<typeof encodeCashAddress>[0]['prefix'],
    type: CashAddressType.p2pkh,
    payload: recipientHash,
  }).address;
}

export async function fundVault(request: FundVaultRequest): Promise<TransactionReceipt> {
  const { provider, contract, owner, vaultSatoshis } = request;
  const requiredSatoshis = vaultSatoshis + FUNDING_FEE_BUFFER_SATOSHIS;

  const ownerUtxos = (await provider.getUtxos(owner.address))
    .filter(function hasNoToken(utxo) {
      return utxo.token === undefined;
    })
    .sort(function byDescendingValue(first, second) {
      return Number(second.satoshis - first.satoshis);
    });
  const selectedUtxos: SpendableUtxo[] = [];
  let selectedSatoshis = 0n;
  for (const utxo of ownerUtxos) {
    selectedUtxos.push(utxo);
    selectedSatoshis += utxo.satoshis;
    if (selectedSatoshis >= requiredSatoshis) {
      break;
    }
  }
  if (selectedSatoshis < requiredSatoshis) {
    throw new InsufficientFundsError(owner.address, requiredSatoshis, selectedSatoshis);
  }

  const transactionBuilder = new TransactionBuilder({ provider });
  transactionBuilder.addInputs(selectedUtxos, owner.signatureTemplate.unlockP2PKH());
  transactionBuilder.addOutput({ to: contract.address, amount: vaultSatoshis });
  transactionBuilder.addBchChangeOutputIfNeeded({
    to: owner.address,
    feeRate: MINIMUM_RELAY_FEE_RATE,
  });
  return broadcast(transactionBuilder);
}

export async function buildAgentSpend(request: AgentSpendRequest): Promise<TransactionBuilder> {
  const { provider, contract, terms, agent, recipientIndex, paymentSatoshis } = request;
  if (request.memo !== undefined && encodeUtf8(request.memo).length > MAXIMUM_MEMO_BYTES) {
    throw new InvalidMandateTermsError(`memo exceeds ${MAXIMUM_MEMO_BYTES} bytes`);
  }

  const approvedRecipientHash = terms.approvedRecipients[recipientIndex];
  const paymentAddress =
    request.paymentAddressOverride ??
    (approvedRecipientHash === undefined
      ? undefined
      : recipientAddressFor(approvedRecipientHash, contract.address));
  if (paymentAddress === undefined) {
    throw new UnknownRecipientError(recipientIndex, terms.approvedRecipients.length);
  }

  const vaultUtxo = request.vaultUtxo ?? (await findVaultUtxo(contract));
  const sequenceBlocks = request.sequenceBlocksOverride ?? terms.minimumBlocksBetweenSpends;

  const transactionBuilder = new TransactionBuilder({ provider });
  transactionBuilder.addInput(
    vaultUtxo,
    contract.unlock.spend(
      agent.signatureTemplate,
      concatenateRecipients(terms.approvedRecipients),
      BigInt(recipientIndex),
    ),
    { sequence: sequenceBlocks },
  );
  transactionBuilder.addOutput({ to: paymentAddress, amount: paymentSatoshis });
  transactionBuilder.addOutput({
    to: contract.address,
    amount: vaultUtxo.satoshis - paymentSatoshis - SPEND_FEE_SATOSHIS,
  });
  if (request.memo !== undefined) {
    transactionBuilder.addOpReturnOutput([request.memo]);
  }
  return transactionBuilder;
}

export async function agentSpend(request: AgentSpendRequest): Promise<TransactionReceipt> {
  return broadcast(await buildAgentSpend(request));
}

export async function ownerRevoke(request: OwnerRevokeRequest): Promise<TransactionReceipt> {
  const { provider, contract, owner, destinationAddress = owner.address } = request;
  const vaultUtxo = await findVaultUtxo(contract);

  const transactionBuilder = new TransactionBuilder({ provider });
  transactionBuilder.addInput(vaultUtxo, contract.unlock.revoke(owner.publicKey, owner.signatureTemplate));
  transactionBuilder.addOutput({
    to: destinationAddress,
    amount: vaultUtxo.satoshis - SPEND_FEE_SATOSHIS,
  });
  return broadcast(transactionBuilder);
}

async function broadcast(transactionBuilder: TransactionBuilder): Promise<TransactionReceipt> {
  const transactionDetails = await transactionBuilder.send();
  return {
    transactionId: transactionDetails.txid,
    rawTransactionHex: transactionDetails.hex,
  };
}
