import { INestApplication } from '@nestjs/common';
import { cellCenter } from '@landrush/shared/grid';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const ADMIN = 'test-admin-token-0123456789abcdef0123456789';

describe('reward points & cash-out (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let spot = 0;
  const http = () => request(app.getHttpServer());
  const admin = { 'x-admin-token': ADMIN };

  /** An email account (cash-out needs a real account) with a starter plot. */
  async function player(email?: string) {
    spot++;
    const res = email
      ? await http().post('/auth/email/register').send({ email, password: 'secret123' })
      : await http().post('/auth/guest');
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    const claim = await http().post('/plots/starter').set(auth).send({ lat: 55.3 + spot * 0.01, lng: 26.0 });
    return { id: res.body.user.id as string, auth, key: claim.body.plot.key as string };
  }

  const atPlot = (key: string) => {
    const [row, col] = key.split('_').map(Number);
    return cellCenter({ row, col });
  };

  async function givePoints(userId: string, points: number) {
    const w = await prisma.wallet.update({ where: { userId }, data: { points: { increment: points } } });
    await prisma.transaction.create({ data: { userId, currency: 'points', amount: points, balanceAfter: w.points, type: 'test_adjust' } });
  }

  async function pointsLedgerMatches(userId: string) {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const sum = await prisma.transaction.aggregate({ where: { userId, currency: 'points' }, _sum: { amount: true } });
    expect(sum._sum.amount ?? 0).toBe(wallet.points);
  }

  beforeAll(async () => {
    process.env.ADMIN_TOKEN = ADMIN;
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('is off by default: no points, no cash-out', async () => {
    const p = await player();
    const r = (await http().get('/rewards').set(p.auth).expect(200)).body;
    expect(r).toMatchObject({ enabled: false, points: 0, cashoutBlocked: 'rewards_disabled', pointsPerEuro: 1000, minCashoutPoints: 5000 });
    const res = (await http().post(`/plots/${p.key}/checkin`).set(p.auth).send(atPlot(p.key)).expect(200)).body;
    expect(res.points).toBe(0);
  });

  it('admin API needs the right token', async () => {
    await http().get('/admin/api/cashouts').expect(403);
    await http().get('/admin/api/cashouts').set({ 'x-admin-token': 'wrong' }).expect(403);
    await http().get('/admin/api/cashouts').set(admin).expect(200);
    const page = await http().get('/admin').expect(200);
    expect(page.text).toContain('LANDRUSH Admin');
  });

  it('when switched on: check-ins give points, up to the daily cap', async () => {
    await http().post('/admin/api/rewards-enabled').set(admin).send({ enabled: true }).expect(200);
    const p = await player();
    const res = (await http().post(`/plots/${p.key}/checkin`).set(p.auth).send(atPlot(p.key)).expect(200)).body;
    expect(res.points).toBe(5);
    expect(res.wallet.points).toBe(5);

    // 147 earned today → only 3 left under the 150 cap.
    const w = await prisma.wallet.update({ where: { userId: p.id }, data: { points: { increment: 142 } } });
    await prisma.transaction.create({ data: { userId: p.id, currency: 'points', amount: 142, balanceAfter: w.points, type: 'points_check_in' } });
    const second = await player();
    await prisma.plot.update({ where: { row_col: { row: Number(second.key.split('_')[0]), col: Number(second.key.split('_')[1]) } }, data: { ownerId: p.id } });
    const capped = (await http().post(`/plots/${second.key}/checkin`).set(p.auth).send(atPlot(second.key)).expect(200)).body;
    expect(capped.points).toBe(3);
    expect((await http().get('/rewards').set(p.auth)).body).toMatchObject({ todayEarned: 150, dailyCap: 150 });
    await pointsLedgerMatches(p.id);
  });

  it('collecting land income turns into ⭐: 1 per 50 coins, max 60 a day from land', async () => {
    const p = await player();
    await prisma.plot.updateMany({ where: { ownerId: p.id }, data: { buildingLevel: 4, collectedAt: new Date(Date.now() - 8 * 3_600_000) } });
    // A tower: ~1,500 coins/day → 8 h ≈ 500 coins → ~10 ⭐.
    const first = (await http().post('/collect').set(p.auth).expect(200)).body;
    expect(first.points).toBe(Math.floor(first.collected / 50));
    expect(first.wallet.points).toBe(first.points);

    // Pretend 58 land ⭐ were already earned today: only 2 more allowed.
    const w = await prisma.wallet.update({ where: { userId: p.id }, data: { points: { increment: 58 - first.points } } });
    await prisma.transaction.create({ data: { userId: p.id, currency: 'points', amount: 58 - first.points, balanceAfter: w.points, type: 'points_land' } });
    await prisma.plot.updateMany({ where: { ownerId: p.id }, data: { collectedAt: new Date(Date.now() - 8 * 3_600_000) } });
    const second = (await http().post('/collect').set(p.auth).expect(200)).body;
    expect(second.points).toBe(2);
    expect((await http().get('/rewards').set(p.auth)).body).toMatchObject({ todayLand: 60 });
    await pointsLedgerMatches(p.id);
  });

  it('cash-out rules: real account, 7 days old, at least 5,000 points, one at a time', async () => {
    const guest = await player();
    await givePoints(guest.id, 6000);
    expect((await http().post('/rewards/cashout').set(guest.auth).send({ method: 'paypal', destination: 'g@example.com' }).expect(400)).body.code).toBe('guest_cannot_cashout');

    const p = await player('cash@example.com');
    expect((await http().post('/rewards/cashout').set(p.auth).send({ method: 'paypal', destination: 'cash@example.com' }).expect(400)).body.code).toBe('account_too_new');
    await prisma.user.update({ where: { id: p.id }, data: { createdAt: new Date(Date.now() - 8 * 86_400_000) } });
    expect((await http().post('/rewards/cashout').set(p.auth).send({ method: 'paypal', destination: 'cash@example.com' }).expect(400)).body.code).toBe('not_enough_points');
    await http().post('/rewards/cashout').set(p.auth).send({ method: 'bitcoin', destination: 'cash@example.com' }).expect(400);
    await http().post('/rewards/cashout').set(p.auth).send({ method: 'paypal', destination: 'not-an-email' }).expect(400);

    await givePoints(p.id, 5300);
    const r = (await http().post('/rewards/cashout').set(p.auth).send({ method: 'paypal', destination: 'Cash@Example.com' }).expect(200)).body;
    expect(r.points).toBe(300); // 5,000 held, 300 stay
    expect(r.requests[0]).toMatchObject({ points: 5000, eurCents: 500, status: 'pending', destination: 'cash@example.com' });
    expect(r.cashoutBlocked).toBe('cashout_pending');
    await givePoints(p.id, 5000);
    expect((await http().post('/rewards/cashout').set(p.auth).send({ method: 'paypal', destination: 'cash@example.com' }).expect(409)).body.code).toBe('cashout_pending');
    await pointsLedgerMatches(p.id);
  });

  it('admin: reject returns the points; approve then mark paid; flags shared payout addresses', async () => {
    const p = await player('payme@example.com');
    await prisma.user.update({ where: { id: p.id }, data: { createdAt: new Date(Date.now() - 30 * 86_400_000) } });
    await givePoints(p.id, 7000);
    await http().post('/rewards/cashout').set(p.auth).send({ method: 'paypal', destination: 'shared@example.com' }).expect(200);

    let list = (await http().get('/admin/api/cashouts?status=pending').set(admin).expect(200)).body;
    let req = list.find((x: { user: { id: string } }) => x.user.id === p.id);
    expect(req).toMatchObject({ points: 7000, eurCents: 700, user: { signIn: 'email', plots: 1 } });

    await http().post(`/admin/api/cashouts/${req.id}/reject`).set(admin).send({ note: 'Please use your own PayPal' }).expect(200);
    expect((await http().get('/rewards').set(p.auth)).body).toMatchObject({ points: 7000, requests: [{ status: 'rejected', note: 'Please use your own PayPal' }] });
    await http().post(`/admin/api/cashouts/${req.id}/approve`).set(admin).expect(409);

    // A second account asking to pay the same address gets flagged.
    const other = await player('other@example.com');
    await prisma.user.update({ where: { id: other.id }, data: { createdAt: new Date(Date.now() - 30 * 86_400_000) } });
    await givePoints(other.id, 5000);
    await http().post('/rewards/cashout').set(other.auth).send({ method: 'paypal', destination: 'shared@example.com' }).expect(200);
    list = (await http().get('/admin/api/cashouts?status=pending').set(admin)).body;
    req = list.find((x: { user: { id: string } }) => x.user.id === other.id);
    expect(req.flags.join(' ')).toContain('Same payout address used by 1 other account');

    await http().post(`/admin/api/cashouts/${req.id}/paid`).set(admin).expect(409); // must approve first
    await http().post(`/admin/api/cashouts/${req.id}/approve`).set(admin).expect(200);
    await http().post(`/admin/api/cashouts/${req.id}/paid`).set(admin).expect(200);
    expect((await http().get('/rewards').set(other.auth)).body.requests[0].status).toBe('paid');
    await pointsLedgerMatches(p.id);
    await pointsLedgerMatches(other.id);
  });
});
