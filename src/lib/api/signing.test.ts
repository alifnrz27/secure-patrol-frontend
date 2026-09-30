// @vitest-environment node
// Node provides the same native FormData/Response/Blob as browsers; jsdom replaces FormData with one Response cannot serialize.
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { randomNonce, serializeFormData, sha256Hex, signRequest } from './signing';

const TEST_KEY = 'spk_TEST-ONLY-4pZt7Qm2Xv9Lr3Ks8Wd1Nf6Hy0Bc5Ja';
const empty = new Uint8Array(0);

describe('signRequest (backend test vectors)', () => {
  it('vector 1: POST login with JSON body', () => {
    const body = utf8ToBytes('{"email":"tim@securepatrol.local","password":"Password123"}');
    expect(sha256Hex(body)).toBe('511f90493776b18136558905986a0abb6bb1e4bdc68e5bcd1374196004f0fc24');
    expect(
      signRequest({
        method: 'POST',
        requestUri: '/api/v1/auth/login',
        timestamp: '1790668800',
        nonce: '0123456789abcdef0123456789abcdef',
        body,
        appKey: TEST_KEY,
      }),
    ).toBe('f5681cea7af562190e884bc0b1aff7a303367cf687ede9ec9c70d6e2c64da48c');
  });

  it('vector 2: GET without body', () => {
    expect(
      signRequest({
        method: 'GET',
        requestUri: '/api/v1/patrol-groups/current',
        timestamp: '1790668800',
        nonce: 'fedcba9876543210fedcba9876543210',
        body: empty,
        appKey: TEST_KEY,
      }),
    ).toBe('e4ac3c5d488438c9e829dfd0091a6eb540d3bd4fc4682f85195859e15b7f1f12');
  });

  it('vector 3: GET with query string', () => {
    expect(
      signRequest({
        method: 'get',
        requestUri: '/api/v1/help-desk-articles?category=faq&page=1',
        timestamp: '1790668801',
        nonce: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        body: empty,
        appKey: TEST_KEY,
      }),
    ).toBe('ccd21a96183515fc2ae3ad4aed4de79b217933250e232f99128a6892c767c2c3');
  });

  it('hashes an empty body as SHA-256 of the empty string', () => {
    expect(sha256Hex(empty)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('multipart signing', () => {
  function sampleForm() {
    const form = new FormData();
    form.append('name', 'Budi Santoso');
    form.append('is_active', 'true');
    form.append('face_photo', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: 'image/jpeg' }), 'face.jpg');
    return form;
  }

  it('serializes FormData once, with the boundary in the content type and in the bytes', async () => {
    const { bytes, contentType } = await serializeFormData(sampleForm());
    const boundary = /boundary=(.+)$/.exec(contentType ?? '')?.[1];
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(boundary).toBeTruthy();
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain(`--${boundary}`);
    expect(text).toContain('name="face_photo"; filename="face.jpg"');
    expect(text).toContain('Content-Type: image/jpeg');
  });

  it('signs the exact serialized bytes; a re-serialization would not match', async () => {
    const first = await serializeFormData(sampleForm());
    const second = await serializeFormData(sampleForm());
    const base = { method: 'POST', requestUri: '/api/v1/users', timestamp: '1790668800', nonce: 'fedcba9876543210fedcba9876543210', appKey: TEST_KEY };
    const sigFirst = signRequest({ ...base, body: first.bytes });
    expect(sigFirst).toMatch(/^[0-9a-f]{64}$/);
    expect(signRequest({ ...base, body: first.bytes })).toBe(sigFirst);
    // A new boundary produces new bytes, which is why the body must be serialized before signing.
    expect(second.contentType).not.toBe(first.contentType);
    expect(signRequest({ ...base, body: second.bytes })).not.toBe(sigFirst);
  });
});

describe('randomNonce', () => {
  it('returns 32 lowercase hex chars and differs per call', () => {
    const a = randomNonce();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(randomNonce()).not.toBe(a);
  });
});
