import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { generateRosterFile, parseRosterFile } from '../src/core/agentRoster';

const ROSTER_FILE_PATH = resolve(import.meta.dirname, '../.keys/chipnet-agents.json');

function main(): void {
  if (existsSync(ROSTER_FILE_PATH)) {
    console.error(`Refusing to overwrite existing roster at ${ROSTER_FILE_PATH}`);
    process.exitCode = 1;
    return;
  }
  mkdirSync(dirname(ROSTER_FILE_PATH), { recursive: true });
  const serializedRoster = JSON.stringify(generateRosterFile('chipnet'), null, 2);
  writeFileSync(ROSTER_FILE_PATH, serializedRoster, { mode: 0o600 });

  const roster = parseRosterFile(serializedRoster, 'chipnet');
  console.log('Chipnet roster created. Fund the owner address from the faucet:');
  console.log(`  owner: ${roster.owner.address}`);
}

main();
