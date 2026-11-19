import { motion } from 'motion/react';
import type { MandateRecordState } from '../hooks/useMandateRecord';
import { computeSpendBreakdown } from '../lib/spendBreakdown';
import { formatSatoshis } from '../lib/format';
import { LinkButton } from './Button';
import { ArrowRightIcon } from './Icons';
import styles from './Hero.module.css';

const REVEAL_TRANSITION = { duration: 0.6, ease: [0.2, 0.7, 0.2, 1] } as const;

export function Hero({ recordState }: { readonly recordState: MandateRecordState }) {
  return (
    <section id="top" className={styles.hero}>
      <div className="container">
        <motion.p className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={REVEAL_TRANSITION}>
          Spending mandates for AI agents
        </motion.p>
        <motion.h1
          className={styles.headline}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...REVEAL_TRANSITION, delay: 0.08 }}
        >
          Give your agent a budget, not your key.
        </motion.h1>
        <motion.p
          className={styles.lede}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...REVEAL_TRANSITION, delay: 0.16 }}
        >
          The owner locks funds in a Bitcoin Cash covenant. The agent can spend them only inside the
          mandate: a cap per payment, a list of approved recipients, and a minimum gap between
          payments. The owner can take everything back at any moment.
        </motion.p>
        <motion.div
          className={styles.actions}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...REVEAL_TRANSITION, delay: 0.24 }}
        >
          <LinkButton href="#policy">
            Try the policy
            <ArrowRightIcon size={18} />
          </LinkButton>
          <LinkButton href="#ledger" variant="secondary">
            Read the ledger
          </LinkButton>
        </motion.div>

        <motion.div
          className={styles.breakdown}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...REVEAL_TRANSITION, delay: 0.4 }}
        >
          <SpendBreakdown recordState={recordState} />
        </motion.div>
      </div>
    </section>
  );
}

function SpendBreakdown({ recordState }: { readonly recordState: MandateRecordState }) {
  if (recordState.status !== 'ready') {
    return (
      <div className={styles.breakdownPlaceholder} aria-busy={recordState.status === 'loading'}>
        {recordState.status === 'failed' ? 'The recorded mandate could not be loaded.' : 'Loading the recorded mandate'}
      </div>
    );
  }
  const { record } = recordState;
  const segments = computeSpendBreakdown(record);

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        Where the {formatSatoshis(record.vaultSatoshis)} satoshi vault went, from the recorded chipnet run
      </figcaption>
      <div className={styles.bar} role="img" aria-label="Breakdown of the vault by destination">
        {segments.map(function renderSegment(segment, segmentIndex) {
          return (
            <motion.div
              key={segment.key}
              className={`${styles.segment} ${styles[segment.tone]}`}
              style={{ flexGrow: segment.satoshis }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.5 + segmentIndex * 0.12, ease: [0.2, 0.7, 0.2, 1] }}
            />
          );
        })}
      </div>
      <ul className={styles.legend}>
        {segments.map(function renderLegendItem(segment) {
          return (
            <li key={segment.key}>
              <span className={`${styles.swatch} ${styles[segment.tone]}`} aria-hidden="true" />
              <span className={styles.legendLabel}>{segment.label}</span>
              <span className="tabular mono">{formatSatoshis(segment.satoshis)}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
