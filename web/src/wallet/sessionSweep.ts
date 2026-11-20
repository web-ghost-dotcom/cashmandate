import { TransactionBuilder, type NetworkProvider } from 'cashscript';
import type { AgentIdentity } from '../../../src/core/identity';

const DUST_LIMIT_SATOSHIS = 546n;
const BYTES_PER_P2PKH_INPUT = 148n;
const SWEEP_BASE_BYTES = 44n;
const SATOSHIS_PER_BYTE = 2n;

export interface SweepResult {
  readonly transactionId: string | null;
  readonly sweptSatoshis: bigint;
}

/** Moves everything a session key holds to one address, or does nothing when the balance would not cover the fee. */
export async function sweepSessionKey(
  provider: NetworkProvider,
  sessionKey: AgentIdentity,
  destinationAddress: string,
): Promise<SweepResult> {
  const utxos = (await provider.getUtxos(sessionKey.address)).filter(function isPlainBch(utxo) {
    return utxo.token === undefined;
  });
  const total = utxos.reduce(function addValue(sum, utxo) {
    return sum + utxo.satoshis;
  }, 0n);
  const fee = (BigInt(utxos.length) * BYTES_PER_P2PKH_INPUT + SWEEP_BASE_BYTES) * SATOSHIS_PER_BYTE;
  const payout = total - fee;
  if (utxos.length === 0 || payout < DUST_LIMIT_SATOSHIS) {
    return { transactionId: null, sweptSatoshis: 0n };
  }
  const builder = new TransactionBuilder({ provider });
  builder.addInputs(utxos, sessionKey.signatureTemplate.unlockP2PKH());
  builder.addOutput({ to: destinationAddress, amount: payout });
  const details = await builder.send();
  return { transactionId: details.txid, sweptSatoshis: payout };
}
