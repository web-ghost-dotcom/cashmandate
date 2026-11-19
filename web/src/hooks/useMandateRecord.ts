import { useEffect, useState } from 'react';
import type { MandateRecord } from '../../../src/core/mandateRecord';
import { loadMandateRecord } from '../lib/mandateRegistry';

export type MandateRecordState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly record: MandateRecord }
  | { readonly status: 'failed'; readonly message: string };

export function useMandateRecord(): MandateRecordState {
  const [state, setState] = useState<MandateRecordState>({ status: 'loading' });

  useEffect(function loadRecordOnce() {
    let isActive = true;
    loadMandateRecord()
      .then(function storeRecord(record) {
        if (isActive) {
          setState({ status: 'ready', record });
        }
      })
      .catch(function storeFailure(failure: unknown) {
        if (isActive) {
          setState({ status: 'failed', message: failure instanceof Error ? failure.message : 'Unknown error' });
        }
      });
    return function cancelLoad() {
      isActive = false;
    };
  }, []);

  return state;
}
