import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const DAY = 86_400_000;

describe('marketplace (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let spot = 0;
  const http = () => request(app.getHttpServer());

  /** A guest with a starter plot, old enough to sell. */
  async function player(coins?: number) {
    spot++;
    const res = await http().post('/auth/guest');
    const id = res.body.user.id as string;
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    const claim = await http().post('/plots/starter').set(auth).send({ lat: 55.0 + spot * 0.01, lng: 25.0 });
    await prisma.user.update({ where: { id }, data: { createdAt: new Date(Date.now() - 10 * DAY) } });
    if (coins !== undefined) await setCoins(id, coins);
    return { id, auth, key: claim.body.plot.key as string, name: res.body.user.displayName as string };
  }

  async function setCoins(userId: string, coins: number) {
    const w = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    await prisma.wallet.update({ where: { userId }, data: { coins } });
    await prisma.transaction.create({ data: { userId, currency: 'coins', amount: coins - w.coins, balanceAfter: coins, type: 'test_adjust' } });
  }

  async function ledgerMatches(userId: string) {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const sum = await prisma.transaction.aggregate({ where: { userId, currency: 'coins' }, _sum: { amount: true } });
    expect(sum._sum.amount ?? 0).toBe(wallet.coins);
  }

  /** Starter plot value: common = 48 × 3 = 144 → allowed 72…2880. */
  async function plotOf(key: string) {
    const viewer = await player();
    return (await http().get(`/plots/${key}`).set(viewer.auth)).body;
  }

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('shows your plot’s value and the allowed price range', async () => {
    const s = await player();
    await prisma.plot.updateMany({ where: { ownerId: s.id }, data: { rarity: 'common', buildingLevel: 1 } });
    const plot = (await http().get(`/plots/${s.key}`).set(s.auth).expect(200)).body;
    // common: 48 × 3 = 144, + house 500 = 644 → 322 … 12880
    expect(plot.sale).toEqual({ value: 644, min: 322, max: 12880, feeRate: 0.05 });
    expect(plot.listing).toBeNull();
    expect((await plotOf(s.key)).sale).toBeNull(); // others don't see it
  });

  it('lists, sells and moves the plot with a 5% fee', async () => {
    const seller = await player();
    const buyer = await player(5000);
    await prisma.plot.updateMany({ where: { ownerId: seller.id }, data: { rarity: 'common', buildingLevel: 0 } });
    const sellerCoins = (await prisma.wallet.findUniqueOrThrow({ where: { userId: seller.id } })).coins;

    const listing = (await http().post(`/plots/${seller.key}/list`).set(seller.auth).send({ price: 1000 }).expect(200)).body;
    expect(listing).toMatchObject({ price: 1000, status: 'active', mine: true, seller: { id: seller.id } });
    expect((await http().get(`/plots/${seller.key}`).set(buyer.auth)).body.listing).toEqual({ id: listing.id, price: 1000 });

    const market = (await http().get('/market').set(buyer.auth).expect(200)).body;
    expect(market.listings.map((l: { id: string }) => l.id)).toContain(listing.id);
    expect(market.feeRate).toBe(0.05);

    // Can't buy your own listing.
    expect((await http().post(`/market/${listing.id}/buy`).set(seller.auth).expect(400)).body.code).toBe('own_listing');

    const res = (await http().post(`/market/${listing.id}/buy`).set(buyer.auth).expect(200)).body;
    expect(res.plot).toMatchObject({ key: seller.key, mine: true, listing: null });
    expect(res.plot.owner.id).toBe(buyer.id);
    expect(res.wallet.coins).toBe(5000 - 1000 + 0); // nothing waiting to collect on a fresh plot (rounding aside)

    const after = await prisma.wallet.findUniqueOrThrow({ where: { userId: seller.id } });
    expect(after.coins).toBeGreaterThanOrEqual(sellerCoins + 950); // + income collected before the sale
    const sale = await prisma.transaction.findFirstOrThrow({ where: { userId: seller.id, type: 'market_sale' } });
    expect(sale.amount).toBe(950);

    // Sold: gone from the market, shows in both players' history.
    expect((await http().get('/market').set(buyer.auth)).body.listings.map((l: { id: string }) => l.id)).not.toContain(listing.id);
    const mine = (await http().get('/market/mine').set(seller.auth).expect(200)).body;
    expect(mine.active).toHaveLength(0);
    expect(mine.history[0]).toMatchObject({ id: listing.id, status: 'sold', fee: 50, buyer: { id: buyer.id } });
    expect((await http().get('/market/mine').set(buyer.auth)).body.history[0].id).toBe(listing.id);

    await ledgerMatches(seller.id);
    await ledgerMatches(buyer.id);
  });

  it('refuses prices outside the range, double listings and plots you don’t own', async () => {
    const s = await player();
    const other = await player();
    await prisma.plot.updateMany({ where: { ownerId: s.id }, data: { rarity: 'common', buildingLevel: 0 } });
    const low = await http().post(`/plots/${s.key}/list`).set(s.auth).send({ price: 10 }).expect(400);
    expect(low.body).toMatchObject({ code: 'price_out_of_range', min: 72, max: 2880 });
    await http().post(`/plots/${s.key}/list`).set(s.auth).send({ price: 2881 }).expect(400);
    await http().post(`/plots/${s.key}/list`).set(other.auth).send({ price: 500 }).expect(403);

    await http().post(`/plots/${s.key}/list`).set(s.auth).send({ price: 500 }).expect(200);
    expect((await http().post(`/plots/${s.key}/list`).set(s.auth).send({ price: 600 }).expect(409)).body.code).toBe('already_listed');
  });

  it('new accounts can’t sell yet', async () => {
    const s = await player();
    await prisma.user.update({ where: { id: s.id }, data: { createdAt: new Date() } });
    const res = await http().post(`/plots/${s.key}/list`).set(s.auth).send({ price: 500 }).expect(400);
    expect(res.body.code).toBe('account_too_new_to_sell');
  });

  it('cancels a listing; a cancelled listing can’t be bought', async () => {
    const s = await player();
    const b = await player(5000);
    const l = (await http().post(`/plots/${s.key}/list`).set(s.auth).send({ price: 500 }).expect(200)).body;
    await http().post(`/market/${l.id}/cancel`).set(b.auth).expect(404);
    expect((await http().post(`/market/${l.id}/cancel`).set(s.auth).expect(200)).body.status).toBe('cancelled');
    expect((await http().post(`/market/${l.id}/buy`).set(b.auth).expect(409)).body.code).toBe('listing_closed');
    // Can list again after cancelling.
    await http().post(`/plots/${s.key}/list`).set(s.auth).send({ price: 600 }).expect(200);
  });

  it('a buyer without enough coins gets nothing and the listing stays', async () => {
    const s = await player();
    const b = await player(100);
    const l = (await http().post(`/plots/${s.key}/list`).set(s.auth).send({ price: 1000 }).expect(200)).body;
    expect((await http().post(`/market/${l.id}/buy`).set(b.auth).expect(400)).body.code).toBe('insufficient_funds');
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('active');
    expect((await prisma.plot.findFirstOrThrow({ where: { listings: { some: { id: l.id } } } })).ownerId).toBe(s.id);
    await ledgerMatches(b.id);
  });

  it('two buyers at once: exactly one gets the plot', async () => {
    const s = await player();
    const [b1, b2] = [await player(5000), await player(5000)];
    const l = (await http().post(`/plots/${s.key}/list`).set(s.auth).send({ price: 1000 }).expect(200)).body;
    const results = await Promise.all([b1, b2].map((b) => http().post(`/market/${l.id}/buy`).set(b.auth)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results[0].status === 200 ? b1 : b2;
    const loser = winner === b1 ? b2 : b1;
    const plot = await prisma.plot.findFirstOrThrow({ where: { listings: { some: { id: l.id } } } });
    expect(plot.ownerId).toBe(winner.id);
    expect((await prisma.wallet.findUniqueOrThrow({ where: { userId: loser.id } })).coins).toBeGreaterThanOrEqual(5000);
    for (const p of [s, b1, b2]) await ledgerMatches(p.id);
  });

  it('filters, sorts, searches and keeps favourites', async () => {
    const s = await player();
    const v = await player();
    await prisma.plot.updateMany({ where: { ownerId: s.id }, data: { rarity: 'epic' } });
    await prisma.plot.updateMany({ where: { ownerId: v.id }, data: { rarity: 'common' } });
    const epic = (await http().post(`/plots/${s.key}/list`).set(s.auth).send({ price: 2000 }).expect(200)).body;
    const common = (await http().post(`/plots/${v.key}/list`).set(v.auth).send({ price: 100 }).expect(200)).body;
    const viewer = await player();

    const ids = async (query: string) =>
      (await http().get(`/market${query}`).set(viewer.auth).expect(200)).body.listings.map((l: { id: string }) => l.id) as string[];
    expect(await ids('?rarity=epic')).toEqual([epic.id]);
    const cheapest = await ids('?sort=cheapest');
    expect(cheapest.indexOf(common.id)).toBeLessThan(cheapest.indexOf(epic.id));
    expect((await ids('?sort=rarity'))[0]).toBe(epic.id);
    expect(await ids(`?q=%23${epic.plot.number}`)).toEqual([epic.id]);
    expect(await ids(`?q=${encodeURIComponent(s.name.slice(0, 8))}`)).toContain(epic.id);

    expect(await ids('?favourites=1')).toEqual([]);
    await http().put(`/plots/${epic.plot.key}/favourite`).set(viewer.auth).expect(200);
    expect(await ids('?favourites=1')).toEqual([epic.id]);
    const all = (await http().get('/market').set(viewer.auth)).body.listings;
    expect(all.find((l: { id: string }) => l.id === epic.id).favourite).toBe(true);
    await http().delete(`/plots/${epic.plot.key}/favourite`).set(viewer.auth).expect(200);
    expect(await ids('?favourites=1')).toEqual([]);
  });
});
