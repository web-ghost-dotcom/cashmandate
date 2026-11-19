import { CHIPNET_EXPLORER_ADDRESS_URL, CHIPNET_EXPLORER_TRANSACTION_URL } from '../../../src/core/constants';

const SATOSHIS_PER_BCH = 100_000_000;

export function formatSatoshis(satoshis: number): string {
  return new Intl.NumberFormat('en-US').format(satoshis);
}

export function formatBch(satoshis: number): string {
  return (satoshis / SATOSHIS_PER_BCH).toFixed(8);
}

export function shortenMiddle(value: string, leadingCharacters = 8, trailingCharacters = 6): string {
  if (value.length <= leadingCharacters + trailingCharacters + 1) {
    return value;
  }
  return `${value.slice(0, leadingCharacters)}…${value.slice(-trailingCharacters)}`;
}

export function shortenAddress(address: string): string {
  const [prefix, payload] = address.includes(':') ? address.split(':') : ['', address];
  const shortenedPayload = shortenMiddle(payload ?? address, 6, 6);
  return prefix === '' ? shortenedPayload : `${prefix}:${shortenedPayload}`;
}

export function transactionUrl(transactionId: string): string {
  return `${CHIPNET_EXPLORER_TRANSACTION_URL}${transactionId}`;
}

export function addressUrl(address: string): string {
  return `${CHIPNET_EXPLORER_ADDRESS_URL}${address}`;
}
