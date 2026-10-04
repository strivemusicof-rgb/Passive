import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { LeaderboardService } from '../src/leaderboard/leaderboard.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { gameMonth } from '../src/progress/periods.js';
import { createTestApp } from './helpers.js';

const HOUR = 3600_000;

describe('leaderboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  async function player(lat: number, lng = 25.5) {
    const res = await http().post('/auth/guest');
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    await http().post('/plots/starter').set(auth).send({ lat, lng }).expect(201);
    return { id: res.body.user.id as string, auth, name: res.body.user.displayName as string };
  }

  const board = async (auth: Record<string, string>, scope: string) => {
    app.get(LeaderboardService).invalidate();
    return (await http().get(`/leaderboard?scope=${scope}`).set(auth).expect(200)).body;
  };

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('ranks land income, near you, and coins collected this month', async () => {
    const rich = await player(54.0);
    const mid = await player(54.01);
    const far = await player(58.0);
    await prisma.plot.updateMany({ where: { ownerId: rich.id }, data: { rarity: 'legendary', buildingLevel: 2 } });
    await prisma.plot.updateMany({ where: { ownerId: mid.id }, data: { rarity: 'rare', buildingLevel: 0 } });
    await prisma.plot.updateMany({ where: { ownerId: far.id }, data: { rarity: 'epic', buildingLevel: 0 } });

    const all = await board(mid.auth, 'all');
    const order = all.entries.map((e: { userId: string }) => e.userId);
    expect(order.indexOf(rich.id)).toBeLessThan(order.indexOf(far.id));
    expect(order.indexOf(far.id)).toBeLessThan(order.indexOf(mid.id));
    // legendary 360 + office 168 = 528/day = 22/h
    expect(all.entries.find((e: { userId: string }) => e.userId === rich.id)).toMatchObject({ plots: 1, incomePerHour: 22, displayName: rich.name });
    expect(all.me.userId).toBe(mid.id);
    expect(all.monthlyPrizeGems[0]).toBe(100);

    const near = await board(mid.auth, 'near');
    const nearIds = near.entries.map((e: { userId: string }) => e.userId);
    expect(nearIds).toContain(rich.id);
    expect(nearIds).not.toContain(far.id);

    // Collect: mid collects more this month than rich.
    await prisma.plot.updateMany({ where: { ownerId: { in: [rich.id, mid.id] } }, data: { collectedAt: new Date(Date.now() - 2 * HOUR) } });
    await prisma.plot.updateMany({ where: { ownerId: mid.id }, data: { buildingLevel: 4 } });
    await http().post('/collect').set(rich.auth).expect(200);
    await http().post('/collect').set(mid.auth).expect(200);
    const month = await board(far.auth, 'month');
    expect(month.entries.map((e: { userId: string }) => e.userId).slice(0, 2)).toEqual([mid.id, rich.id]);
    expect(month.entries[0].score).toBeGreaterThan(0);
    expect(month.me).toBeNull(); // far collected nothing
  });

  it('pays last month’s prizes once', async () => {
    await prisma.leaderboardPrize.deleteMany();
    const a = await player(53.0);
    const b = await player(53.01);
    const lastMonth = new Date(gameMonth(new Date()).start.getTime() - 5 * 24 * HOUR);
    for (const [p, coins] of [[a, 900], [b, 400]] as const) {
      await prisma.transaction.create({ data: { userId: p.id, currency: 'coins', amount: coins, balanceAfter: coins, type: 'collect', createdAt: lastMonth } });
    }
    const gemsBefore = async (id: string) => (await prisma.wallet.findUniqueOrThrow({ where: { userId: id } })).gems;
    const [ga, gb] = [await gemsBefore(a.id), await gemsBefore(b.id)];

    // Two players open the board at the same moment: still paid once.
    app.get(LeaderboardService).invalidate();
    await Promise.all([http().get('/leaderboard?scope=month').set(a.auth), http().get('/leaderboard?scope=month').set(b.auth)]);
    const res = await board(a.auth, 'month');

    expect(res.lastWinners.slice(0, 2)).toEqual([
      { rank: 1, displayName: a.name, gems: 100 },
      { rank: 2, displayName: b.name, gems: 60 },
    ]);
    expect(await gemsBefore(a.id)).toBe(ga + 100);
    expect(await gemsBefore(b.id)).toBe(gb + 60);
    expect(await prisma.transaction.count({ where: { userId: a.id, type: 'leaderboard_prize' } })).toBe(1);
  });
});
