import { WizardConnectQRDialog } from '@wizardconnect/react';
import type { useWizardWallet } from '../wallet/useWizardWallet';
import { ActionButton } from './Button';
import styles from './WalletPanel.module.css';

type WizardWallet = ReturnType<typeof useWizardWallet>;

const SUPPORTED_WALLETS = 'Cashonize, Paytaca or Selene';
const QR_THEME = {
  dialogBackground: '#ffffff',
  headerBackground: '#ffffff',
  titleColor: '#14201b',
  subtitleColor: '#4f5b55',
  borderColor: '#dedcd2',
  uriRowBackground: '#f5f4ee',
  uriTextColor: '#4f5b55',
  qrForeground: '#14201b',
  qrBackground: '#ffffff',
  closeButtonColor: '#4f5b55',
  copyButtonColor: '#4f5b55',
} as const;

export function shortenAddress(address: string): string {
  const withoutPrefix = address.replace(/^[a-z]+:/, '');
  return `${withoutPrefix.slice(0, 8)}...${withoutPrefix.slice(-6)}`;
}

export function WalletPanel({ wallet }: { readonly wallet: WizardWallet }) {
  return (
    <div className={styles.panel}>
      {wallet.isReady && wallet.address !== null ? (
        <div className={styles.connected}>
          <span className={styles.dot} aria-hidden="true" />
          <span>
            <strong>{wallet.walletName ?? 'Wallet'}</strong> connected
            <span className={`${styles.address} mono`}>{shortenAddress(wallet.address)}</span>
          </span>
          <ActionButton type="button" variant="quiet" onClick={function disconnect() { void wallet.disconnect(); }}>
            Disconnect
          </ActionButton>
        </div>
      ) : (
        <div className={styles.disconnected}>
          <div>
            <strong>Connect a wallet</strong>
            <p>Uses WizardConnect. Scan the code with {SUPPORTED_WALLETS}.</p>
          </div>
          <ActionButton type="button" onClick={wallet.startConnecting}>
            Connect wallet
          </ActionButton>
        </div>
      )}
      {wallet.error === null ? null : (
        <p className={styles.error} role="alert">
          {wallet.error}
        </p>
      )}
      {wallet.uri === null || wallet.qrUri === null ? null : (
        <WizardConnectQRDialog
          show={wallet.isQrVisible}
          onClose={wallet.cancelConnecting}
          uri={wallet.uri}
          qrUri={wallet.qrUri}
          theme={QR_THEME}
          title="Connect your wallet"
          subtitle={`Scan with ${SUPPORTED_WALLETS}`}
        />
      )}
    </div>
  );
}
