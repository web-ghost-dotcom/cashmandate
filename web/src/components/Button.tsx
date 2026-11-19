import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'quiet';

interface SharedProps {
  readonly variant?: ButtonVariant;
  readonly children: ReactNode;
  readonly isLoading?: boolean;
}

type ActionButtonProps = SharedProps & ButtonHTMLAttributes<HTMLButtonElement>;
type LinkButtonProps = SharedProps & AnchorHTMLAttributes<HTMLAnchorElement> & { readonly href: string };

function composeClassName(variant: ButtonVariant, isLoading: boolean): string {
  const classNames = [styles.button, styles[variant]];
  if (isLoading) {
    classNames.push(styles.loading);
  }
  return classNames.join(' ');
}

export function ActionButton({
  variant = 'primary',
  isLoading = false,
  children,
  disabled,
  ...buttonProps
}: ActionButtonProps) {
  return (
    <button
      className={composeClassName(variant, isLoading)}
      disabled={disabled === true || isLoading}
      aria-busy={isLoading}
      {...buttonProps}
    >
      {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ variant = 'primary', children, isLoading = false, ...anchorProps }: LinkButtonProps) {
  return (
    <a className={composeClassName(variant, isLoading)} {...anchorProps}>
      {children}
    </a>
  );
}
