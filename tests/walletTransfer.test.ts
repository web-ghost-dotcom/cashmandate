import { decodeTransaction, hexToBin } from '@bitauth/libauth';
import type { DappConnectionManager } from '@wizardconnect/dapp';
import { MockNetworkProvider, randomUtxo } from 'cashscript';
import { describe, expect, it } from 'vitest';
import { generateAgentIdentity } from '../src/core/identity';
import { sendFromWallet, walletReceiveAddress, WalletTransferError } from '../web/src/wallet/walletTransfer';

const RECEIVE_CHILD_INDEX = 0;
const WALLET_COIN_SATOSHIS = 20_000n;
const SEND_SATOSHIS = 8_000n;

interface CapturedRequest {
  transaction: { transaction: string; broadcast: boolean; userPrompt: string };
  inputPaths: [number, string, number][];
}

function createFakeWallet() {
  const walletKey = generateAgentIdentity('wallet', 'mainnet');
  const captured: CapturedRequest[] = [];
  const manager = {
    getPubkey(childIndex: number, index: bigint) {
      return childIndex === RECEIVE_CHILD_INDEX && index === 0n ? walletKey.publicKey : undefined;
    },
    async signTransaction(request: CapturedRequest) {
      captured.push(request);
      return { signedTransaction: request.transaction.transaction, error: undefined };
    },
  } as unknown as DappConnectionManager;
  return { manager, captured, walletKey };
}

describe('sendFromWallet', () => {
  it('asks the wallet to sign a transaction that pays the destination and returns change', async () => {
    const { manager, captured, walletKey } = createFakeWallet();
    const provider = new MockNetworkProvider();
    provider.addUtxo(walletKey.address, randomUtxo({ satoshis: WALLET_COIN_SATOSHIS }));
    const destination = generateAgentIdentity('destination', 'mainnet');

    const receipt = await sendFromWallet({
      manager,
      provider,
      toAddress: destination.address,
      satoshis: SEND_SATOSHIS,
      userPrompt: 'Fund the agent',
    });

    expect(receipt.transactionId).toMatch(/^[0-9a-f]{64}$/);
    const request = captured[0];
    expect(request?.transaction.broadcast).toBe(true);
    expect(request?.inputPaths).toEqual([[0, 'receive', 0]]);
    const decoded = decodeTransaction(hexToBin(request?.transaction.transaction ?? ''));
    if (typeof decoded === 'string') throw new Error(decoded);
    expect(decoded.outputs[0]?.valueSatoshis).toBe(SEND_SATOSHIS);
    const changeSatoshis = decoded.outputs[1]?.valueSatoshis ?? 0n;
    expect(changeSatoshis).toBeGreaterThan(WALLET_COIN_SATOSHIS - SEND_SATOSHIS - 1_000n);
    expect(changeSatoshis).toBeLessThan(WALLET_COIN_SATOSHIS - SEND_SATOSHIS);
  });

  it('refuses when the wallet cannot cover the amount and fee', async () => {
    const { manager, walletKey } = createFakeWallet();
    const provider = new MockNetworkProvider();
    provider.addUtxo(walletKey.address, randomUtxo({ satoshis: SEND_SATOSHIS }));

    await expect(
      sendFromWallet({
        manager,
        provider,
        toAddress: generateAgentIdentity('destination', 'mainnet').address,
        satoshis: SEND_SATOSHIS,
        userPrompt: 'Fund the agent',
      }),
    ).rejects.toBeInstanceOf(WalletTransferError);
  });

  it('derives the wallet receive address from the shared public key', () => {
    const { manager, walletKey } = createFakeWallet();
    expect(walletReceiveAddress(manager, 0)).toBe(walletKey.address);
    expect(walletReceiveAddress(manager, 1)).toBeNull();
  });
});
