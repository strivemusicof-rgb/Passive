import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const DAY = 86_400_000;

describe('cosmetics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let spot = 0;
  const http = () => request(app.getHttpServer());

  async function player(wallet?: { coins?: number; gems?: number }) {
    spot++;
    const res = await http().post('/auth/guest');
    const id = res.body.user.id as string;
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    const claim = await http().post('/plots/starter').set(auth).send({ lat: 52.0 + spot * 0.01, lng: 21.0 });
    if (wallet) {
      const w = await prisma.wallet.update({ where: { userId: id }, data: wallet });
      for (const currency of ['coins', 'gems'] as const) {
        const sum = await prisma.transaction.aggregate({ where: { userId: id, currency }, _sum: { amount: true } });
        const diff = w[currency] - (sum._sum.amount ?? 0);
        if (diff) await prisma.transaction.create({ data: { userId: id, currency, amount: diff, balanceAfter: w[currency], type: 'test_adjust' } });
      }
    }
    return { id, auth, key: claim.body.plot.key as string };
  }

  async function ledgerMatches(userId: string) {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    for (const currency of ['coins', 'gems'] as const) {
      const sum = await prisma.transaction.aggregate({ where: { userId, currency }, _sum: { amount: true } });
      expect(sum._sum.amount ?? 0).toBe(wallet[currency]);
    }
  }

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the catalogue with prices; nothing owned at first', async () => {
    const p = await player();
    const res = (await http().get('/cosmetics').set(p.auth).expect(200)).body;
    expect(res.items.length).toBeGreaterThan(10);
    expect(res.items.find((i: { id: string }) => i.id === 'name_gold')).toMatchObject({ type: 'nameColor', value: '#F6C453', gems: 50, coins: null, owned: false });
    expect(res.equipped).toEqual({ nameColor: null, avatarFrame: null });
  });

  it('buys with gems or coins, once', async () => {
    const p = await player({ coins: 2000, gems: 30 });
    const bought = (await http().post('/cosmetics/name_rose/buy').set(p.auth).expect(200)).body;
    expect(bought.wallet.gems).toBe(10);
    expect(bought.items.find((i: { id: string }) => i.id === 'name_rose').owned).toBe(true);
    expect((await http().post('/cosmetics/name_rose/buy').set(p.auth).expect(409)).body.code).toBe('already_owned');

    expect((await http().post('/cosmetics/flag_lv/buy').set(p.auth).expect(200)).body.wallet.coins).toBe(1000);
    // Not enough gems: nothing is bought or charged.
    expect((await http().post('/cosmetics/name_gold/buy').set(p.auth).expect(400)).body.code).toBe('insufficient_funds');
    expect(await prisma.userCosmetic.count({ where: { userId: p.id, itemId: 'name_gold' } })).toBe(0);
    await http().post('/cosmetics/nope/buy').set(p.auth).expect(404);
    await ledgerMatches(p.id);
  });

  it('equips a name colour and frame; others see them', async () => {
    const p = await player({ gems: 200 });
    await http().post('/me/style').set(p.auth).send({ nameColor: 'name_gold' }).expect(403); // not owned yet
    await http().post('/cosmetics/name_gold/buy').set(p.auth).expect(200);
    await http().post('/cosmetics/frame_royal/buy').set(p.auth).expect(200);
    const me = (await http().post('/me/style').set(p.auth).send({ nameColor: 'name_gold', avatarFrame: 'frame_royal' }).expect(200)).body;
    expect(me.style).toEqual({ nameColor: '#F6C453', frame: { color: '#A78BFA', accent: '#F6C453' } });
    // A frame id can't be used as a name colour.
    await http().post('/me/style').set(p.auth).send({ nameColor: 'frame_royal' }).expect(400);

    const viewer = await player();
    const plot = (await http().get(`/plots/${p.key}`).set(viewer.auth).expect(200)).body;
    expect(plot.owner.style.nameColor).toBe('#F6C453');

    const off = (await http().post('/me/style').set(p.auth).send({ nameColor: null }).expect(200)).body;
    expect(off.style).toEqual({ nameColor: null, frame: { color: '#A78BFA', accent: '#F6C453' } });
  });

  it('puts a skin and flag on your own plot; selling clears them', async () => {
    const p = await player({ coins: 10000 });
    await http().post('/cosmetics/skin_ice/buy').set(p.auth).expect(200);
    await http().post('/cosmetics/flag_ee/buy').set(p.auth).expect(200);
    const plot = (await http().post(`/plots/${p.key}/style`).set(p.auth).send({ skin: 'skin_ice', flag: 'flag_ee' }).expect(200)).body;
    expect(plot.skin).toEqual({ id: 'skin_ice', color: '#7DD3FC' });
    expect(plot.flag).toEqual({ id: 'flag_ee', emoji: '🇪🇪' });

    const other = await player({ coins: 10000 });
    await http().post(`/plots/${p.key}/style`).set(other.auth).send({ flag: null }).expect(403);

    // Sell it: the buyer gets plain land.
    await prisma.user.update({ where: { id: p.id }, data: { createdAt: new Date(Date.now() - 10 * DAY) } });
    const listing = (await http().post(`/plots/${p.key}/list`).set(p.auth).send({ price: 500 }).expect(200)).body;
    const bought = (await http().post(`/market/${listing.id}/buy`).set(other.auth).expect(200)).body;
    expect(bought.plot).toMatchObject({ skin: null, flag: null });
  });
});
