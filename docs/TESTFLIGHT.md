# LANDRUSH → TestFlight

Two parts:

1. **Server on the VPS** (once). The app talks to `https://vps-1a18ee51.vps.ovh.net/landrush`.
2. **iPhone build** from your Windows PC with EAS (each time you want a new TestFlight build).

Never paste passwords, keys or the `.env` file into a chat.

---

## Part 1: Server on the VPS

Log in to the VPS (PowerShell on Windows):

```bash
ssh ubuntu@vps-1a18ee51.vps.ovh.net
```

(Use the same user you use for Apkaime if it isn't `ubuntu`.)

### 1.1 What's serving HTTPS today?

```bash
sudo ss -ltnp | grep -E ':(80|443) '
```

Look at the name at the end of the lines (`users:(("nginx"...`):

| You see | Follow |
|---|---|
| `nginx` | **1.5 A** |
| `caddy` | **1.5 B** |
| `pocketbase` | **1.5 C** |
| nothing | **1.5 D** |

### 1.2 Install Docker (skip if `docker --version` already works)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```

Log in again with `ssh` after `exit`.

### 1.3 Get the code

The repo is private, so give the VPS a read-only key:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/landrush_deploy
cat ~/.ssh/landrush_deploy.pub
```

Copy the line it prints. On GitHub open **strivemusicof-rgb/Passive → Settings → Deploy keys → Add deploy key**, paste it, title `vps`, leave "Allow write access" **off**, save. Then:

```bash
cat >> ~/.ssh/config <<'CFG'
Host github-landrush
  HostName github.com
  IdentityFile ~/.ssh/landrush_deploy
CFG
sudo mkdir -p /opt/landrush && sudo chown $USER /opt/landrush
git clone -b claude/landrush-foundation git@github-landrush:strivemusicof-rgb/Passive.git /opt/landrush
```

(Type `yes` if it asks about GitHub's fingerprint.)

### 1.4 Secrets and start

This generates strong random secrets straight into the file (you never see or copy them):

```bash
cd /opt/landrush/deploy
printf "POSTGRES_PASSWORD=%s\nJWT_SECRET=%s\nMIN_APP_VERSION=0.1.0\n" "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > .env
chmod 600 .env
docker compose up -d --build
```

The first build takes a few minutes. Check it:

```bash
curl http://127.0.0.1:3100/health
```

You should see `{"status":"ok",...}`.

### 1.5 Put it on HTTPS under `/landrush`

#### A) Nginx

Find the file that has `server_name vps-1a18ee51.vps.ovh.net` and `listen 443`:

```bash
grep -rl "vps-1a18ee51" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
```

Open it (`sudo nano <that file>`) and paste this **inside** the `server { ... }` block that has `listen 443`, above its last `}`:

```nginx
    location /landrush/ {
        proxy_pass http://127.0.0.1:3100/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

Save (Ctrl+O, Enter, Ctrl+X), then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

#### B) Caddy

```bash
sudo nano /etc/caddy/Caddyfile
```

Inside the `vps-1a18ee51.vps.ovh.net { ... }` block add:

```
    handle_path /landrush/* {
        reverse_proxy 127.0.0.1:3100
    }
```

Then `sudo systemctl reload caddy`.

#### C) PocketBase serves HTTPS itself

Two programs can't both use port 443, so put Caddy in front of both. Apkaime is offline for about a minute while you switch.

1. Find how PocketBase is started: `systemctl list-units | grep -i pocket`, then `systemctl cat <that service>`.
2. Edit its `ExecStart` so it serves plain HTTP only on the VPS itself: replace `--https=...`/`--http=...` with `--http=127.0.0.1:8090` (`sudo systemctl edit --full <service>`).
3. Install Caddy:
   ```bash
   sudo apt install -y caddy
   sudo tee /etc/caddy/Caddyfile >/dev/null <<'CADDY'
   vps-1a18ee51.vps.ovh.net {
       handle_path /landrush/* {
           reverse_proxy 127.0.0.1:3100
       }
       reverse_proxy 127.0.0.1:8090
   }
   CADDY
   sudo systemctl restart <pocketbase service> && sudo systemctl restart caddy
   ```
4. Check that Apkaime still works in its app.

If anything goes wrong, undo step 2 and `sudo systemctl stop caddy`.

#### D) Nothing on 80/443

```bash
sudo apt install -y caddy
sudo tee /etc/caddy/Caddyfile >/dev/null <<'CADDY'
vps-1a18ee51.vps.ovh.net {
    handle_path /landrush/* {
        reverse_proxy 127.0.0.1:3100
    }
}
CADDY
sudo systemctl restart caddy
```

### 1.6 Test from anywhere

Open in a browser: **https://vps-1a18ee51.vps.ovh.net/landrush/health** → `{"status":"ok",...}`.

### 1.7 Daily backups

```bash
(crontab -l 2>/dev/null; echo "15 3 * * * /opt/landrush/deploy/backup.sh >> /opt/landrush/deploy/backup.log 2>&1") | crontab -
```

Backups land in `/opt/landrush/deploy/backups/` (two weeks kept). Copy them off the server now and then.

### Updating the server later

```bash
cd /opt/landrush && git pull && cd deploy && docker compose up -d --build
```

Database changes are applied automatically when the server starts.

---

## Part 2: iPhone build (Windows PC)

### 2.1 One-time setup

Install **Node.js 22 LTS** (nodejs.org) and **Git** (git-scm.com). Then in PowerShell:

```powershell
corepack enable
git clone -b claude/landrush-foundation https://github.com/strivemusicof-rgb/Passive.git landrush
cd landrush
pnpm install
cd app
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` creates the Expo project and writes its id into `app.json`. Commit and push that change (or tell me the id and I'll add it), so it isn't lost:

```powershell
git add app.json
git commit -m "Add EAS project id"
git push
```

### 2.2 Build and send to TestFlight

From the `app` folder:

```powershell
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

It will ask:

- **Log in to your Apple account**: yes. EAS creates the certificate and provisioning profile for `lv.landrush.app` and turns on Sign in with Apple.
- **App Store Connect app**: let it create one. If the name **LANDRUSH** is taken on the App Store, create the app yourself in App Store Connect with another name (for example "LANDRUSH – Own the Map", bundle ID `lv.landrush.app`); the name on the home screen stays LANDRUSH.

The build takes about 15–25 minutes in the cloud. After Apple finishes processing (usually 5–15 more minutes), it appears in **TestFlight** on your iPhone.

### 2.3 First test on the phone

1. Open the app → **Play as Guest** (or Sign in with Apple).
2. Allow location → you get a free plot where you are.
3. The map should show Apple's satellite view with your plot.
4. Buy a plot, wait a bit, press **Collect**, build a House.

If the app says it can't reach the server, open https://vps-1a18ee51.vps.ovh.net/landrush/health on the phone's browser and tell me what you see.
