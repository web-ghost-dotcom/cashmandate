import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ElectrumNetworkProvider, Network } from 'cashscript';
import { parseRosterFile } from '../src/core/agentRoster';
import { mandateRecordSchema } from '../src/core/mandateRecord';
import { DEMO_VAULT_SATOSHIS, runMandateDemo } from '../src/scenarios/mandateDemo';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const ROSTER_FILE_PATH = resolve(PROJECT_ROOT, '.keys/chipnet-agents.json');
const RECORD_FILE_PATH = resolve(PROJECT_ROOT, 'web/public/mandate.json');

const CONFIRMATION_POLL_INTERVAL_MILLISECONDS = 20_000;
const CONFIRMATION_TIMEOUT_MILLISECONDS = 60 * 60 * 1000;
const REQUIRED_BALANCE_SATOSHIS = DEMO_VAULT_SATOSHIS + 5_000n;

async function main(): Promise<void> {
  const roster = parseRosterFile(readFileSync(ROSTER_FILE_PATH, 'utf-8'), 'chipnet');
  const provider = new ElectrumNetworkProvider(Network.CHIPNET, { manualConnectionManagement: true });
  await provider.connect();

  try {
    const ownerUtxos = await provider.getUtxos(roster.owner.address);
    const ownerBalance = ownerUtxos.reduce(function addValue(total, utxo) {
      return total + utxo.satoshis;
    }, 0n);
    console.log(`Owner ${roster.owner.address} holds ${ownerBalance} satoshis (needs ${REQUIRED_BALANCE_SATOSHIS}).`);
    if (ownerBalance < REQUIRED_BALANCE_SATOSHIS) {
      console.error('Fund the owner address from https://tbch.googol.cash (network: chipnet), then re-run.');
      process.exitCode = 1;
      return;
    }

    async function waitForConfirmation(transactionId: string): Promise<void> {
      const deadline = Date.now() + CONFIRMATION_TIMEOUT_MILLISECONDS;
      while (Date.now() < deadline) {
        const response = await provider.performRequest('blockchain.transaction.get', transactionId, true);
        const confirmations = (response as { confirmations?: unknown }).confirmations;
        if (typeof confirmations === 'number' && confirmations >= 1) {
          return;
        }
        await new Promise(function pause(resolvePause) {
          setTimeout(resolvePause, CONFIRMATION_POLL_INTERVAL_MILLISECONDS);
        });
      }
      throw new Error(`Transaction ${transactionId} did not confirm within the timeout`);
    }

    const record = await runMandateDemo({
      provider,
      roster,
      network: 'chipnet',
      waitForConfirmation,
      onProgress: function logProgress(message) {
        console.log(`[${new Date().toISOString()}] ${message}`);
      },
    });

    mkdirSync(dirname(RECORD_FILE_PATH), { recursive: true });
    writeFileSync(RECORD_FILE_PATH, `${JSON.stringify(mandateRecordSchema.parse(record), null, 2)}\n`);
    for (const entry of record.ledger) {
      console.log(`${entry.kind.padEnd(11)} ${entry.transactionId}`);
    }
    for (const attempt of record.blockedAttempts) {
      console.log(`blocked     ${attempt.attemptId}: ${attempt.rejectionMessage}`);
    }
  } finally {
    await provider.disconnect();
  }
}

main().catch(function reportFailure(failure: unknown) {
  console.error(failure);
  process.exitCode = 1;
});
