import { Wordmark } from './Logo';
import styles from './Footer.module.css';

const REPOSITORY_URL = 'https://github.com/web-ghost-dotcom/cashmandate';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Wordmark />
          <p>Spending mandates for AI agents, enforced by Bitcoin Cash CashScript covenants.</p>
        </div>
        <ul className={styles.links}>
          <li>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              Source code
            </a>
          </li>
          <li>
            <a href="https://cashscript.org" target="_blank" rel="noreferrer">
              CashScript
            </a>
          </li>
          <li>
            <a href="https://bchblaze.cash" target="_blank" rel="noreferrer">
              BCH BLAZE 2026
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
