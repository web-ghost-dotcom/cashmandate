import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { generateRosterFile, parseRosterFile } from '../src/core/agentRoster';

const SUPPORTED_NETWORKS = ['chipnet', 'mainnet'] as const;
type WalletNetwork = (typeof SUPPORTED_NETWORKS)[number];

function readNetwork(): WalletNetwork {
  const requestedNetwork = process.argv[2] ?? 'chipnet';
  const network = SUPPORTED_NETWORKS.find(function matches(candidate) {
    return candidate === requestedNetwork;
  });
  if (network === undefined) {
    throw new Error(`Unknown network "${requestedNetwork}". Use one of: ${SUPPORTED_NETWORKS.join(', ')}`);
  }
  return network;
}

function main(): void {
  const network = readNetwork();
  const rosterFilePath = resolve(import.meta.dirname, `../.keys/${network}-agents.json`);
  if (existsSync(rosterFilePath)) {
    console.error(`Refusing to overwrite existing roster at ${rosterFilePath}`);
    process.exitCode = 1;
    return;
  }
  mkdirSync(dirname(rosterFilePath), { recursive: true });
  const serializedRoster = JSON.stringify(generateRosterFile(network), null, 2);
  writeFileSync(rosterFilePath, serializedRoster, { mode: 0o600 });

  const roster = parseRosterFile(serializedRoster, network);
  console.log(`${network} roster created. Fund the owner address:`);
  console.log(`  owner: ${roster.owner.address}`);
}

main();
