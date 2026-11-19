import { motion } from 'motion/react';
import type { BlockedAttempt, MandateRecord } from '../../../src/core/mandateRecord';
import { CrossIcon } from './Icons';
import styles from './BlockedAttempts.module.css';

const RULE_TITLES: Readonly<Record<BlockedAttempt['rule'], string>> = {
  'spending-limit': 'Spending limit',
  'recipient-allowlist': 'Approved recipients',
  'rate-limit': 'Pace',
  'vault-return': 'Vault return',
};

export function BlockedAttempts({ record }: { readonly record: MandateRecord | null }) {
  const attempts = record?.blockedAttempts ?? [];

  return (
    <section id="blocked" className={styles.section}>
      <div className="container">
        <p className="eyebrow">Refused by the network</p>
        <h2 className={styles.title}>What the agent could not do</h2>
        <p className={styles.intro}>
          Each transaction below was signed with the real agent key and broadcast to chipnet. The
          message is the reply the network gave, copied verbatim.
        </p>
        {attempts.length === 0 ? (
          <div className={styles.placeholder}>Blocked attempts appear once the mandate has been recorded.</div>
        ) : (
          <div className={styles.grid}>
            {attempts.map(function renderAttempt(attempt, attemptIndex) {
              return (
                <motion.article
                  key={attempt.attemptId}
                  className={styles.card}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.45, delay: attemptIndex * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  <header className={styles.header}>
                    <span className={styles.icon}>
                      <CrossIcon size={16} />
                    </span>
                    <div>
                      <h3 className={styles.cardTitle}>{attempt.title}</h3>
                      <p className={styles.rule}>{RULE_TITLES[attempt.rule]}</p>
                    </div>
                  </header>
                  <p className={styles.description}>{attempt.description}</p>
                  <p className={styles.responseLabel}>Network response</p>
                  <p className={`${styles.response} mono`}>{attempt.rejectionMessage}</p>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
