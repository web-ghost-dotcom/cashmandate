import { useWizardConnect } from '@wizardconnect/react';
import { useCallback, useEffect, useState } from 'react';
import { walletReceiveAddress } from './walletTransfer';

const DAPP_ICON_PATH = 'favicon.svg';

export function useWizardWallet(dappName: string) {
  const connection = useWizardConnect({
    dappName,
    dappIcon: new URL(DAPP_ICON_PATH, window.location.href).href,
  });
  const [isQrVisible, setIsQrVisible] = useState(false);
  const manager = connection.state === 'connected' ? connection.manager : null;
  const address = manager === null ? null : walletReceiveAddress(manager, 0);
  const isReady = address !== null;

  useEffect(
    function hideQrOnceConnected() {
      if (isReady) setIsQrVisible(false);
    },
    [isReady],
  );

  const startConnecting = useCallback(
    function startConnecting(): void {
      if (connection.state !== 'connecting') connection.connect();
      setIsQrVisible(true);
    },
    [connection],
  );

  const cancelConnecting = useCallback(
    function cancelConnecting(): void {
      setIsQrVisible(false);
      if (!isReady) void connection.disconnect();
    },
    [connection, isReady],
  );

  return {
    manager: isReady ? manager : null,
    address,
    isReady,
    walletName: connection.walletName,
    error: connection.error,
    uri: connection.uri,
    qrUri: connection.qrUri,
    isQrVisible: isQrVisible && connection.uri !== null && !isReady,
    startConnecting,
    cancelConnecting,
    disconnect: connection.disconnect,
  };
}
