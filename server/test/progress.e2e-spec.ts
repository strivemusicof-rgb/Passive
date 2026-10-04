import { INestApplication } from '@nestjs/common';
import { cellAt, cellCenter, cellKey } from '@landrush/shared/grid';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { gameDay, previousDay } from '../src/progress/periods.js';
import { createTestApp } from './helpers.js';

describe('missions, daily reward, XP & check-in (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let spot = 0;
  const http = () => request(app.getHttpServer());

  async function player() {
    const res = await http().post('/auth/guest');
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    spot++;
    const at = { lat: 55.9 + spot * 0.01, lng: 23.5 };
    const claim = await http().post('/plots/starter').set(auth).send(at);
    return { id: res.body.user.id as string, auth, key: claim.body.plot.key as string };
  }

  const mission = (list: { key: string }[], key: string) => list.find((m) => m.key === key) as Record<string, unknown>;

  async function ledgerMatches(userId: string) {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    for (const currency of ['coins', 'gems'] as const) {
      const sum = await prisma.transaction.aggregate({ where: { userId, currency }, _sum: { amount: true } });
      expect(sum._sum.amount).toBe(wallet[currency]);
    }
  }

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('buying a plot completes the daily mission, claim pays once', async () => {
    const p = await player();
    let missions = (await http().get('/missions').set(p.auth).expect(200)).body;
    expect(mission(missions.daily, 'buyPlot')).toMatchObject({ progress: 0, target: 1, claimed: false });
    expect((await http().post('/missions/daily/buyPlot/claim').set(p.auth).expect(400)).body.code).toBe('not_complete');

    const target = cellKey(cellAt(55.0 + spot * 0.01, 22.0));
    await http().post(`/plots/${target}/buy`).set(p.auth).expect(201);
    missions = (await http().get('/missions').set(p.auth)).body;
    expect(mission(missions.daily, 'buyPlot')).toMatchObject({ progress: 1, claimed: false });
    expect(mission(missions.weekly, 'buyPlot3')).toMatchObject({ progress: 1, target: 3 });

    const [a, b] = await Promise.all([
      http().post('/missions/daily/buyPlot/claim').set(p.auth),
      http().post('/missions/daily/buyPlot/claim').set(p.auth),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
    const ok = a.status === 200 ? a : b;
    expect(ok.body).toMatchObject({ coins: 100, xp: 20 });
    expect(ok.body.wallet.coins).toBe(1000 - 158 + 100);
    expect(ok.body.user.xp).toBe(10 + 20); // 10 for buying + 20 for the mission
    await ledgerMatches(p.id);
  });

  it('daily reward: once a day, streak grows on consecutive days and resets after a gap', async () => {
    const p = await player();
    let daily = (await http().get('/daily').set(p.auth).expect(200)).body;
    expect(daily).toMatchObject({ nextDay: 1, claimedToday: false, streakDay: 0 });
    expect(daily.rewards).toHaveLength(7);

    const first = (await http().post('/daily/claim').set(p.auth).expect(200)).body;
    expect(first).toMatchObject({ coins: 100, daily: { claimedToday: true, streakDay: 1 } });
    expect((await http().post('/daily/claim').set(p.auth).expect(409)).body.code).toBe('already_claimed');
    // Claiming also completes the "log in" mission.
    expect(mission((await http().get('/missions').set(p.auth)).body.daily, 'login')).toMatchObject({ progress: 1 });

    // Pretend day 2 was claimed yesterday → today is day 3 (5 gems).
    const today = gameDay(new Date());
    await prisma.user.update({ where: { id: p.id }, data: { streakDay: 2, lastDailyClaim: previousDay(today) } });
    daily = (await http().get('/daily').set(p.auth)).body;
    expect(daily.nextDay).toBe(3);
    const third = (await http().post('/daily/claim').set(p.auth).expect(200)).body;
    expect(third).toMatchObject({ coins: 0, gems: 5 });

    // A missed day starts over.
    await prisma.user.update({ where: { id: p.id }, data: { streakDay: 5, lastDailyClaim: previousDay(previousDay(today)) } });
    expect((await http().get('/daily').set(p.auth)).body.nextDay).toBe(1);
    await ledgerMatches(p.id);
  });

  it('XP levels you up and pays 5 gems per level', async () => {
    const p = await player();
    await prisma.user.update({ where: { id: p.id }, data: { xp: 95 } });
    const res = (await http().post('/daily/claim').set(p.auth).expect(200)).body; // +5 XP → 100 = level 2
    expect(res.leveledUp).toBe(true);
    expect(res.user).toMatchObject({ level: 2, xp: 100, levelXp: { current: 0, needed: 200 } });
    expect(res.gems).toBe(5);
    expect(res.wallet.gems).toBe(20 + 5);
    await ledgerMatches(p.id);
  });

  it('check-in: only near your own plot, once per plot per day', async () => {
    const p = await player();
    const [row, col] = p.key.split('_').map(Number);
    const centre = cellCenter({ row, col });
    const far = { lat: centre.lat + 0.01, lng: centre.lng };
    expect((await http().post(`/plots/${p.key}/checkin`).set(p.auth).send(far).expect(400)).body.code).toBe('too_far');

    const res = (await http().post(`/plots/${p.key}/checkin`).set(p.auth).send(centre).expect(200)).body;
    const plot = (await http().get(`/plots/${p.key}`).set(p.auth)).body;
    expect(res.coins).toBe(Math.round(plot.incomePerDay * 0.25));
    expect(res.xp).toBe(15);
    expect((await http().post(`/plots/${p.key}/checkin`).set(p.auth).send(centre).expect(409)).body.code).toBe('already_checked_in');
    expect(mission((await http().get('/missions').set(p.auth)).body.daily, 'checkIn')).toMatchObject({ progress: 1 });

    const other = await player();
    expect((await http().post(`/plots/${p.key}/checkin`).set(other.auth).send(centre).expect(403)).body.code).toBe('not_your_plot');
    await ledgerMatches(p.id);
  });

  it('collecting counts only when something was collected', async () => {
    const p = await player();
    await http().post('/collect').set(p.auth).expect(200); // nothing waiting yet
    expect(mission((await http().get('/missions').set(p.auth)).body.daily, 'collect')).toMatchObject({ progress: 0 });
    await prisma.plot.updateMany({ where: { ownerId: p.id }, data: { collectedAt: new Date(Date.now() - 3 * 3_600_000) } });
    await http().post('/collect').set(p.auth).expect(200);
    const missions = (await http().get('/missions').set(p.auth)).body;
    expect(mission(missions.daily, 'collect')).toMatchObject({ progress: 1 });
    expect(mission(missions.weekly, 'collect10')).toMatchObject({ progress: 1, target: 10 });
  });

  it('achievements reflect what the player has done', async () => {
    const p = await player();
    const list = (await http().get('/me/achievements').set(p.auth).expect(200)).body;
    const find = (key: string) => list.find((a: { key: string }) => a.key === key);
    expect(find('firstPlot')).toMatchObject({ unlocked: true });
    expect(find('plots10')).toMatchObject({ unlocked: false, progress: 1, target: 10 });
    expect(find('firstTower')).toMatchObject({ unlocked: false });
  });
});
