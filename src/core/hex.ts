import { binToHex, hexToBin, isHex } from '@bitauth/libauth';

export function encodeHex(bytes: Uint8Array): string {
  return binToHex(bytes);
}

export function decodeHex(hexadecimalText: string, expectedByteLength?: number): Uint8Array {
  const trimmedText = hexadecimalText.trim().toLowerCase();
  if (!isHex(trimmedText)) {
    throw new Error(`Value is not valid hexadecimal: "${hexadecimalText}"`);
  }
  const decodedBytes = hexToBin(trimmedText);
  if (expectedByteLength !== undefined && decodedBytes.length !== expectedByteLength) {
    throw new Error(
      `Expected ${expectedByteLength} bytes but received ${decodedBytes.length} bytes`,
    );
  }
  return decodedBytes;
}

export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
