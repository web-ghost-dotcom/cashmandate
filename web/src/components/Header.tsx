import { useEffect, useState } from 'react';
import { useChainHeight } from '../hooks/useChainHeight';
import { Wordmark } from './Logo';
import styles from './Header.module.css';

const NAVIGATION_LINKS = [
  { href: '#policy', label: 'Policy' },
  { href: '#ledger', label: 'Ledger' },
  { href: '#blocked', label: 'Blocked' },
  { href: '#draft', label: 'Draft a mandate' },
] as const;

const SCROLL_THRESHOLD_PIXELS = 8;

export function Header() {
  const chainHeight = useChainHeight();
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(function trackScrollPosition() {
    function updateScrollState(): void {
      setHasScrolled(window.scrollY > SCROLL_THRESHOLD_PIXELS);
    }
    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return function stopTracking() {
      window.removeEventListener('scroll', updateScrollState);
    };
  }, []);

  return (
    <header className={styles.header} data-scrolled={hasScrolled}>
      <div className={`container ${styles.inner}`}>
        <a href="#top" className={styles.brand} aria-label="CashMandate home">
          <Wordmark />
        </a>
        <nav className={styles.navigation} aria-label="Primary">
          {NAVIGATION_LINKS.map(function renderLink(link) {
            return (
              <a key={link.href} href={link.href} className={styles.link}>
                {link.label}
              </a>
            );
          })}
        </nav>
        <div className={styles.network} role="status" aria-live="polite">
          <span className={styles.indicator} data-status={chainHeight.status} aria-hidden="true" />
          <span className={styles.networkLabel}>Chipnet</span>
          <span className={`${styles.height} mono tabular`}>
            {chainHeight.status === 'online' ? chainHeight.height.toLocaleString('en-US') : null}
            {chainHeight.status === 'connecting' ? 'connecting' : null}
            {chainHeight.status === 'offline' ? 'offline' : null}
          </span>
        </div>
      </div>
    </header>
  );
}
