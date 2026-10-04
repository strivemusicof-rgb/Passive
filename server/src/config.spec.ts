import { z } from 'zod';

describe('env()', () => {
  it('rejects a missing DATABASE_URL', async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    vi.resetModules();
    vi.spyOn(process, 'loadEnvFile').mockImplementation(() => {});
    const { env } = await import('./config.js');
    expect(() => env()).toThrow(z.ZodError);
    process.env.DATABASE_URL = saved;
  });
});
