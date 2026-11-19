import { useState } from 'react';
import { CheckIcon, CopyIcon } from './Icons';
import styles from './CopyableValue.module.css';

const CONFIRMATION_DURATION_MILLISECONDS = 1600;

interface CopyableValueProps {
  readonly value: string;
  readonly displayText: string;
  readonly accessibleLabel: string;
}

export function CopyableValue({ value, displayText, accessibleLabel }: CopyableValueProps) {
  const [hasCopied, setHasCopied] = useState(false);

  async function copyToClipboard(): Promise<void> {
    await navigator.clipboard.writeText(value);
    setHasCopied(true);
    window.setTimeout(function resetConfirmation() {
      setHasCopied(false);
    }, CONFIRMATION_DURATION_MILLISECONDS);
  }

  return (
    <button
      type="button"
      className={styles.value}
      onClick={copyToClipboard}
      aria-label={hasCopied ? `${accessibleLabel} copied` : `Copy ${accessibleLabel}`}
      title={value}
    >
      <span className="mono">{displayText}</span>
      <span className={styles.icon} data-copied={hasCopied}>
        {hasCopied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      </span>
    </button>
  );
}
