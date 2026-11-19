import { MockNetworkProvider, randomUtxo } from 'cashscript';
import { describe, expect, it } from 'vitest';
import { AGENT_ROLES, type AgentRoster } from '../src/core/agentRoster';
import { generateAgentIdentity } from '../src/core/identity';
import { mandateRecordSchema } from '../src/core/mandateRecord';
import { runMandateDemo } from '../src/scenarios/mandateDemo';

describe('mandate demo scenario', function describeScenario() {
  it('records the honest spends, the blocked attempts and the revocation', async function () {
    const provider = new MockNetworkProvider();
    const identitiesByRole: Record<string, ReturnType<typeof generateAgentIdentity>> = {};
    for (const role of AGENT_ROLES) {
      identitiesByRole[role] = generateAgentIdentity(role, 'mocknet');
    }
    const roster = identitiesByRole as unknown as AgentRoster;
    provider.addUtxo(roster.owner.address, randomUtxo({ satoshis: 200_000n }));

    const record = await runMandateDemo({
      provider,
      roster,
      network: 'mocknet',
      waitForConfirmation: async function noWait() {},
      onProgress: function ignoreProgress() {},
    });

    expect(mandateRecordSchema.safeParse(record).success).toBe(true);
    expect(record.ledger.map((entry) => entry.kind)).toEqual(['funding', 'spend', 'spend', 'revocation']);
    expect(record.blockedAttempts.map((attempt) => attempt.attemptId)).toEqual([
      'over-limit',
      'unapproved-recipient',
      'agent-sweep',
    ]);
    expect(record.status).toBe('revoked');
  });
});
