import { useEffect, useState } from 'react';
import { readChainHeight } from '../lib/chain';

const POLL_INTERVAL_MILLISECONDS = 30_000;

export type ChainHeightState =
  | { readonly status: 'connecting' }
  | { readonly status: 'online'; readonly height: number }
  | { readonly status: 'offline' };

export function useChainHeight(): ChainHeightState {
  const [state, setState] = useState<ChainHeightState>({ status: 'connecting' });

  useEffect(function pollChainHeight() {
    let isActive = true;

    async function refreshHeight(): Promise<void> {
      try {
        const height = await readChainHeight();
        if (isActive) {
          setState({ status: 'online', height });
        }
      } catch {
        if (isActive) {
          setState({ status: 'offline' });
        }
      }
    }

    void refreshHeight();
    const pollTimer = window.setInterval(refreshHeight, POLL_INTERVAL_MILLISECONDS);
    return function stopPolling() {
      isActive = false;
      window.clearInterval(pollTimer);
    };
  }, []);

  return state;
}
