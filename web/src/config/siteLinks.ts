const CASHTOKENS_ADDRESS_PATTERN = /^bitcoincash:z[0-9a-z]{40,}$/;

export const REPOSITORY_URL = 'https://github.com/web-ghost-dotcom/cashmandate';

function readPresentationUrl(): string | null {
  const configured: string | undefined = import.meta.env.VITE_PRESENTATION_URL;
  if (configured === undefined || configured === '') return null;
  const parsed = new URL(configured);
  if (parsed.protocol !== 'https:') {
    throw new Error(`VITE_PRESENTATION_URL must be an https link, got ${configured}`);
  }
  return parsed.href;
}

function readDonationAddress(): string | null {
  const configured: string | undefined = import.meta.env.VITE_EMBER_DONATION_ADDRESS;
  if (configured === undefined || configured === '') return null;
  if (!CASHTOKENS_ADDRESS_PATTERN.test(configured)) {
    throw new Error(`VITE_EMBER_DONATION_ADDRESS must be a CashTokens address starting bitcoincash:z, got ${configured}`);
  }
  return configured;
}

export const PRESENTATION_URL = readPresentationUrl();
export const EMBER_DONATION_ADDRESS = readDonationAddress();
