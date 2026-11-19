import { beforeEach, describe, expect, it } from 'vitest';
import { SPEND_FEE_SATOSHIS } from '../src/core/constants';
import { agentSpend, buildAgentSpend, findVaultUtxo, ownerRevoke } from '../src/core/vault';
import {
  MINIMUM_BLOCKS_BETWEEN_SPENDS,
  PER_SPEND_LIMIT_SATOSHIS,
  VAULT_SATOSHIS,
  createMandateFixture,
  type MandateFixture,
} from './mandateFixture';

let fixture: MandateFixture;

beforeEach(function prepareFreshMandate() {
  fixture = createMandateFixture();
});

function honestSpendRequest(overrides: Partial<Parameters<typeof agentSpend>[0]> = {}) {
  return {
    provider: fixture.provider,
    contract: fixture.contract,
    terms: fixture.terms,
    agent: fixture.agent,
    recipientIndex: 0,
    paymentSatoshis: 4_000n,
    ...overrides,
  };
}

describe('agent spend inside the mandate', function describeHonestSpends() {
  it('pays the approved recipient and returns the remainder to the vault', async function () {
    await agentSpend(honestSpendRequest({ memo: 'Invoice 1042: price feed, 24h' }));

    const merchantUtxos = await fixture.provider.getUtxos(fixture.merchantOne.address);
    expect(merchantUtxos[0]?.satoshis).toBe(4_000n);

    const remainingVault = await findVaultUtxo(fixture.contract);
    expect(remainingVault.satoshis).toBe(VAULT_SATOSHIS - 4_000n - SPEND_FEE_SATOSHIS);
  });

  it('pays the second approved recipient by index', async function () {
    await agentSpend(honestSpendRequest({ recipientIndex: 1 }));

    const merchantUtxos = await fixture.provider.getUtxos(fixture.merchantTwo.address);
    expect(merchantUtxos[0]?.satoshis).toBe(4_000n);
  });

  it('allows a payment exactly equal to the per-spend limit', async function () {
    await expect(
      agentSpend(honestSpendRequest({ paymentSatoshis: PER_SPEND_LIMIT_SATOSHIS })),
    ).resolves.toBeDefined();
  });
});

describe('agent spends the mandate must refuse', function describeRogueSpends() {
  it('rejects a payment above the per-spend limit', async function () {
    await expect(
      agentSpend(honestSpendRequest({ paymentSatoshis: PER_SPEND_LIMIT_SATOSHIS + 1n })),
    ).rejects.toThrow();
  });

  it('rejects a payment to an address that is not approved', async function () {
    await expect(
      agentSpend(honestSpendRequest({ paymentAddressOverride: fixture.stranger.address })),
    ).rejects.toThrow();
  });

  it('rejects the agent sweeping the vault to its own address', async function () {
    await expect(
      agentSpend(
        honestSpendRequest({
          paymentAddressOverride: fixture.agent.address,
          paymentSatoshis: VAULT_SATOSHIS - SPEND_FEE_SATOSHIS - 1_000n,
        }),
      ),
    ).rejects.toThrow();
  });

  it('rejects a spend that skips the minimum interval', async function () {
    await expect(
      agentSpend(honestSpendRequest({ sequenceBlocksOverride: MINIMUM_BLOCKS_BETWEEN_SPENDS - 1 })),
    ).rejects.toThrow();
  });

  it('rejects a spend that does not return the remainder to the vault', async function () {
    const spend = await buildAgentSpend(honestSpendRequest());
    spend.outputs[1] = { to: fixture.agent.address, amount: spend.outputs[1]?.amount ?? 0n };
    await expect(spend.send()).rejects.toThrow();
  });

  it('rejects a spend that leaks value through an inflated miner fee', async function () {
    const spend = await buildAgentSpend(honestSpendRequest());
    const continuation = spend.outputs[1];
    if (continuation === undefined) {
      throw new Error('continuation output missing');
    }
    spend.outputs[1] = { ...continuation, amount: continuation.amount - 5_000n };
    await expect(spend.send()).rejects.toThrow();
  });

  it('rejects a spend that adds a fourth output', async function () {
    const spend = await buildAgentSpend(honestSpendRequest({ memo: 'ok' }));
    spend.addOutput({ to: fixture.agent.address, amount: 1_000n });
    await expect(spend.send()).rejects.toThrow();
  });

  it('rejects a recipient index past the approved list', async function () {
    const rogueSpend = await buildAgentSpend(
      honestSpendRequest({ recipientIndex: 7, paymentAddressOverride: fixture.merchantOne.address }),
    );
    await expect(rogueSpend.send()).rejects.toThrow();
  });

  it('rejects a spend signed by someone other than the agent', async function () {
    await expect(
      agentSpend(honestSpendRequest({ agent: fixture.stranger })),
    ).rejects.toThrow();
  });
});

describe('owner revocation', function describeRevocation() {
  it('lets the owner sweep the whole vault at any time', async function () {
    await ownerRevoke({ provider: fixture.provider, contract: fixture.contract, owner: fixture.owner });

    const ownerUtxos = await fixture.provider.getUtxos(fixture.owner.address);
    expect(ownerUtxos[0]?.satoshis).toBe(VAULT_SATOSHIS - SPEND_FEE_SATOSHIS);
  });

  it('rejects revocation by anyone other than the owner', async function () {
    await expect(
      ownerRevoke({ provider: fixture.provider, contract: fixture.contract, owner: fixture.stranger }),
    ).rejects.toThrow();
  });
});
