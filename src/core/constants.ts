export const DEFAULT_NETWORK = 'chipnet';

export const CHIPNET_EXPLORER_TRANSACTION_URL = 'https://chipnet.imaginary.cash/tx/';
export const CHIPNET_EXPLORER_ADDRESS_URL = 'https://chipnet.imaginary.cash/address/';

/** Must equal MAXIMUM_MINER_FEE_SATOSHIS in contracts/CashMandate.cash. */
export const CONTRACT_MAXIMUM_MINER_FEE_SATOSHIS = 2000n;

/** Fee paid by every spend transaction. Well under the contract cap. */
export const SPEND_FEE_SATOSHIS = 1000n;

export const MINIMUM_RELAY_FEE_RATE = 1;

/** Bytes in one approved recipient entry: a public key hash. */
export const RECIPIENT_ENTRY_BYTE_LENGTH = 20;

/** Longest memo the agent may attach, so the memo output stays standard. */
export const MAXIMUM_MEMO_BYTES = 80;

export const PRIVATE_KEY_BYTE_LENGTH = 32;
