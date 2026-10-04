# App Shipper

One-click TestFlight uploads for your Expo apps (LANDRUSH, Apkaime, Baltic Challenges…), on Windows, no PowerShell needed.

## Start it

1. Copy this `app-shipper` folder anywhere you like (e.g. `C:\Users\<you>\AppShipper`). It doesn't need to stay inside the LANDRUSH project.
2. Double-click **`Ship.cmd`**. A black window opens (leave it open) and your browser shows App Shipper.

Needs **Node.js** (nodejs.org) and **Git** (git-scm.com). *Settings → Check tools* shows what's missing and can install pnpm for you.

## First time: Settings

| Field | Where to get it |
|---|---|
| Expo access token | expo.dev → Account settings → **Access tokens** → Create |
| Apple key file (.p8) | App Store Connect → Users and Access → Integrations → App Store Connect API → **+** (Admin). Save the file somewhere safe, e.g. `Documents\keys`, and paste its full path. |
| Apple Key ID / Issuer ID | Same page |
| Apple Team ID | developer.apple.com → Membership (`EYFA6K2Q5Y`) |

Everything is stored only on this PC, in `%APPDATA%\AppShipper\config.json`.

## Add an app

**＋ Add app** → name, folder. If the folder doesn't exist yet, paste the GitHub link and it is downloaded there. The folder with `app.json` is found automatically.

## Ship

Click **Ship to TestFlight**. App Shipper gets the latest code from GitHub, installs packages, and starts the EAS cloud build with automatic upload to TestFlight. The build link appears at the top of the log. TestFlight shows the build about 30–40 minutes later.

## A brand-new app (once per app)

1. Create the app in **App Store Connect** (Apps → **+** → New App, same bundle ID). Apple only allows that by hand.
2. Put its **Apple ID** number into the app's `eas.json`:
   ```json
   "submit": { "production": { "ios": { "ascAppId": "1234567890" } } }
   ```
3. Tick the app's capabilities (e.g. **Sign In with Apple**) on developer.apple.com → Identifiers, because automatic capability sync is skipped (it often fails with API keys).
4. If the first build still has questions, use **Open interactive window** on the app's card once.

If something fails, the log shows a 💡 tip with what to do.

## Safety

App Shipper only listens on this computer (127.0.0.1) and every request needs the secret code in the address Ship.cmd opens, so websites can't trigger it.
