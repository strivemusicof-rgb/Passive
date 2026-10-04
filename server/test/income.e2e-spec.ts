import { INestApplication } from '@nestjs/common';
import { cellAt, cellKey } from '@landrush/shared/grid';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const HOUR = 3_600_000;

describe('income, collect & buildings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let spot = 0;
  const http = () => request(app.getHttpServer());

  /** A guest with a free starter plot of a known rarity in its own empty area. */
  async function playerWithPlot(rarity = 'common') {
    const res = await http().post('/auth/guest');
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    spot++;
    const claim = await http().post('/plots/starter').set(auth).send({ lat: 56.6 + spot * 0.01, lng: 24.8 });
    const key = claim.body.plot.key as string;
    const [row, col] = key.split('_').map(Number);
    await prisma.plot.update({ where: { row_col: { row, col } }, data: { rarity } });
    return { id: res.body.user.id as string, auth, key, row, col };
  }

  /** Pretend the player last collected `hours` ago. */
  const rewind = (userId: string, hours: number) =>
    prisma.plot.updateMany({ where: { ownerId: userId }, data: { collectedAt: new Date(Date.now() - hours * HOUR) } });

  const coins = async (auth: Record<string, string>) => (await http().get('/wallet').set(auth)).body.coins as number;

  async function ledgerMatches(userId: string) {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const sum = await prisma.transaction.aggregate({ where: { userId, currency: 'coins' }, _sum: { amount: true } });
    expect(sum._sum.amount).toBe(wallet.coins);
  }

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a common plot earns 2 coins an hour; collect pays and resets', async () => {
    const p = await playerWithPlot();
    await rewind(p.id, 3);
    const income = (await http().get('/me/income').set(p.auth).expect(200)).body;
    expect(income).toMatchObject({ perDay: 48, pending: 6, storageHours: 8, storageLevel: 0 });

    const res = await http().post('/collect').set(p.auth).expect(200);
    expect(res.body.collected).toBe(6);
    expect(res.body.wallet.coins).toBe(1006);
    expect(res.body.income.pending).toBe(0);
    expect((await http().post('/collect').set(p.auth)).body.collected).toBe(0);
    await ledgerMatches(p.id);
  });

  it('storage holds at most 8 hours', async () => {
    const p = await playerWithPlot();
    await rewind(p.id, 50);
    expect((await http().post('/collect').set(p.auth)).body.collected).toBe(16);
  });

  it('collecting twice at the same moment pays once', async () => {
    const p = await playerWithPlot();
    await rewind(p.id, 8);
    const [a, b] = await Promise.all([http().post('/collect').set(p.auth), http().post('/collect').set(p.auth)]);
    expect(a.body.collected + b.body.collected).toBe(16);
    expect(await coins(p.auth)).toBe(1016);
    await ledgerMatches(p.id);
  });

  it('building a house: costs 500, collects first, then earns 96/day', async () => {
    const p = await playerWithPlot();
    await rewind(p.id, 4); // 8 coins waiting at the old rate
    const plot = (await http().get(`/plots/${p.key}`).set(p.auth)).body;
    expect(plot.nextLevel).toEqual({ level: 1, cost: 500, incomePerDay: 96 });

    const res = await http().post(`/plots/${p.key}/upgrade`).set(p.auth).expect(200);
    expect(res.body.wallet.coins).toBe(1000 + 8 - 500);
    expect(res.body.plot).toMatchObject({ buildingLevel: 1, incomePerDay: 96 });
    expect(res.body.plot.nextLevel).toEqual({ level: 2, cost: 2500, incomePerDay: 216 });
    expect(res.body.income.perDay).toBe(96);
    await ledgerMatches(p.id);
  });

  it("can't upgrade without coins, past the tower, or someone else's plot", async () => {
    const p = await playerWithPlot();
    await prisma.plot.update({ where: { row_col: { row: p.row, col: p.col } }, data: { buildingLevel: 1 } });
    const poor = await http().post(`/plots/${p.key}/upgrade`).set(p.auth).expect(400); // office costs 2,500
    expect(poor.body.code).toBe('insufficient_funds');

    await prisma.plot.update({ where: { row_col: { row: p.row, col: p.col } }, data: { buildingLevel: 4 } });
    expect((await http().post(`/plots/${p.key}/upgrade`).set(p.auth).expect(400)).body.code).toBe('max_level');

    const other = await playerWithPlot();
    expect((await http().post(`/plots/${p.key}/upgrade`).set(other.auth).expect(403)).body.code).toBe('not_your_plot');
    expect((await http().post('/plots/1_1/upgrade').set(other.auth).expect(403)).body.code).toBe('not_your_plot');
  });

  it('owning the plot next door adds 5% to both', async () => {
    const p = await playerWithPlot();
    const next = cellKey({ row: p.row, col: p.col + 1 });
    const bought = await http().post(`/plots/${next}/buy`).set(p.auth).expect(201);
    expect(bought.body.plot.neighbours).toBe(1);
    const mine = (await http().get('/me/plots').set(p.auth)).body;
    for (const plot of mine) expect(plot.neighbours).toBe(1);
    const starter = mine.find((x: { key: string }) => x.key === p.key);
    expect(starter.incomePerDay).toBe(50); // 48 × 1.05
  });

  it('buying collects first, so a new plot never earns for the past', async () => {
    const p = await playerWithPlot();
    await rewind(p.id, 8);
    const target = cellKey(cellAt(56.3, 24.3));
    const res = await http().post(`/plots/${target}/buy`).set(p.auth).expect(201);
    expect(res.body.wallet.coins).toBe(1000 + 16 - 158);
    expect(res.body.income.pending).toBe(0);
    await ledgerMatches(p.id);
  });

  it('storage upgrade: 2,000 coins for 12 hours', async () => {
    const p = await playerWithPlot();
    expect((await http().post('/me/storage/upgrade').set(p.auth).expect(400)).body.code).toBe('insufficient_funds');
    await prisma.wallet.update({ where: { userId: p.id }, data: { coins: 3000 } });
    await prisma.transaction.create({ data: { userId: p.id, currency: 'coins', amount: 2000, balanceAfter: 3000, type: 'test_adjust' } });
    const res = await http().post('/me/storage/upgrade').set(p.auth).expect(200);
    expect(res.body.wallet.coins).toBe(1000);
    expect(res.body.income).toMatchObject({ storageLevel: 1, storageHours: 12, nextStorage: { level: 2, hours: 16, cost: 6000 } });
    await rewind(p.id, 50);
    expect((await http().post('/collect').set(p.auth)).body.collected).toBe(24);
    await ledgerMatches(p.id);
  });
});
