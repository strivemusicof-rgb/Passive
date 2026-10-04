import { generateKeyPairSync, sign } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AdmobVerifier } from '../src/ads/admob.verifier.js';
import { EconomyService } from '../src/economy/economy.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const HOUR = 3600_000;

describe('rewarded ads (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let spot = 0;
  const http = () => request(app.getHttpServer());

  // Fake Google: our own key pair stands in for AdMob's published keys.
  const google = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const KEY_ID = '1234567';

  function ssvQuery(fields: { adId: string; userId: string; tx: string }, key = google.privateKey) {
    const message = [
      'ad_network=5450213213286189855',
      'ad_unit=1234567890',
      `custom_data=${fields.adId}`,
      'reward_amount=1',
      'reward_item=Reward',
      `timestamp=${Date.now()}`,
      `transaction_id=${fields.tx}`,
      `user_id=${fields.userId}`,
    ].join('&');
    const signature = sign('sha256', Buffer.from(message), { key, dsaEncoding: 'der' }).toString('base64url');
    return `${message}&signature=${signature}&key_id=${KEY_ID}`;
  }

  async function player() {
    spot++;
    const res = await http().post('/auth/guest');
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    await http().post('/plots/starter').set(auth).send({ lat: 55.5 + spot * 0.01, lng: 26.2 });
    return { id: res.body.user.id as string, auth };
  }

  async function config(key: string, value: object) {
    const current = (await app.get(EconomyService).get()) as unknown as Record<string, object>;
    await prisma.economyConfig.upsert({ where: { key }, create: { key, value: { ...current[key], ...value } }, update: { value: { ...current[key], ...value } } });
    app.get(EconomyService).invalidate();
  }

  async function ledgerMatches(userId: string) {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    for (const currency of ['coins', 'points'] as const) {
      const sum = await prisma.transaction.aggregate({ where: { userId, currency }, _sum: { amount: true } });
      expect(sum._sum.amount ?? 0).toBe(wallet[currency]);
    }
  }

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
    const pem = google.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    (app.get(AdmobVerifier) as unknown as { fetchKeys: () => Promise<unknown> }).fetchKeys = async () => [{ keyId: Number(KEY_ID), pem }];
  });

  beforeEach(async () => {
    await prisma.economyConfig.deleteMany();
    app.get(EconomyService).invalidate();
  });

  afterAll(async () => {
    await app.close();
  });

  it('pays a bonus ad once, then waits for the cooldown', async () => {
    const p = await player();
    const before = (await http().get('/wallet').set(p.auth).expect(200)).body.coins;
    const status = (await http().get('/ads').set(p.auth).expect(200)).body;
    expect(status).toMatchObject({ enabled: true, remainingToday: 20, cooldownUntil: null, collect2x: null, bonus: { coins: 100, points: 5 } });

    const { id } = (await http().post('/ads/start').set(p.auth).send({ placement: 'bonus' }).expect(200)).body;
    const res = (await http().post(`/ads/${id}/complete`).set(p.auth).expect(200)).body;
    expect(res).toMatchObject({ status: 'rewarded', coins: 100, points: 0 }); // rewards are off: no ⭐
    expect(res.wallet.coins).toBe(before + 100);
    expect(res.ads.remainingToday).toBe(19);
    expect(res.ads.cooldownUntil).not.toBeNull();

    // Reporting it again pays nothing more.
    const again = (await http().post(`/ads/${id}/complete`).set(p.auth).expect(200)).body;
    expect(again.wallet.coins).toBe(before + 100);

    const cool = await http().post('/ads/start').set(p.auth).send({ placement: 'bonus' }).expect(409);
    expect(cool.body.code).toBe('ads_cooldown');
    await ledgerMatches(p.id);
  });

  it('doubles the latest collect once', async () => {
    const p = await player();
    expect((await http().post('/ads/start').set(p.auth).send({ placement: 'collect2x' }).expect(400)).body.code).toBe('nothing_to_double');

    await prisma.plot.updateMany({ where: { ownerId: p.id }, data: { collectedAt: new Date(Date.now() - 4 * HOUR) } });
    const collected = (await http().post('/collect').set(p.auth).expect(200)).body;
    expect(collected.collected).toBeGreaterThan(0);
    expect((await http().get('/ads').set(p.auth).expect(200)).body.collect2x).toEqual({ coins: collected.collected });

    // Closing the ad early and trying again reuses the same ad view.
    const first = (await http().post('/ads/start').set(p.auth).send({ placement: 'collect2x' }).expect(200)).body.id;
    const { id } = (await http().post('/ads/start').set(p.auth).send({ placement: 'collect2x' }).expect(200)).body;
    expect(id).toBe(first);

    const res = (await http().post(`/ads/${id}/complete`).set(p.auth).expect(200)).body;
    expect(res.coins).toBe(collected.collected);
    expect(res.wallet.coins).toBe(collected.wallet.coins + collected.collected);
    expect(res.ads.collect2x).toBeNull();

    await config('ads', { cooldownSec: 0 });
    expect((await http().post('/ads/start').set(p.auth).send({ placement: 'collect2x' }).expect(400)).body.code).toBe('nothing_to_double');
    await ledgerMatches(p.id);
  });

  it('stops at the daily limit', async () => {
    await config('ads', { maxPerDay: 2, cooldownSec: 0 });
    const p = await player();
    for (let i = 0; i < 2; i++) {
      const { id } = (await http().post('/ads/start').set(p.auth).send({ placement: 'bonus' }).expect(200)).body;
      await http().post(`/ads/${id}/complete`).set(p.auth).expect(200);
    }
    expect((await http().post('/ads/start').set(p.auth).send({ placement: 'bonus' }).expect(400)).body.code).toBe('ads_limit');
    expect((await http().get('/ads').set(p.auth).expect(200)).body.remainingToday).toBe(0);
  });

  it('gives ⭐ for bonus ads outside the free-play limit', async () => {
    await config('rewards', { enabled: true, dailyCap: 0, dailyCapPerLevel: 0 });
    const p = await player();
    const { id } = (await http().post('/ads/start').set(p.auth).send({ placement: 'bonus' }).expect(200)).body;
    const res = (await http().post(`/ads/${id}/complete`).set(p.auth).expect(200)).body;
    expect(res.points).toBe(5);
    expect(res.wallet.points).toBe(5);
    const rewards = (await http().get('/rewards').set(p.auth).expect(200)).body;
    expect(rewards).toMatchObject({ todayAds: 5, todayEarned: 0, earn: { perAd: 5, adsPerDay: 20 } });
    await ledgerMatches(p.id);
  });

  it('with verification on, only a signed Google callback pays', async () => {
    await config('ads', { requireSsv: true });
    const p = await player();
    const before = (await http().get('/wallet').set(p.auth).expect(200)).body.coins;
    const { id } = (await http().post('/ads/start').set(p.auth).send({ placement: 'bonus' }).expect(200)).body;

    const pending = (await http().post(`/ads/${id}/complete`).set(p.auth).expect(200)).body;
    expect(pending).toMatchObject({ status: 'pending', coins: 0 });
    expect(pending.wallet.coins).toBe(before);

    // Forged: signed with another key, or tampered after signing.
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
    await http().get(`/ads/ssv?${ssvQuery({ adId: id, userId: p.id, tx: 'tx1' }, other)}`).expect(400);
    const tampered = ssvQuery({ adId: id, userId: p.id, tx: 'tx1' }).replace('reward_amount=1', 'reward_amount=9');
    await http().get(`/ads/ssv?${tampered}`).expect(400);
    // Someone else's user id: accepted (200) but pays nobody.
    await http().get(`/ads/ssv?${ssvQuery({ adId: id, userId: '00000000-0000-0000-0000-000000000000', tx: 'tx0' })}`).expect(200);
    expect((await http().post(`/ads/${id}/complete`).set(p.auth).expect(200)).body.status).toBe('pending');

    const good = ssvQuery({ adId: id, userId: p.id, tx: 'tx1' });
    await http().get(`/ads/ssv?${good}`).expect(200);
    await http().get(`/ads/ssv?${good}`).expect(200); // Google retries: still paid once

    const done = (await http().post(`/ads/${id}/complete`).set(p.auth).expect(200)).body;
    expect(done).toMatchObject({ status: 'rewarded', coins: 100 });
    expect(done.wallet.coins).toBe(before + 100);
    await ledgerMatches(p.id);
  });

  it("can't complete another player's ad", async () => {
    const a = await player();
    const b = await player();
    const { id } = (await http().post('/ads/start').set(a.auth).send({ placement: 'bonus' }).expect(200)).body;
    await http().post(`/ads/${id}/complete`).set(b.auth).expect(404);
  });
});
