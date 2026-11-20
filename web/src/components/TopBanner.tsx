import { useState } from 'react';
import { EMBER_DONATION_ADDRESS, PRESENTATION_URL, REPOSITORY_URL } from '../config/siteLinks';
import { shortenAddress } from './WalletPanel';
import styles from './TopBanner.module.css';

const COPIED_RESET_MILLISECONDS = 1800;

export function TopBanner() {
  const [hasCopied, setHasCopied] = useState(false);

  async function copyDonationAddress(): Promise<void> {
    if (EMBER_DONATION_ADDRESS === null) return;
    await navigator.clipboard.writeText(EMBER_DONATION_ADDRESS);
    setHasCopied(true);
    window.setTimeout(function resetCopied() {
      setHasCopied(false);
    }, COPIED_RESET_MILLISECONDS);
  }

  return (
    <div className={styles.banner} role="region" aria-label="Project links">
      <div className={`container ${styles.inner}`}>
        <span className={styles.label}>BCH Blaze 2026</span>
        <nav className={styles.links} aria-label="Project links">
          {PRESENTATION_URL === null ? null : (
            <a href={PRESENTATION_URL} target="_blank" rel="noreferrer">
              Presentation
            </a>
          )}
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
        {EMBER_DONATION_ADDRESS === null ? null : (
          <button type="button" className={styles.donate} onClick={function donate() { void copyDonationAddress(); }}>
            <span>{hasCopied ? 'Copied' : 'Donate to EMBER2026'}</span>
            <span className="mono">{shortenAddress(EMBER_DONATION_ADDRESS)}</span>
          </button>
        )}
      </div>
    </div>
  );
}
