import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { RARITIES } from '@landrush/shared';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const RIGA = { lat: 56.9496, lng: 24.1052 };
// Countryside far from any hotspot, so tests can find cheap common plots.
const FIELD = { lat: 56.7, lng: 24.6 };

describe('plots & wallet (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  async function guest() {
    const res = await http().post('/auth/guest');
    return { id: res.body.user.id as string, auth: { Authorization: `Bearer ${res.body.accessToken}` } };
  }

  /** Sum of the ledger must always equal the wallet balance. */
  async function ledgerMatches(userId: string) {
    const prisma = app.get(PrismaService);
    // A wallet is created on first use; a rolled-back first purchase leaves none.
    const wallet = (await prisma.wallet.findUnique({ where: { userId } })) ?? { coins: 0, gems: 0 };
    const sums = await prisma.transaction.groupBy({ by: ['currency'], where: { userId }, _sum: { amount: true } });
    const sum = (c: string) => sums.find((s) => s.currency === c)?._sum.amount ?? 0;
    expect(sum('coins')).toBe(wallet.coins);
    expect(sum('gems')).toBe(wallet.gems);
  }

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('new players get the welcome bonus once', async () => {
    const p = await guest();
    const [a, b] = await Promise.all([http().get('/wallet').set(p.auth), http().get('/wallet').set(p.auth)]);
    expect(a.body).toEqual({ coins: 1000, gems: 20 });
    expect(b.body).toEqual({ coins: 1000, gems: 20 });
    await ledgerMatches(p.id);
  });

  it('claims a free starter plot where the player stands, only once', async () => {
    const p = await guest();
    const res = await http().post('/plots/starter').set(p.auth).send(RIGA).expect(201);
    expect(res.body.plot).toMatchObject({ mine: true, number: expect.any(Number), price: null });
    expect(Math.abs(res.body.plot.lat - RIGA.lat)).toBeLessThan(0.001);
    expect(res.body.wallet.coins).toBe(1000); // free
    const again = await http().post('/plots/starter').set(p.auth).send(RIGA).expect(409);
    expect(again.body.code).toBe('starter_already_claimed');
  });

  it("a second player's starter plot goes to the next free cell", async () => {
    const a = await guest();
    const b = await guest();
    const pa = await http().post('/plots/starter').set(a.auth).send(FIELD).expect(201);
    const pb = await http().post('/plots/starter').set(b.auth).send(FIELD).expect(201);
    expect(pb.body.plot.key).not.toBe(pa.body.plot.key);
  });

  it('free plots show odds, not rarity; buying rolls one and charges the flat price', async () => {
    const p = await guest();
    const box = { south: FIELD.lat, west: FIELD.lng + 0.01, north: FIELD.lat + 0.002, east: FIELD.lng + 0.014 };
    const map = await http().get('/map/plots').query(box).set(p.auth).expect(200);
    expect(map.body.free.length).toBeGreaterThan(10);
    const target = map.body.free[3];
    expect(target).toMatchObject({ rarity: null, price: 150, boosted: false, owner: null });
    expect(target.odds.common).toBeCloseTo(0.6);

    const res = await http().post(`/plots/${target.key}/buy`).set(p.auth).expect(201);
    expect(res.body.wallet.coins).toBe(1000 - 150);
    expect(RARITIES).toContain(res.body.plot.rarity);
    expect(res.body.plot).toMatchObject({ key: target.key, mine: true, odds: null });
    await ledgerMatches(p.id);

    const detail = await http().get(`/plots/${target.key}`).set(p.auth).expect(200);
    expect(detail.body.owner.id).toBe(p.id);
    expect(detail.body.rarity).toBe(res.body.plot.rarity);
    const mine = await http().get('/me/plots').set(p.auth).expect(200);
    expect(mine.body.map((x: { key: string }) => x.key)).toContain(target.key);
    const after = await http().get('/map/plots').query(box).set(p.auth).expect(200);
    expect(after.body.owned.map((x: { key: string }) => x.key)).toContain(target.key);
    expect(after.body.free.map((x: { key: string }) => x.key)).not.toContain(target.key);
    // The next plot is 5% dearer, wherever it is.
    expect(after.body.free[0].price).toBe(158);
  });

  it('plots near landmarks are marked and have better odds', async () => {
    const p = await guest();
    const res = await http().get('/map/plots').query({ south: 56.951, west: 24.1128, north: 56.9518, east: 24.1138 }).set(p.auth).expect(200);
    const near = res.body.free.find((c: { boosted: boolean }) => c.boosted);
    expect(near).toBeDefined();
    expect(near.odds.legendary).toBeGreaterThan(0.01);
    expect(near.price).toBe(150);
  });

  it('cannot buy a plot someone owns', async () => {
    const a = await guest();
    const b = await guest();
    const { body } = await http().post('/plots/starter').set(a.auth).send({ lat: 56.71, lng: 24.61 });
    const res = await http().post(`/plots/${body.plot.key}/buy`).set(b.auth).expect(409);
    expect(res.body.code).toBe('plot_taken');
  });

  it('two players buying the same plot at once: exactly one wins', async () => {
    const a = await guest();
    const b = await guest();
    const key = (await http().get('/plots/189500_43000').set(a.auth)).body.key;
    const results = await Promise.all([
      http().post(`/plots/${key}/buy`).set(a.auth),
      http().post(`/plots/${key}/buy`).set(b.auth),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    await ledgerMatches(a.id);
    await ledgerMatches(b.id);
  });

  it('cannot spend more coins than you have, and nothing is half-done', async () => {
    const p = await guest();
    const prisma = app.get(PrismaService);
    await http().get('/wallet').set(p.auth);
    await prisma.wallet.update({ where: { userId: p.id }, data: { coins: 50 } });
    await prisma.transaction.create({ data: { userId: p.id, currency: 'coins', amount: -950, balanceAfter: 50, type: 'test_adjust' } });
    const res = await http().post('/plots/189600_43100/buy').set(p.auth).expect(400);
    expect(res.body.code).toBe('insufficient_funds');
    await http().get('/plots/189600_43100').set(p.auth).expect(200).expect((r) => expect(r.body.owner).toBeNull());
    expect((await http().get('/wallet').set(p.auth)).body.coins).toBe(50);
    await ledgerMatches(p.id);
  });

  it('rejects bad plot ids and huge map areas', async () => {
    const p = await guest();
    await http().get('/plots/not-a-plot').set(p.auth).expect(400);
    const res = await http().get('/map/plots').query({ south: 50, west: 20, north: 60, east: 30 }).set(p.auth).expect(400);
    expect(res.body.code).toBe('area_too_large');
    await http().get('/map/plots').query({ south: 56.9, west: 24 }).set(p.auth).expect(400);
  });

  it('a big map area lists owned plots but no free cells', async () => {
    const p = await guest();
    await http().post('/plots/starter').set(p.auth).send({ lat: 56.72, lng: 24.62 });
    const res = await http().get('/map/plots').query({ south: 56.69, west: 24.55, north: 56.75, east: 24.7 }).set(p.auth).expect(200);
    expect(res.body.free).toEqual([]);
    expect(res.body.owned.length).toBeGreaterThan(0);
  });

  it('deleting an account frees its plots', async () => {
    const p = await guest();
    const { body } = await http().post('/plots/starter').set(p.auth).send({ lat: 56.73, lng: 24.63 });
    await http().delete('/me').set(p.auth).expect(204);
    const other = await guest();
    const res = await http().get(`/plots/${body.plot.key}`).set(other.auth).expect(200);
    expect(res.body.owner).toBeNull();
  });

  it('requires login', async () => {
    await http().get('/wallet').expect(401);
    await http().get('/map/plots').query({ south: 56.9, west: 24, north: 56.91, east: 24.01 }).expect(401);
  });
});
