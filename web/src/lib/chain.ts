import { ElectrumNetworkProvider, Network } from 'cashscript';

export type TransactionStatus =
  | { readonly state: 'confirmed'; readonly confirmations: number }
  | { readonly state: 'mempool' }
  | { readonly state: 'not-found' };

let sharedProvider: ElectrumNetworkProvider | undefined;

/** One Electrum connection is shared by every component and opened on first use. */
export function getChainProvider(): ElectrumNetworkProvider {
  if (sharedProvider === undefined) {
    sharedProvider = new ElectrumNetworkProvider(Network.CHIPNET);
  }
  return sharedProvider;
}

export async function readChainHeight(): Promise<number> {
  return getChainProvider().getBlockHeight();
}

const UNKNOWN_TRANSACTION_PATTERN = /no such mempool or blockchain transaction|not found|unknown/i;

function isUnknownTransactionFailure(failure: unknown): boolean {
  return failure instanceof Error && UNKNOWN_TRANSACTION_PATTERN.test(failure.message);
}

export async function readTransactionStatus(transactionId: string): Promise<TransactionStatus> {
  let response: unknown;
  try {
    response = await getChainProvider().performRequest(
      'blockchain.transaction.get',
      transactionId,
      true,
    );
  } catch (requestFailure) {
    if (isUnknownTransactionFailure(requestFailure)) {
      return { state: 'not-found' };
    }
    throw requestFailure;
  }
  if (response instanceof Error || typeof response !== 'object' || response === null) {
    return { state: 'not-found' };
  }
  const confirmations = (response as { confirmations?: unknown }).confirmations;
  if (typeof confirmations === 'number' && confirmations > 0) {
    return { state: 'confirmed', confirmations };
  }
  return { state: 'mempool' };
}

export async function readAddressBalance(address: string): Promise<bigint> {
  const unspentOutputs = await getChainProvider().getUtxos(address);
  return unspentOutputs.reduce(function addValue(total, unspentOutput) {
    return total + unspentOutput.satoshis;
  }, 0n);
}
