/** Single-file admin page: review and pay cash-out requests. */
export const ADMIN_PAGE = /* html */ `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LANDRUSH Admin</title>
<style>
  :root { --bg:#070d0b; --panel:#111a16; --border:#1f2c26; --text:#f2f6f4; --muted:#9aa6a0; --green:#3fd958; --red:#ef5350; --amber:#f6b728; }
  * { box-sizing:border-box } [hidden] { display:none !important } body { margin:0; background:var(--bg); color:var(--text); font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif }
  header { display:flex; gap:12px; align-items:center; padding:16px 24px; border-bottom:1px solid var(--border); flex-wrap:wrap }
  h1 { font-size:19px; margin:0; flex:1 } main { max-width:1100px; margin:0 auto; padding:20px 24px; display:grid; gap:14px }
  button, select, input { font:inherit } .btn { border:1px solid var(--border); background:var(--panel); color:var(--text); padding:7px 13px; border-radius:9px; cursor:pointer; font-weight:600 }
  .btn.green { background:#1c6b2c; border-color:#2b7a3b } .btn.red { color:var(--red) } .btn:disabled { opacity:.4 }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:16px; display:grid; gap:8px }
  .row { display:flex; gap:10px; flex-wrap:wrap; align-items:center } .muted { color:var(--muted); font-size:13px }
  .chip { font-size:12px; font-weight:700; padding:2px 9px; border-radius:99px; background:#22302a }
  .pending { background:#3a2c0c; color:#ffd98a } .approved { background:#13305a; color:#9cc2ff } .paid { background:#123a1e; color:var(--green) } .rejected { background:#3a1517; color:#ff8a80 }
  .flag { color:var(--amber); font-size:13px } .amount { font-size:20px; font-weight:800 } code { background:#0b1310; padding:2px 6px; border-radius:6px }
  #login { max-width:420px; margin:60px auto } input[type=password] { width:100%; padding:10px; border-radius:9px; border:1px solid #2e3a35; background:var(--bg); color:var(--text) }
</style></head><body>
<div id="login" class="card" hidden>
  <h1>LANDRUSH Admin</h1>
  <p class="muted">Paste the ADMIN_TOKEN from the server's deploy/.env file.</p>
  <input type="password" id="token" autocomplete="off"><button class="btn green" id="go">Open</button><div id="loginErr" class="flag"></div>
</div>
<div id="app" hidden>
  <header><h1>💸 Cash-out requests</h1>
    <select id="status"><option value="pending">Pending</option><option value="approved">Approved (pay these)</option><option value="paid">Paid</option><option value="rejected">Rejected</option><option value="">All</option></select>
    <button class="btn" id="enable"></button><button class="btn" id="logout">Log out</button></header>
  <main>
    <p class="muted">How to pay: Approve → send the amount from your PayPal Business account to the email shown → click "Mark paid". Reject returns the points to the player.</p>
    <div id="list"></div>
  </main>
</div>
<script>
let token = sessionStorage.getItem('adminToken') || '';
// Works at /admin and behind a prefix like /landrush/admin (with or without a trailing slash).
const API = (location.pathname.endsWith('/') ? location.pathname.slice(0, -1) : location.pathname) + '/api/';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
async function api(method, path, body) {
  const res = await fetch(API + path, { method, headers: { 'x-admin-token': token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 403) { sessionStorage.removeItem('adminToken'); show(false); throw new Error('Wrong token'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || res.status);
  return data;
}
function show(loggedIn) { $('login').hidden = loggedIn; $('app').hidden = !loggedIn; }
async function load() {
  const rows = await api('GET', 'cashouts' + ($('status').value ? '?status=' + $('status').value : ''));
  $('list').innerHTML = rows.length ? rows.map((r) => \`<div class="card">
    <div class="row"><span class="amount">€\${(r.eurCents / 100).toFixed(2)}</span><span class="chip \${r.status}">\${r.status}</span>
      <span class="muted">\${r.points.toLocaleString()} ⭐ · \${esc(r.method)} → <code>\${esc(r.destination)}</code> · \${new Date(r.createdAt).toLocaleString()}</span></div>
    <div class="muted">Player <b>\${esc(r.user.name)}</b> (\${r.user.signIn}\${r.user.email ? ', ' + esc(r.user.email) : ''}) · account \${r.user.ageDays} days · level \${r.user.level} · \${r.user.plots} plots · \${r.user.checkIns} check-ins · \${r.user.pointsEarned.toLocaleString()} ⭐ earned in total</div>
    \${r.flags.map((f) => '<div class="flag">⚠ ' + esc(f) + '</div>').join('')}
    \${r.note ? '<div class="muted">Note: ' + esc(r.note) + '</div>' : ''}
    <div class="row">
      \${r.status === 'pending' ? '<button class="btn green" onclick="act(\\'' + r.id + '\\',\\'approve\\')">Approve</button>' : ''}
      \${r.status === 'approved' ? '<button class="btn green" onclick="act(\\'' + r.id + '\\',\\'paid\\')">Mark paid</button>' : ''}
      \${r.status === 'pending' || r.status === 'approved' ? '<button class="btn red" onclick="act(\\'' + r.id + '\\',\\'reject\\')">Reject (return points)</button>' : ''}
    </div></div>\`).join('') : '<p class="muted">Nothing here.</p>';
}
async function act(id, action) {
  let note;
  if (action === 'reject') { note = prompt('Reason shown to the player (optional):') ?? undefined; if (note === undefined) return; }
  if (action === 'paid' && !confirm('Did you send the money in PayPal?')) return;
  try { await api('POST', 'cashouts/' + id + '/' + action, { note }); await load(); } catch (e) { alert(e.message); }
}
let rewardsOn = null;
async function refreshEnable() { $('enable').textContent = rewardsOn ? 'Rewards: ON (turn off)' : 'Rewards: OFF (turn on)'; }
$('enable').onclick = async () => {
  if (!confirm(rewardsOn ? 'Turn rewards OFF for everyone?' : 'Turn rewards ON for everyone? Players can then request real-money payouts.')) return;
  rewardsOn = (await api('POST', 'rewards-enabled', { enabled: !rewardsOn })).enabled; refreshEnable();
};
$('status').onchange = load;
$('logout').onclick = () => { sessionStorage.removeItem('adminToken'); token = ''; show(false); };
$('go').onclick = async () => {
  token = $('token').value.trim();
  try { await load(); await loadEnabled(); sessionStorage.setItem('adminToken', token); show(true); } catch (e) { $('loginErr').textContent = e.message; }
};
async function loadEnabled() { rewardsOn = (await api('GET', 'rewards-enabled')).enabled; refreshEnable(); }
(async () => { if (!token) return show(false); try { await load(); await loadEnabled(); show(true); } catch { show(false); } })();
</script></body></html>`;
