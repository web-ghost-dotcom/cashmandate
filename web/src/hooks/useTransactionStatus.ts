import { useEffect, useState } from 'react';
import { readTransactionStatus, type TransactionStatus } from '../lib/chain';

export type TransactionStatusState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly transaction: TransactionStatus }
  | { readonly status: 'failed' };

export function useTransactionStatus(transactionId: string): TransactionStatusState {
  const [state, setState] = useState<TransactionStatusState>({ status: 'loading' });

  useEffect(
    function loadTransactionStatus() {
      let isActive = true;
      setState({ status: 'loading' });

      readTransactionStatus(transactionId)
        .then(function storeStatus(transaction) {
          if (isActive) {
            setState({ status: 'ready', transaction });
          }
        })
        .catch(function storeFailure() {
          if (isActive) {
            setState({ status: 'failed' });
          }
        });

      return function cancelLoad() {
        isActive = false;
      };
    },
    [transactionId],
  );

  return state;
}
