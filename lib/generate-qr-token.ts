import * as Crypto from 'expo-crypto';

/**
 * Generate a cryptographically random QR token compatible with web + mobile exit scan.
 * Always uses `QR-` prefix — web manual entry often rejects tokens without it.
 */
export async function generateQRToken(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(6);
  const randomPart = Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `QR-${Date.now()}-${randomPart}`;
}
