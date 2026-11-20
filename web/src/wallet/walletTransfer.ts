import {
  binToHex,
  cashAddressToLockingBytecode,
  encodeTransaction,
  hash160,
  encodeCashAddress,
  hashTransaction,
  hexToBin,
} from '@bitauth/libauth';
import type { DappConnectionManager } from '@wizardconnect/dapp';
import type { NetworkProvider, Utxo } from 'cashscript';

const RECEIVE_CHILD_INDEX = 0;
const CHANGE_CHILD_INDEX = 1;
const ADDRESSES_SCANNED_PER_PATH = 5;
const DUST_LIMIT_SATOSHIS = 546n;
const FEE_SATOSHIS_PER_BYTE = 1.2;
const TRANSACTION_OVERHEAD_BYTES = 10;
const BYTES_PER_P2PKH_INPUT = 148;
const BYTES_PER_P2PKH_OUTPUT = 34;
const FINAL_SEQUENCE_NUMBER = 0xffffffff;
const TRANSACTION_VERSION = 2;

type SigningRequest = Parameters<DappConnectionManager['signTransaction']>[0];
type RelaySourceOutputs = SigningRequest['transaction']['sourceOutputs'];
type SigningPath = 'receive' | 'change';

export class WalletTransferError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WalletTransferError';
  }
}

export interface WalletCoin {
  readonly utxo: Utxo;
  readonly path: SigningPath;
  readonly index: number;
  readonly address: string;
}

export interface WalletTransferRequest {
  readonly manager: DappConnectionManager;
  readonly provider: NetworkProvider;
  readonly toAddress: string;
  readonly satoshis: bigint;
  /** Shown by the wallet when it asks the user to approve the transaction. */
  readonly userPrompt: string;
}

export interface WalletTransferReceipt {
  readonly transactionId: string;
}

function p2pkhAddressAt(manager: DappConnectionManager, childIndex: number, index: number): string | null {
  const publicKey = manager.getPubkey(childIndex, BigInt(index));
  if (publicKey === undefined) return null;
  return encodeCashAddress({ prefix: 'bitcoincash', type: 'p2pkh', payload: hash160(publicKey) }).address;
}

/** The wallet's own receive address at the given index, derived from the extended public key it shared. */
export function walletReceiveAddress(manager: DappConnectionManager, index: number): string | null {
  return p2pkhAddressAt(manager, RECEIVE_CHILD_INDEX, index);
}

function lockingBytecodeFor(address: string): Uint8Array {
  const decoded = cashAddressToLockingBytecode(address);
  if (typeof decoded === 'string') {
    throw new WalletTransferError(`Not a valid address: ${address}`);
  }
  return decoded.bytecode;
}

async function listWalletCoins(manager: DappConnectionManager, provider: NetworkProvider): Promise<WalletCoin[]> {
  const coins: WalletCoin[] = [];
  const paths: readonly (readonly [number, SigningPath])[] = [
    [RECEIVE_CHILD_INDEX, 'receive'],
    [CHANGE_CHILD_INDEX, 'change'],
  ];
  for (const [childIndex, path] of paths) {
    for (let index = 0; index < ADDRESSES_SCANNED_PER_PATH; index += 1) {
      const address = p2pkhAddressAt(manager, childIndex, index);
      if (address === null) continue;
      const utxos = await provider.getUtxos(address);
      for (const utxo of utxos) {
        if (utxo.token === undefined) coins.push({ utxo, path, index, address });
      }
    }
  }
  return coins;
}

export async function readWalletBalance(manager: DappConnectionManager, provider: NetworkProvider): Promise<bigint> {
  const coins = await listWalletCoins(manager, provider);
  return coins.reduce(function addValue(total, coin) {
    return total + coin.utxo.satoshis;
  }, 0n);
}

function estimateFeeSatoshis(inputCount: number, outputCount: number): bigint {
  const sizeInBytes = TRANSACTION_OVERHEAD_BYTES + inputCount * BYTES_PER_P2PKH_INPUT + outputCount * BYTES_PER_P2PKH_OUTPUT;
  return BigInt(Math.ceil(sizeInBytes * FEE_SATOSHIS_PER_BYTE));
}

function selectCoins(coins: readonly WalletCoin[], satoshis: bigint): { selected: WalletCoin[]; fee: bigint; total: bigint } {
  const largestFirst = [...coins].sort(function byValueDescending(first, second) {
    return Number(second.utxo.satoshis - first.utxo.satoshis);
  });
  const selected: WalletCoin[] = [];
  let total = 0n;
  let fee = 0n;
  for (const coin of largestFirst) {
    selected.push(coin);
    total += coin.utxo.satoshis;
    fee = estimateFeeSatoshis(selected.length, 2);
    if (total >= satoshis + fee) return { selected, fee, total };
  }
  throw new WalletTransferError(
    `The wallet holds ${total.toString()} sats and this needs ${(satoshis + fee).toString()} sats including the fee.`,
  );
}

/**
 * Sends BCH from the connected wallet. The wallet signs and broadcasts; this
 * only builds the unsigned transaction from the coins the wallet controls.
 */
export async function sendFromWallet(request: WalletTransferRequest): Promise<WalletTransferReceipt> {
  const { manager, provider, toAddress, satoshis, userPrompt } = request;
  const coins = await listWalletCoins(manager, provider);
  if (coins.length === 0) {
    throw new WalletTransferError('The wallet has no spendable BCH on the addresses it shared.');
  }
  const { selected, fee, total } = selectCoins(coins, satoshis);
  const changeAddress = p2pkhAddressAt(manager, CHANGE_CHILD_INDEX, 0) ?? selected[0]?.address;
  if (changeAddress === undefined) {
    throw new WalletTransferError('The wallet did not share a change address.');
  }

  const outputs = [{ valueSatoshis: satoshis, lockingBytecode: lockingBytecodeFor(toAddress) }];
  const changeSatoshis = total - satoshis - fee;
  if (changeSatoshis >= DUST_LIMIT_SATOSHIS) {
    outputs.push({ valueSatoshis: changeSatoshis, lockingBytecode: lockingBytecodeFor(changeAddress) });
  }
  const inputs = selected.map(function toInput(coin) {
    return {
      outpointTransactionHash: hexToBin(coin.utxo.txid),
      outpointIndex: coin.utxo.vout,
      unlockingBytecode: new Uint8Array(),
      sequenceNumber: FINAL_SEQUENCE_NUMBER,
    };
  });
  const sourceOutputs = selected.map(function toSourceOutput(coin, inputIndex) {
    const input = inputs[inputIndex];
    if (input === undefined) throw new WalletTransferError('Input and coin lists are out of step.');
    return {
      outpointTransactionHash: binToHex(input.outpointTransactionHash),
      outpointIndex: input.outpointIndex,
      unlockingBytecode: '',
      sequenceNumber: input.sequenceNumber,
      valueSatoshis: `<bigint: ${coin.utxo.satoshis.toString()}n>`,
      lockingBytecode: binToHex(lockingBytecodeFor(coin.address)),
    };
  });

  const response = await manager.signTransaction({
    transaction: {
      transaction: binToHex(encodeTransaction({ version: TRANSACTION_VERSION, locktime: 0, inputs, outputs })),
      sourceOutputs: sourceOutputs as unknown as RelaySourceOutputs,
      broadcast: true,
      userPrompt,
    },
    inputPaths: selected.map(function toPath(coin, inputIndex) {
      return [inputIndex, coin.path, coin.index] as [number, SigningPath, number];
    }),
  });
  if (response.error !== undefined && response.error !== '') {
    throw new WalletTransferError(`The wallet declined or failed to sign: ${response.error}`);
  }
  return { transactionId: hashTransaction(hexToBin(response.signedTransaction)) };
}
