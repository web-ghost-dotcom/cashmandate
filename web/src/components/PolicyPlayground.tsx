import { AnimatePresence, motion } from 'motion/react';
import { useId, useMemo, useState } from 'react';
import type { MandateRecord } from '../../../src/core/mandateRecord';
import { evaluateSpendProposal } from '../../../src/core/spendPolicy';
import { deserializeMandateTerms } from '../../../src/core/terms';
import { formatSatoshis } from '../lib/format';
import { CheckIcon, CrossIcon } from './Icons';
import styles from './PolicyPlayground.module.css';

const UNLISTED_PAYEE = 'unlisted';
const MAXIMUM_PAYMENT_SATOSHIS = 12_000;
const DEFAULT_PAYMENT_SATOSHIS = 1_500;
const MAXIMUM_VAULT_AGE_BLOCKS = 6;

const RULE_TITLES = {
  'spending-limit': 'Spending limit',
  'recipient-allowlist': 'Approved recipients',
  'rate-limit': 'Pace',
  'vault-return': 'Vault return',
} as const;

export function PolicyPlayground({ record }: { readonly record: MandateRecord | null }) {
  const formId = useId();
  const terms = useMemo(
    function buildTerms() {
      return record === null ? null : deserializeMandateTerms(record.terms);
    },
    [record],
  );
  const [paymentSatoshis, setPaymentSatoshis] = useState(DEFAULT_PAYMENT_SATOSHIS);
  const [payeeChoice, setPayeeChoice] = useState('0');
  const [vaultAgeInBlocks, setVaultAgeInBlocks] = useState(1);

  const verdict =
    terms === null
      ? null
      : evaluateSpendProposal(terms, {
          paymentSatoshis: BigInt(paymentSatoshis),
          approvedRecipientIndex: payeeChoice === UNLISTED_PAYEE ? null : Number(payeeChoice),
          vaultAgeInBlocks,
          vaultSatoshis: BigInt(record?.vaultSatoshis ?? 0),
        });

  return (
    <section id="policy" className={styles.section}>
      <div className="container">
        <p className="eyebrow">What the covenant enforces</p>
        <h2 className={styles.title}>Try to break the mandate</h2>
        <p className={styles.intro}>
          Propose a payment as the agent. Each rule below is checked by the contract on chain; this
          panel shows the same checks so you can see why a spend would be accepted or refused.
        </p>

        <div className={styles.layout}>
          <form className={styles.controls} onSubmit={function ignoreSubmit(event) { event.preventDefault(); }}>
            <div className={styles.control}>
              <label htmlFor={`${formId}-amount`}>
                Payment <span className="tabular mono">{formatSatoshis(paymentSatoshis)} sats</span>
              </label>
              <input
                id={`${formId}-amount`}
                type="range"
                min={500}
                max={MAXIMUM_PAYMENT_SATOSHIS}
                step={500}
                value={paymentSatoshis}
                onChange={function onChange(event) {
                  setPaymentSatoshis(Number(event.target.value));
                }}
              />
            </div>

            <div className={styles.control}>
              <label htmlFor={`${formId}-payee`}>Pay to</label>
              <select
                id={`${formId}-payee`}
                value={payeeChoice}
                onChange={function onChange(event) {
                  setPayeeChoice(event.target.value);
                }}
              >
                {(record?.recipients ?? []).map(function renderRecipient(recipient, recipientIndex) {
                  return (
                    <option key={recipient.address} value={String(recipientIndex)}>
                      {recipient.label} (approved)
                    </option>
                  );
                })}
                <option value={UNLISTED_PAYEE}>Any other address</option>
              </select>
            </div>

            <div className={styles.control}>
              <label htmlFor={`${formId}-age`}>
                Vault output age{' '}
                <span className="tabular mono">
                  {vaultAgeInBlocks} {vaultAgeInBlocks === 1 ? 'block' : 'blocks'}
                </span>
              </label>
              <input
                id={`${formId}-age`}
                type="range"
                min={0}
                max={MAXIMUM_VAULT_AGE_BLOCKS}
                step={1}
                value={vaultAgeInBlocks}
                onChange={function onChange(event) {
                  setVaultAgeInBlocks(Number(event.target.value));
                }}
              />
            </div>
          </form>

          <div className={styles.verdict} aria-live="polite">
            {verdict === null ? (
              <p className={styles.waiting}>Load the recorded mandate to try the policy.</p>
            ) : (
              <>
                <ul className={styles.rules}>
                  {verdict.results.map(function renderRule(result) {
                    return (
                      <li key={result.rule} data-passed={result.passed}>
                        <motion.span
                          key={`${result.rule}-${result.passed}`}
                          className={styles.ruleIcon}
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                        >
                          {result.passed ? <CheckIcon size={18} /> : <CrossIcon size={18} />}
                        </motion.span>
                        <span>
                          <strong>{RULE_TITLES[result.rule]}</strong>
                          <small>{result.explanation}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={verdict.isAllowed ? 'allowed' : 'refused'}
                    className={styles.outcome}
                    data-allowed={verdict.isAllowed}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {verdict.isAllowed ? 'The covenant accepts this spend.' : 'The covenant refuses this spend.'}
                  </motion.p>
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
