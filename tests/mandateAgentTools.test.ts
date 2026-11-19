import { describe, expect, it } from 'vitest';
import { createMandateAgentTools } from '../src/agent/mandateAgentTools';
import { createMandateFixture, PER_SPEND_LIMIT_SATOSHIS, VAULT_SATOSHIS } from './mandateFixture';

function createTools() {
  const fixture = createMandateFixture();
  const tools = createMandateAgentTools({
    provider: fixture.provider,
    terms: fixture.terms,
    agent: fixture.agent,
    recipientLabels: ['Price Feed Co', 'Weather API'],
  });
  return { fixture, tools };
}

describe('mandate agent tools', () => {
  it('describes the mandate the agent works under', async () => {
    const { tools } = createTools();
    const mandate = await tools.getMandate();

    expect(mandate.vaultBalanceSatoshis).toBe(Number(VAULT_SATOSHIS));
    expect(mandate.perSpendLimitSatoshis).toBe(Number(PER_SPEND_LIMIT_SATOSHIS));
    expect(mandate.approvedRecipients.map((recipient) => recipient.label)).toEqual(['Price Feed Co', 'Weather API']);
  });

  it('pays an approved recipient inside the limit', async () => {
    const { tools } = createTools();
    const mandate = await tools.getMandate();
    const approvedAddress = mandate.approvedRecipients[1]!.address;

    const result = await tools.pay(approvedAddress, 2_000, 'Invoice 7');

    expect(result.accepted).toBe(true);
  });

  it('returns the covenant refusal for a payment over the limit', async () => {
    const { tools } = createTools();
    const mandate = await tools.getMandate();

    const result = await tools.pay(mandate.approvedRecipients[0]!.address, 9_000, undefined);

    expect(result).toMatchObject({ accepted: false, refusedBy: 'covenant' });
  });

  it('returns the covenant refusal for an address that is not approved', async () => {
    const { fixture, tools } = createTools();

    const result = await tools.pay(fixture.stranger.address, 2_000, undefined);

    expect(result).toMatchObject({ accepted: false, refusedBy: 'covenant' });
  });

  it('rejects malformed requests before touching the network', async () => {
    const { tools } = createTools();

    expect(await tools.pay('not-an-address', 2_000, undefined)).toMatchObject({ accepted: false, refusedBy: 'request' });
    const mandate = await tools.getMandate();
    const approvedAddress = mandate.approvedRecipients[0]!.address;
    expect(await tools.pay(approvedAddress, -5, undefined)).toMatchObject({ accepted: false, refusedBy: 'request' });
    expect(await tools.pay(approvedAddress, 2_000, 'x'.repeat(200))).toMatchObject({ accepted: false, refusedBy: 'request' });
  });
});
