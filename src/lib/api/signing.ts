import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

// Signing is done with @noble/hashes instead of crypto.subtle because
// crypto.subtle only exists in secure contexts (HTTPS or localhost).

export function sha256Hex(body: Uint8Array): string {
  return bytesToHex(sha256(body));
}

export interface SignInput {
  method: string;
  /** pathname + search, exactly as sent, e.g. /api/v1/users?page=2 */
  requestUri: string;
  /** Unix time in seconds */
  timestamp: string;
  nonce: string;
  body: Uint8Array;
  appKey: string;
}

export function buildSigningPayload(input: Omit<SignInput, 'appKey'>): string {
  return [
    input.method.toUpperCase(),
    input.requestUri,
    input.timestamp,
    input.nonce,
    sha256Hex(input.body),
  ].join('\n');
}

export function signRequest(input: SignInput): string {
  const payload = buildSigningPayload(input);
  return bytesToHex(hmac(sha256, utf8ToBytes(input.appKey), utf8ToBytes(payload)));
}

export function randomNonce(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export interface PreparedBody {
  bytes: Uint8Array;
  contentType?: string;
}

/**
 * Serializes FormData ourselves so the signed bytes (and the multipart
 * boundary) are exactly the bytes the server receives.
 */
export async function serializeFormData(formData: FormData): Promise<PreparedBody> {
  const response = new Response(formData);
  const contentType = response.headers.get('content-type') ?? undefined;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, contentType };
}

export function serializeJson(value: unknown): PreparedBody {
  return { bytes: utf8ToBytes(JSON.stringify(value)), contentType: 'application/json' };
}
