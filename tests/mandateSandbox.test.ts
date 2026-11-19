import { describe, expect, it } from 'vitest';
import { createMandateSandbox, createUnapprovedAddress } from '../web/src/agent/mandateSandbox';
import type { AgentTool } from '../web/src/agent/modelClient';

const LIMIT_SATOSHIS = 2_000;

function findTool(tools: readonly AgentTool[], name: string): AgentTool {
  const tool = tools.find(function matchesName(candidate) {
    return candidate.name === name;
  });
  if (tool === undefined) throw new Error(`tool ${name} missing`);
  return tool;
}

async function approvedAddress(sandbox: ReturnType<typeof createMandateSandbox>): Promise<string> {
  const mandate = await sandbox.readMandate();
  const first = mandate.approvedRecipients[0];
  if (first === undefined) throw new Error('no approved recipient');
  return first.address;
}

describe('mandate sandbox', function describeSandbox() {
  it('pays an approved recipient inside the limit', async function paysInsideLimit() {
    const sandbox = createMandateSandbox(LIMIT_SATOSHIS);
    const result = (await findTool(sandbox.tools, 'pay').execute({
      recipientAddress: await approvedAddress(sandbox),
      amountSatoshis: 1_500,
      memo: 'invoice 1',
    })) as { accepted: boolean };
    expect(result.accepted).toBe(true);
    expect(sandbox.readPayments()[0]?.outcome).toBe('paid');
  });

  it('refuses an address that is not on the approved list', async function refusesStranger() {
    const sandbox = createMandateSandbox(LIMIT_SATOSHIS);
    const result = (await findTool(sandbox.tools, 'pay').execute({
      recipientAddress: createUnapprovedAddress(),
      amountSatoshis: 1_000,
    })) as { accepted: boolean; refusedBy: string };
    expect(result.accepted).toBe(false);
    expect(result.refusedBy).toBe('covenant');
  });

  it('refuses a payment above the limit and leaves the vault untouched', async function refusesOverLimit() {
    const sandbox = createMandateSandbox(LIMIT_SATOSHIS);
    const result = (await findTool(sandbox.tools, 'pay').execute({
      recipientAddress: await approvedAddress(sandbox),
      amountSatoshis: 9_000,
    })) as { accepted: boolean };
    expect(result.accepted).toBe(false);
    expect((await sandbox.readMandate()).vaultBalanceSatoshis).toBe(30_000);
  });

  it('lets the owner sweep the vault', async function ownerRevokes() {
    const sandbox = createMandateSandbox(LIMIT_SATOSHIS);
    await sandbox.revokeAsOwner();
    expect((await sandbox.readMandate()).vaultBalanceSatoshis).toBe(0);
  });
});
