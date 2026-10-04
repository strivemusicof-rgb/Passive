import { createPublicKey, verify, type KeyObject } from 'node:crypto';

import { Injectable } from '@nestjs/common';

export const ADMOB_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const KEYS_TTL_MS = 12 * 3600_000;

export type AdmobCallback = {
  userId: string;
  customData: string;
  transactionId: string;
};

/**
 * Checks AdMob's server-side verification (SSV) callback: Google signs the
 * query string with one of its published ECDSA keys. The signed part is
 * everything before `&signature=`, exactly as received.
 * Tests swap `fetchKeys` for a local key.
 */
@Injectable()
export class AdmobVerifier {
  private cache: { keys: Map<string, KeyObject>; at: number } | null = null;

  protected async fetchKeys(): Promise<{ keyId: number | string; pem: string }[]> {
    const res = await fetch(ADMOB_KEYS_URL);
    if (!res.ok) throw new Error(`AdMob keys: HTTP ${res.status}`);
    const body = (await res.json()) as { keys: { keyId: number; pem: string }[] };
    return body.keys;
  }

  private async keys(refresh = false): Promise<Map<string, KeyObject>> {
    if (!refresh && this.cache && Date.now() - this.cache.at < KEYS_TTL_MS) return this.cache.keys;
    const keys = new Map((await this.fetchKeys()).map((k) => [String(k.keyId), createPublicKey(k.pem)]));
    this.cache = { keys, at: Date.now() };
    return keys;
  }

  /** Returns the callback's fields if the signature is good, otherwise null. */
  async verify(rawQuery: string): Promise<AdmobCallback | null> {
    const at = rawQuery.indexOf('&signature=');
    if (at < 0) return null;
    const message = rawQuery.slice(0, at);
    const params = new URLSearchParams(rawQuery);
    const signature = params.get('signature');
    const keyId = params.get('key_id');
    if (!signature || !keyId) return null;

    let key = (await this.keys()).get(keyId);
    // Google rotates keys: fetch again once if this one is new to us.
    if (!key) key = (await this.keys(true)).get(keyId);
    if (!key) return null;

    const ok = verify('sha256', Buffer.from(message), { key, dsaEncoding: 'der' }, Buffer.from(signature, 'base64url'));
    if (!ok) return null;
    return {
      userId: params.get('user_id') ?? '',
      customData: params.get('custom_data') ?? '',
      transactionId: params.get('transaction_id') ?? '',
    };
  }
}
