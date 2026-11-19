import { AnimatePresence, motion } from 'motion/react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { MandateRecord } from '../../../src/core/mandateRecord';
import { readAddressBalance } from '../lib/chain';
import { DraftValidationError, draftMandate, type MandateDraft } from '../lib/draftMandate';
import { addressUrl, formatSatoshis, shortenAddress } from '../lib/format';
import { ActionButton } from './Button';
import { CopyableValue } from './CopyableValue';
import { ArrowUpRightIcon } from './Icons';
import styles from './MandateDrafter.module.css';

export function MandateDrafter({ record }: { readonly record: MandateRecord | null }) {
  const formId = useId();
  const [ownerAddress, setOwnerAddress] = useState('');
  const [agentPublicKeyHex, setAgentPublicKeyHex] = useState('');
  const [recipientAddressesText, setRecipientAddressesText] = useState('');
  const [perSpendLimit, setPerSpendLimit] = useState('5000');
  const [minimumBlocks, setMinimumBlocks] = useState('6');
  const [validationError, setValidationError] = useState<DraftValidationError | null>(null);
  const [draft, setDraft] = useState<MandateDraft | null>(null);

  function fillWithRecordedMandate(): void {
    if (record === null) {
      return;
    }
    setOwnerAddress(record.ownerAddress);
    setAgentPublicKeyHex(record.terms.agentPublicKeyHex);
    setRecipientAddressesText(
      record.recipients
        .map(function readAddress(recipient) {
          return recipient.address;
        })
        .join('\n'),
    );
    setPerSpendLimit(String(record.terms.perSpendLimitSatoshis));
    setMinimumBlocks(String(record.terms.minimumBlocksBetweenSpends));
  }

  function submitDraft(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setValidationError(null);
    try {
      setDraft(
        draftMandate({
          ownerAddress,
          agentPublicKeyHex,
          recipientAddressesText,
          perSpendLimitSatoshis: perSpendLimit,
          minimumBlocksBetweenSpends: minimumBlocks,
        }),
      );
    } catch (failure) {
      setDraft(null);
      if (failure instanceof DraftValidationError) {
        setValidationError(failure);
        return;
      }
      throw failure;
    }
  }

  function errorFor(fieldName: string): string | undefined {
    return validationError?.fieldName === fieldName ? validationError.message : undefined;
  }

  return (
    <section id="draft" className={styles.section}>
      <div className="container">
        <p className="eyebrow">Bring your own agent</p>
        <h2 className={styles.title}>Draft a mandate</h2>
        <p className={styles.intro}>
          The vault address is a pure function of the terms. Compute it, then send funds to it as a
          single output from any chipnet wallet. Fund it with one output only: the pace limit applies
          per output.
        </p>

        <div className={styles.layout}>
          <form className={styles.form} onSubmit={submitDraft} noValidate>
            <div className={styles.formHeader}>
              <h3 className={styles.formTitle}>Mandate terms</h3>
              {record !== null ? (
                <ActionButton type="button" variant="quiet" onClick={fillWithRecordedMandate}>
                  Use the recorded mandate
                </ActionButton>
              ) : null}
            </div>

            <Field id={`${formId}-owner`} label="Owner address" error={errorFor('owner')}>
              <input id={`${formId}-owner`} className={styles.input} value={ownerAddress} placeholder="bchtest:q..."
                onChange={function onChange(event) { setOwnerAddress(event.target.value); }} autoComplete="off" spellCheck={false} />
            </Field>
            <Field id={`${formId}-agent`} label="Agent public key" error={errorFor('agent')}>
              <input id={`${formId}-agent`} className={styles.input} value={agentPublicKeyHex} placeholder="02..."
                onChange={function onChange(event) { setAgentPublicKeyHex(event.target.value); }} autoComplete="off" spellCheck={false} />
            </Field>
            <Field id={`${formId}-recipients`} label="Approved recipients, one address per line" error={errorFor('recipients')}>
              <textarea id={`${formId}-recipients`} className={`${styles.input} ${styles.textarea}`} rows={3}
                value={recipientAddressesText} placeholder="bchtest:q..."
                onChange={function onChange(event) { setRecipientAddressesText(event.target.value); }} spellCheck={false} />
            </Field>
            <div className={styles.pair}>
              <Field id={`${formId}-limit`} label="Limit per spend (sats)" error={errorFor('limit')}>
                <input id={`${formId}-limit`} className={`${styles.input} tabular`} inputMode="numeric" value={perSpendLimit}
                  onChange={function onChange(event) { setPerSpendLimit(event.target.value); }} />
              </Field>
              <Field id={`${formId}-interval`} label="Blocks between spends" error={errorFor('interval')}>
                <input id={`${formId}-interval`} className={`${styles.input} tabular`} inputMode="numeric" value={minimumBlocks}
                  onChange={function onChange(event) { setMinimumBlocks(event.target.value); }} />
              </Field>
            </div>

            {errorFor('terms') !== undefined ? <p className={styles.error} role="alert">{errorFor('terms')}</p> : null}
            <ActionButton type="submit">Compute vault address</ActionButton>
          </form>

          <div className={styles.result}>
            <AnimatePresence mode="wait" initial={false}>
              {draft === null ? (
                <motion.div key="empty" className={styles.emptyResult} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p>The vault address and the full terms appear here.</p>
                </motion.div>
              ) : (
                <DraftResult key={draft.contractAddress} draft={draft} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly error: string | undefined;
  readonly children: ReactNode;
}

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className={styles.field} data-invalid={error !== undefined}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      {children}
      {error !== undefined ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}

function DraftResult({ draft }: { readonly draft: MandateDraft }) {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [balanceFailed, setBalanceFailed] = useState(false);

  async function checkBalance(): Promise<void> {
    setIsChecking(true);
    setBalanceFailed(false);
    try {
      setBalance(await readAddressBalance(draft.contractAddress));
    } catch {
      setBalanceFailed(true);
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <motion.div className={styles.resultCard} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}>
      <p className="eyebrow">Vault address</p>
      <p className={`${styles.address} mono`}>{draft.contractAddress}</p>
      <div className={styles.resultActions}>
        <CopyableValue value={draft.contractAddress} displayText={shortenAddress(draft.contractAddress)} accessibleLabel="vault address" />
        <a className={styles.explorerLink} href={addressUrl(draft.contractAddress)} target="_blank" rel="noreferrer">
          Explorer <ArrowUpRightIcon size={14} />
        </a>
      </div>
      <div className={styles.balanceRow}>
        <ActionButton type="button" variant="secondary" isLoading={isChecking} onClick={checkBalance}>Check balance</ActionButton>
        <p className="tabular" aria-live="polite">
          {balance !== null ? `${formatSatoshis(Number(balance))} sats held` : null}
          {balanceFailed ? 'Could not read the balance.' : null}
        </p>
      </div>
      <p className="eyebrow">Terms</p>
      <pre className={`${styles.terms} mono`}>{JSON.stringify(draft.terms, null, 2)}</pre>
    </motion.div>
  );
}
