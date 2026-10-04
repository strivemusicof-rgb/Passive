// App Shipper: a tiny local web app that ships Expo apps to TestFlight.
//
// Runs only on this computer (127.0.0.1). Every request must carry the
// random session token from the address Ship.cmd opens, so other websites
// open in the browser can't trigger commands.
//
// No dependencies: Node.js built-ins only.

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, platform } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const IS_WINDOWS = platform() === 'win32';
const TOKEN = randomBytes(24).toString('hex');
const FIRST_PORT = Number(process.env.SHIPPER_PORT ?? 4545);
const CONFIG_DIR = process.env.SHIPPER_CONFIG_DIR ?? join(process.env.APPDATA ?? join(homedir(), '.config'), 'AppShipper');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const EAS = 'npx --yes eas-cli@latest';

// ---------------------------------------------------------------- config

/** @typedef {{ id: string, name: string, folder: string, appDir: string, gitUrl: string, branch: string, profile: string }} App */
/** @typedef {{ expoToken: string, ascKeyPath: string, ascKeyId: string, ascIssuerId: string, appleTeamId: string, skipCapabilitySync: boolean }} Settings */

function loadConfig() {
  try {
    const c = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    return { settings: { ...emptySettings(), ...c.settings }, apps: Array.isArray(c.apps) ? c.apps : [] };
  } catch {
    return { settings: emptySettings(), apps: [] };
  }
}

function emptySettings() {
  // Capability sync through an API key often fails at Apple (e.g. turning Push
  // Notifications off), so it's skipped by default; capabilities are then
  // ticked once by hand in the Apple developer website.
  return { expoToken: '', ascKeyPath: '', ascKeyId: '', ascIssuerId: '', appleTeamId: '', skipCapabilitySync: true };
}

let config = loadConfig();

function saveConfig() {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

const mask = (s) => (s ? `••••${s.slice(-4)}` : '');

function publicConfig() {
  const s = config.settings;
  return {
    settings: { ...s, expoToken: mask(s.expoToken), hasExpoToken: !!s.expoToken },
    apps: config.apps.map((a) => ({ ...a, ...appInfo(a) })),
    configFile: CONFIG_FILE,
  };
}

/** What we can tell about an app folder without running anything. */
function appInfo(app) {
  const appPath = join(app.folder, app.appDir);
  const info = { exists: existsSync(appPath), bundleId: '', projectId: '', version: '', packageManager: '' };
  try {
    const json = JSON.parse(readFileSync(join(appPath, 'app.json'), 'utf8'));
    const expo = json.expo ?? json;
    info.bundleId = expo.ios?.bundleIdentifier ?? '';
    info.projectId = expo.extra?.eas?.projectId ?? '';
    info.version = expo.version ?? '';
  } catch {}
  info.packageManager = detectPackageManager(app.folder, appPath);
  return info;
}

function detectPackageManager(root, appPath) {
  for (const dir of [appPath, root]) {
    if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
    if (existsSync(join(dir, 'bun.lock')) || existsSync(join(dir, 'bun.lockb'))) return 'bun';
    if (existsSync(join(dir, 'package-lock.json'))) return 'npm';
  }
  return 'npm';
}

/** Finds the folder holding app.json: the root, app/, apps/<x>/ or any first-level folder. */
function findAppDir(folder) {
  if (existsSync(join(folder, 'app.json'))) return '.';
  const candidates = ['app', 'mobile', 'expo'];
  for (const c of candidates) if (existsSync(join(folder, c, 'app.json'))) return c;
  for (const parent of ['apps', 'packages', '.']) {
    const base = join(folder, parent);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const dir = join(base, name);
      if (statSync(dir).isDirectory() && existsSync(join(dir, 'app.json'))) return parent === '.' ? name : `${parent}/${name}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------- jobs

/** @type {Map<string, any>} */
const jobs = new Map();
const clients = new Set();

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) res.write(data);
}

function jobSummary(job) {
  const { lines, child, ...rest } = job;
  return rest;
}

function newJob(app, kind) {
  const job = {
    id: randomUUID(),
    appId: app?.id ?? null,
    appName: app?.name ?? '',
    kind,
    status: 'running',
    step: '',
    startedAt: new Date().toISOString(),
    endedAt: null,
    links: [],
    hint: '',
    lines: [],
    child: null,
  };
  jobs.set(job.id, job);
  // Keep the 30 most recent jobs.
  while (jobs.size > 30) jobs.delete(jobs.keys().next().value);
  broadcast({ type: 'job', job: jobSummary(job) });
  return job;
}

function log(job, line) {
  const clean = line.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '');
  if (!clean.trim()) return;
  job.lines.push(clean);
  if (job.lines.length > 4000) job.lines.splice(0, job.lines.length - 4000);
  for (const url of clean.match(/https:\/\/(?:expo\.dev|appstoreconnect\.apple\.com)\/[^\s)'"]+/g) ?? []) {
    if (!job.links.includes(url)) {
      job.links.push(url);
      broadcast({ type: 'job', job: jobSummary(job) });
    }
  }
  const hint = hintFor(clean);
  if (hint && !job.hint) {
    job.hint = hint;
    broadcast({ type: 'job', job: jobSummary(job) });
  }
  broadcast({ type: 'log', jobId: job.id, line: clean });
}

function finish(job, status) {
  job.status = status;
  job.step = '';
  job.endedAt = new Date().toISOString();
  job.child = null;
  broadcast({ type: 'job', job: jobSummary(job) });
}

/** Plain-language advice for common failures. */
function hintFor(line) {
  const rules = [
    [/Only user authentication is supported|Ensuring your app exists on App Store Connect|ascAppId/i, 'Create the app once in App Store Connect (Apps → + → New App, same bundle ID), then add its Apple ID number as "ascAppId" under submit → production → ios in the app\'s eas.json. After that, uploads never ask for a login.'],
    [/not logged in|not authenticated|login required|EXPO_TOKEN.*(invalid|expired)|Unauthorized.*expo/i, 'Expo doesn\'t know who you are: add your Expo access token in Settings (expo.dev → Account settings → Access tokens).'],
    [/ENOENT.*\.p8|\.p8.*(no such file|not found)/i, 'The Apple key file wasn\'t found: check the key file path in Settings.'],
    [/ascAppId|couldn't find.*app.*App Store Connect|app.*does not exist.*App Store Connect|No apps found|Could not find.*application/i, 'Create this app in App Store Connect first (My Apps → + → New App, with the same bundle ID), then ship again.'],
    [/(credentials|certificate|provisioning profile).*(non-interactive|missing|not (set|configured))|non-interactive.*(credentials|certificate)/i, 'This app needs a one-time Apple setup: click "Open interactive window" on its card and answer the questions once.'],
    [/Could not read package\.json|no such file.*package\.json/i, 'No package.json in this folder: edit the app and choose the project folder (the one with package.json).'],
    [/is not recognized as an internal or external command|command not found/i, 'A required tool is missing: click "Check tools" in Settings.'],
    [/Failed to (patch|sync|update).*capabilit/i, 'Apple refused the automatic capability change. Turn on "Skip Apple capability sync" in Settings, tick the capabilities your app needs (e.g. Sign In with Apple) in the Apple developer website, then ship again.'],
    [/Invalid (App Store Connect )?API key|401.*appstoreconnect|key.*revoked/i, 'Apple rejected the key: check Key ID, Issuer ID and key file in Settings (or create a new key).'],
    [/project.*not found|Experience.*does not exist|projectId.*mismatch/i, 'Expo project link problem: open the interactive window and run the build once there.'],
  ];
  for (const [re, text] of rules) if (re.test(line)) return text;
  return '';
}

/** Environment for EAS: Expo token and Apple key, so nothing asks for passwords. */
function easEnv() {
  const s = config.settings;
  const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };
  if (s.expoToken) env.EXPO_TOKEN = s.expoToken;
  if (s.ascKeyPath && s.ascKeyId && s.ascIssuerId) {
    env.EXPO_ASC_API_KEY_PATH = s.ascKeyPath;
    env.EXPO_ASC_KEY_ID = s.ascKeyId;
    env.EXPO_ASC_ISSUER_ID = s.ascIssuerId;
  }
  if (s.appleTeamId) env.EXPO_APPLE_TEAM_ID = s.appleTeamId;
  if (s.skipCapabilitySync) env.EXPO_NO_CAPABILITY_SYNC = '1';
  return env;
}

/** Quotes a path for the shell; refuses characters that could break out of quotes. */
function q(value) {
  if (/["\r\n%`$]/.test(value)) throw new Error(`Unsupported character in "${value}"`);
  return `"${value}"`;
}

function run(job, label, command, cwd, env = process.env) {
  return new Promise((resolvePromise) => {
    job.step = label;
    broadcast({ type: 'job', job: jobSummary(job) });
    log(job, `▶ ${label}`);
    log(job, `$ ${command.replace(/EXPO_TOKEN=\S+/g, 'EXPO_TOKEN=****')}`);
    const child = spawn(command, { cwd, env, shell: true, windowsHide: true });
    job.child = child;
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk.toString();
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) log(job, line);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => log(job, `Could not start: ${e.message}`));
    child.on('close', (code) => {
      if (buffer) log(job, buffer);
      job.child = null;
      resolvePromise(code ?? 1);
    });
  });
}

async function ship(app, { wait }) {
  const job = newJob(app, 'ship');
  const appPath = join(app.folder, app.appDir);
  try {
    if (!existsSync(join(appPath, 'app.json')) && !existsSync(join(appPath, 'app.config.js')) && !existsSync(join(appPath, 'app.config.ts'))) {
      log(job, `No app.json found in ${appPath}.`);
      job.hint = 'The app folder is wrong: edit the app and pick the folder that contains app.json.';
      return finish(job, 'failed');
    }
    if (!config.settings.expoToken) log(job, 'Note: no Expo access token in Settings; using the account you logged in with on this PC (if any).');

    if (existsSync(join(app.folder, '.git'))) {
      const branch = app.branch ? ` ${q(app.branch)}` : '';
      const code = await run(job, 'Getting the latest code', `git pull --ff-only origin${branch}`, app.folder);
      if (code !== 0) {
        job.hint ||= 'Could not update the code from GitHub. If you changed files in this folder, the update may conflict.';
        return finish(job, 'failed');
      }
    }

    const pm = detectPackageManager(app.folder, appPath);
    const installCwd = existsSync(join(appPath, `${pm === 'npm' ? 'package-lock.json' : pm === 'pnpm' ? 'pnpm-lock.yaml' : 'yarn.lock'}`)) ? appPath : app.folder;
    if ((await run(job, `Installing packages (${pm})`, `${pm} install`, installCwd)) !== 0) {
      job.hint ||= 'Installing packages failed. Look for the first error line in the log; often a missing tool (Settings → Check tools) or no internet.';
      return finish(job, 'failed');
    }

    if (!appInfo(app).projectId && existsSync(join(appPath, 'app.json'))) {
      const code = await run(job, 'Linking the Expo project', `${EAS} init --non-interactive --force`, appPath, easEnv());
      if (code !== 0) return finish(job, 'failed');
    }

    const profile = /^[\w-]+$/.test(app.profile) ? app.profile : 'production';
    const build = `${EAS} build --platform ios --profile ${profile} --auto-submit --non-interactive${wait ? '' : ' --no-wait'}`;
    const code = await run(job, 'Building in the cloud and sending to TestFlight', build, appPath, easEnv());
    if (code !== 0) {
      job.hint ||= 'The build was not started. Read the last lines of the log, or try "Open interactive window" to see Expo\'s questions.';
      return finish(job, 'failed');
    }
    log(job, wait
      ? '✔ Done. The build is uploaded; TestFlight shows it after Apple finishes processing (usually 5–15 minutes).'
      : '✔ Sent to Expo. The build runs in the cloud (about 15–25 min) and goes to TestFlight automatically. Follow it with the link above.');
    finish(job, 'ok');
  } catch (e) {
    log(job, `Error: ${e.message}`);
    finish(job, 'failed');
  }
}

/** Opens a normal PowerShell window running the same build, for one-time questions. */
function openInteractive(app) {
  const appPath = join(app.folder, app.appDir);
  const profile = /^[\w-]+$/.test(app.profile) ? app.profile : 'production';
  const cmd = `npx eas-cli@latest build --platform ios --profile ${profile} --auto-submit`;
  if (!IS_WINDOWS) return { ok: false, message: `Open a terminal in ${appPath} and run: ${cmd}` };
  const ps = `Set-Location -LiteralPath '${appPath.replace(/'/g, "''")}'; ${cmd}`;
  spawn('cmd.exe', ['/c', 'start', '"App Shipper"', 'powershell', '-NoExit', '-Command', ps], {
    env: easEnv(),
    detached: true,
    windowsHide: false,
    stdio: 'ignore',
  }).unref();
  return { ok: true, message: 'A PowerShell window opened. Answer its questions once; next time the Ship button works on its own.' };
}

async function cloneApp(fields) {
  const job = newJob({ id: null, name: fields.name }, 'clone');
  try {
    mkdirSync(dirname(fields.folder), { recursive: true });
    const branch = fields.branch ? `-b ${q(fields.branch)} ` : '';
    const code = await run(job, 'Downloading from GitHub', `git clone ${branch}${q(fields.gitUrl)} ${q(fields.folder)}`, dirname(fields.folder));
    if (code !== 0) {
      job.hint ||= 'Download failed. For private repos, Git will ask you to log in to GitHub in a pop-up window: try again and log in.';
      return finish(job, 'failed');
    }
    const appDir = findAppDir(fields.folder);
    if (!appDir) {
      log(job, 'Downloaded, but no app.json was found in it.');
      return finish(job, 'failed');
    }
    const app = { ...fields, id: randomUUID(), appDir };
    config.apps.push(app);
    saveConfig();
    log(job, `✔ Added ${app.name} (app folder: ${appDir}).`);
    finish(job, 'ok');
    broadcast({ type: 'config', config: publicConfig() });
  } catch (e) {
    log(job, `Error: ${e.message}`);
    finish(job, 'failed');
  }
}

function checkTools() {
  const tool = (cmd) => {
    const r = spawnSync(cmd, { shell: true, encoding: 'utf8', timeout: 20_000, windowsHide: true });
    return r.status === 0 ? (r.stdout || r.stderr).trim().split('\n')[0] : null;
  };
  return {
    node: process.version,
    git: tool('git --version'),
    pnpm: tool('pnpm --version'),
    yarn: tool('yarn --version'),
  };
}

// ---------------------------------------------------------------- http

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolveBody(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanAppFields(body) {
  const folder = str(body.folder, 1000);
  if (!folder || !isAbsolute(folder)) throw new Error('Folder must be a full path, like C:\\Users\\you\\apps\\myapp');
  return {
    name: str(body.name, 80) || 'My app',
    folder: resolve(folder),
    appDir: str(body.appDir, 200) || '',
    gitUrl: str(body.gitUrl, 500),
    branch: str(body.branch, 200),
    profile: /^[\w-]+$/.test(str(body.profile)) ? str(body.profile) : 'production',
  };
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const method = req.method;

  if (method === 'GET' && parts[1] === 'state') {
    return json(res, 200, { ...publicConfig(), jobs: [...jobs.values()].map((j) => ({ ...jobSummary(j), lines: j.lines })) });
  }

  if (method === 'GET' && parts[1] === 'events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return;
  }

  if (method === 'POST' && parts[1] === 'tools') return json(res, 200, checkTools());

  if (method === 'POST' && parts[1] === 'install-pnpm') {
    const job = newJob(null, 'tools');
    run(job, 'Installing pnpm', 'npm install -g pnpm@10', homedir()).then((code) => finish(job, code === 0 ? 'ok' : 'failed'));
    return json(res, 202, { jobId: job.id });
  }

  const body = method === 'POST' || method === 'PUT' ? await readBody(req) : {};

  if (method === 'PUT' && parts[1] === 'settings') {
    const s = config.settings;
    const token = str(body.expoToken);
    if (token && !token.startsWith('••••')) s.expoToken = token;
    if (body.clearExpoToken) s.expoToken = '';
    s.ascKeyPath = str(body.ascKeyPath, 1000);
    s.ascKeyId = str(body.ascKeyId, 40);
    s.ascIssuerId = str(body.ascIssuerId, 60);
    s.appleTeamId = str(body.appleTeamId, 20);
    s.skipCapabilitySync = body.skipCapabilitySync !== false;
    if (s.ascKeyPath && !existsSync(s.ascKeyPath)) {
      saveConfig();
      return json(res, 200, { ...publicConfig(), warning: `Saved, but the key file was not found at ${s.ascKeyPath}` });
    }
    saveConfig();
    return json(res, 200, publicConfig());
  }

  if (parts[1] === 'apps') {
    const id = parts[2];
    const app = id ? config.apps.find((a) => a.id === id) : null;

    if (method === 'POST' && !id) {
      const fields = cleanAppFields(body);
      if (!existsSync(fields.folder)) {
        if (!fields.gitUrl) throw new Error('That folder does not exist. Paste a GitHub link to download the app there.');
        cloneApp(fields);
        return json(res, 202, { cloning: true });
      }
      const appDir = fields.appDir || findAppDir(fields.folder);
      if (!appDir) throw new Error('No app.json found in that folder (or in app/, apps/…). Pick the folder of an Expo app.');
      const created = { ...fields, id: randomUUID(), appDir };
      config.apps.push(created);
      saveConfig();
      return json(res, 201, publicConfig());
    }

    if (!app) return json(res, 404, { error: 'App not found' });

    if (method === 'PUT' && !parts[3]) {
      const fields = cleanAppFields({ ...app, ...body });
      Object.assign(app, fields, { appDir: fields.appDir || findAppDir(fields.folder) || app.appDir });
      saveConfig();
      return json(res, 200, publicConfig());
    }

    if (method === 'DELETE' && !parts[3]) {
      config.apps = config.apps.filter((a) => a.id !== id);
      saveConfig();
      return json(res, 200, publicConfig());
    }

    if (method === 'POST' && parts[3] === 'ship') {
      const running = [...jobs.values()].find((j) => j.appId === app.id && j.status === 'running');
      if (running) return json(res, 409, { error: 'This app is already shipping.' });
      ship(app, { wait: !!body.wait });
      return json(res, 202, {});
    }

    if (method === 'POST' && parts[3] === 'interactive') return json(res, 200, openInteractive(app));
  }

  if (method === 'POST' && parts[1] === 'jobs' && parts[3] === 'cancel') {
    const job = jobs.get(parts[2]);
    if (job?.child) {
      if (IS_WINDOWS) spawn('taskkill', ['/pid', String(job.child.pid), '/T', '/F'], { windowsHide: true });
      else job.child.kill('SIGTERM');
      log(job, '■ Cancelled.');
      finish(job, 'cancelled');
    }
    return json(res, 200, {});
  }

  return json(res, 404, { error: 'Not found' });
}

function start(port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    // Only answer requests addressed to this computer (blocks DNS-rebinding tricks).
    const host = (req.headers.host ?? '').toLowerCase();
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    const token = req.headers['x-token'] ?? url.searchParams.get('t');
    try {
      if (url.pathname === '/' || url.pathname === '/index.html') {
        if (token !== TOKEN) {
          res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end('<p style="font-family:sans-serif">Open App Shipper by double-clicking <b>Ship.cmd</b>.</p>');
        }
        const html = readFileSync(join(HERE, 'ui.html'), 'utf8').replace('__TOKEN__', TOKEN);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }
      if (url.pathname.startsWith('/api/')) {
        if (token !== TOKEN) return json(res, 403, { error: 'Forbidden' });
        return await handleApi(req, res, url);
      }
      res.writeHead(404);
      res.end();
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && port < FIRST_PORT + 10) return start(port + 1);
    console.error(e.message);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    const address = `http://127.0.0.1:${port}/?t=${TOKEN}`;
    console.log('');
    console.log('  App Shipper is running.');
    console.log(`  If the browser didn't open, copy this into it:\n  ${address}`);
    console.log('  Close this window to stop App Shipper.');
    console.log('');
    if (process.env.SHIPPER_NO_BROWSER) return;
    if (IS_WINDOWS) spawn('cmd.exe', ['/c', 'start', '""', address], { stdio: 'ignore', detached: true }).unref();
    else if (platform() === 'darwin') spawn('open', [address], { stdio: 'ignore', detached: true }).unref();
    else spawn('xdg-open', [address], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  });
}

start(FIRST_PORT);
