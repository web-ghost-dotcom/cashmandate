import { motion } from 'motion/react';
import type { LedgerEntry, MandateRecord } from '../../../src/core/mandateRecord';
import { useTransactionStatus } from '../hooks/useTransactionStatus';
import { formatSatoshis, shortenAddress, shortenMiddle, transactionUrl } from '../lib/format';
import { ArrowUpRightIcon } from './Icons';
import styles from './Ledger.module.css';

const KIND_TITLES: Readonly<Record<LedgerEntry['kind'], string>> = {
  funding: 'Funded',
  spend: 'Agent spend',
  revocation: 'Revoked',
};

export function Ledger({ record }: { readonly record: MandateRecord | null }) {
  return (
    <section id="ledger" className={styles.section}>
      <div className="container">
        <p className="eyebrow">Live on chipnet</p>
        <h2 className={styles.title}>The ledger</h2>
        <p className={styles.intro}>
          Every entry is a real chipnet transaction. Confirmations are read from the network by your
          browser. The memo on each spend is written into the transaction by the agent.
        </p>
        {record === null ? (
          <div className={styles.placeholder}>The ledger appears once the mandate has been recorded.</div>
        ) : (
          <ol className={styles.entries}>
            {record.ledger.map(function renderEntry(entry, entryIndex) {
              return (
                <motion.li
                  key={entry.transactionId}
                  className={styles.entry}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.45, delay: entryIndex * 0.06, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  <LedgerRow entry={entry} record={record} />
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

function LedgerRow({ entry, record }: { readonly entry: LedgerEntry; readonly record: MandateRecord }) {
  const chainState = useTransactionStatus(entry.transactionId);
  const recipient = record.recipients.find(function matchesAddress(candidate) {
    return candidate.address === entry.recipientAddress;
  });

  return (
    <>
      <div className={styles.kind}>
        <span className={styles.kindLabel} data-kind={entry.kind}>
          {KIND_TITLES[entry.kind]}
        </span>
        <ConfirmationChip chainState={chainState} />
      </div>
      <div className={styles.body}>
        <p className={styles.label}>{entry.label}</p>
        {entry.paymentSatoshis !== null ? (
          <p className={styles.amount}>
            <span className="tabular">{formatSatoshis(entry.paymentSatoshis)} sats</span>
            {entry.recipientAddress !== null ? (
              <span className={styles.recipient}>
                to {recipient?.label ?? 'recipient'} <span className="mono">{shortenAddress(entry.recipientAddress)}</span>
              </span>
            ) : null}
          </p>
        ) : null}
        {entry.memo !== null ? <p className={styles.memo}>Memo: {entry.memo}</p> : null}
      </div>
      <a className={`${styles.link} mono`} href={transactionUrl(entry.transactionId)} target="_blank" rel="noreferrer">
        {shortenMiddle(entry.transactionId, 10, 8)}
        <ArrowUpRightIcon size={14} />
      </a>
    </>
  );
}

function ConfirmationChip({ chainState }: { readonly chainState: ReturnType<typeof useTransactionStatus> }) {
  if (chainState.status === 'loading') {
    return <span className={`${styles.chip} ${styles.pending}`}>checking chain</span>;
  }
  if (chainState.status === 'failed') {
    return <span className={`${styles.chip} ${styles.pending}`}>chain unreachable</span>;
  }
  const { transaction } = chainState;
  if (transaction.state === 'confirmed') {
    const unit = transaction.confirmations === 1 ? 'confirmation' : 'confirmations';
    return (
      <span className={`${styles.chip} ${styles.confirmed}`}>
        {transaction.confirmations.toLocaleString('en-US')} {unit}
      </span>
    );
  }
  if (transaction.state === 'mempool') {
    return <span className={`${styles.chip} ${styles.pending}`}>in mempool</span>;
  }
  return <span className={`${styles.chip} ${styles.missing}`}>not found on chipnet</span>;
}
