import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './helpers.js';

describe('accounts (e2e)', () => {
  let app: INestApplication;
  let signApple: (sub: string, aud?: string) => Promise<string>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, signApple } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('guest: sign up, read and edit profile', async () => {
    const res = await http().post('/auth/guest').expect(201);
    expect(res.body.user).toMatchObject({ isGuest: true, level: 1, hasApple: false });
    expect(res.body.user.displayName).toMatch(/^Player\d{6}$/);
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };

    await http().get('/me').set(auth).expect(200);
    const patched = await http().patch('/me').set(auth).send({ displayName: 'RigaRuler', language: 'ru' }).expect(200);
    expect(patched.body).toMatchObject({ displayName: 'RigaRuler', language: 'ru' });
    await http().patch('/me').set(auth).send({ displayName: 'no spaces allowed' }).expect(400);
  });

  it('display names are unique regardless of case', async () => {
    const a = await http().post('/auth/guest');
    const b = await http().post('/auth/guest');
    await http().patch('/me').set({ Authorization: `Bearer ${a.body.accessToken}` }).send({ displayName: 'LandKing' }).expect(200);
    const res = await http().patch('/me').set({ Authorization: `Bearer ${b.body.accessToken}` }).send({ displayName: 'landking' }).expect(409);
    expect(res.body.code).toBe('name_taken');
  });

  it('rejects missing or forged access tokens', async () => {
    await http().get('/me').expect(401);
    await http().get('/me').set({ Authorization: 'Bearer not.a.jwt' }).expect(401);
  });

  it('refresh tokens rotate: the old one stops working', async () => {
    const first = await http().post('/auth/guest');
    const second = await http().post('/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(200);
    expect(second.body.refreshToken).not.toBe(first.body.refreshToken);
    const reused = await http().post('/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(401);
    expect(reused.body.code).toBe('invalid_refresh_token');
    await http().post('/auth/refresh').send({ refreshToken: second.body.refreshToken }).expect(200);
  });

  it('logout ends the session', async () => {
    const res = await http().post('/auth/guest');
    await http().post('/auth/logout').send({ refreshToken: res.body.refreshToken }).expect(204);
    await http().post('/auth/refresh').send({ refreshToken: res.body.refreshToken }).expect(401);
  });

  it('email: register, log in, wrong password, duplicate email', async () => {
    const reg = await http().post('/auth/email/register').send({ email: 'Anna@Example.com', password: 'secret123' }).expect(201);
    expect(reg.body.user).toMatchObject({ isGuest: false, hasEmail: true });

    await http().post('/auth/email/login').send({ email: 'anna@example.com', password: 'secret123' }).expect(200);
    const bad = await http().post('/auth/email/login').send({ email: 'anna@example.com', password: 'wrongpass' }).expect(401);
    expect(bad.body.code).toBe('invalid_credentials');
    const dup = await http().post('/auth/email/register').send({ email: 'anna@example.com', password: 'another1' }).expect(409);
    expect(dup.body.code).toBe('email_taken');
    await http().post('/auth/email/register').send({ email: 'not-an-email', password: 'secret123' }).expect(400);
    await http().post('/auth/email/register').send({ email: 'short@example.com', password: '123' }).expect(400);
  });

  it('a guest who registers with email keeps the same account', async () => {
    const guest = await http().post('/auth/guest');
    const reg = await http()
      .post('/auth/email/register')
      .set({ Authorization: `Bearer ${guest.body.accessToken}` })
      .send({ email: 'upgrade@example.com', password: 'secret123' })
      .expect(201);
    expect(reg.body.user.id).toBe(guest.body.user.id);
    expect(reg.body.user.isGuest).toBe(false);
  });

  it('Sign in with Apple: new account, then same account again', async () => {
    const token = await signApple('apple-user-1');
    const first = await http().post('/auth/apple').send({ identityToken: token }).expect(201);
    expect(first.body.user).toMatchObject({ hasApple: true, isGuest: false });
    const again = await http().post('/auth/apple').send({ identityToken: await signApple('apple-user-1') }).expect(201);
    expect(again.body.user.id).toBe(first.body.user.id);
  });

  it('Sign in with Apple upgrades the current guest', async () => {
    const guest = await http().post('/auth/guest');
    const res = await http()
      .post('/auth/apple')
      .set({ Authorization: `Bearer ${guest.body.accessToken}` })
      .send({ identityToken: await signApple('apple-user-2') })
      .expect(201);
    expect(res.body.user.id).toBe(guest.body.user.id);
    expect(res.body.user.hasApple).toBe(true);
  });

  it('rejects Apple tokens issued for another app', async () => {
    const res = await http()
      .post('/auth/apple')
      .send({ identityToken: await signApple('apple-user-3', 'com.someone.else') })
      .expect(401);
    expect(res.body.code).toBe('invalid_apple_token');
  });

  it('deleting the account removes it and its sessions', async () => {
    const res = await http().post('/auth/guest');
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    await http().delete('/me').set(auth).expect(204);
    await http().get('/me').set(auth).expect(401);
    await http().post('/auth/refresh').send({ refreshToken: res.body.refreshToken }).expect(401);
  });
});
