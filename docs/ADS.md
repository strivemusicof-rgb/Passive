# Ads (AdMob rewarded video)

Players can watch a video ad to:

- **double their last collect** (button under Collect, up to 5,000 coins), or
- get a **bonus**: +100 coins and +5 ⭐ (Rewards screen).

Limits (in the `ads` economy settings): 20 ads a day, 30 s between ads. Ad ⭐
don't count towards the free-play daily limit, because each ad pays us.

Right now the app uses **Google's test ads**: they look real but earn nothing.
To earn money, set up AdMob as below and ship a new build.

## 1. Create the AdMob app (once)

1. Go to <https://admob.google.com> and sign in with your Google account. Fill
   in payment details (country Latvia, your bank account) — needed to get paid.
2. **Apps → Add app → iOS**. If the app is on the App Store already, search for
   it; otherwise choose "not published yet" and name it LANDRUSH.
3. Copy the **App ID**. It looks like `ca-app-pub-1234567890123456~1234567890`
   (note the `~`).
4. In the app: **Ad units → Add ad unit → Rewarded**. Name it "Rewarded".
   Reward amount 1, reward item "Reward" (our server decides the real reward).
5. Open **Advanced settings → Server-side verification** for that ad unit and
   paste this callback URL:

   ```
   https://vps-1a18ee51.vps.ovh.net/landrush/ads/ssv
   ```

   Click **Verify URL** — it should say it worked.
6. Copy the **ad unit ID**. It looks like `ca-app-pub-1234567890123456/1234567890`
   (note the `/`).

## 2. EU consent message (required in the EU)

In AdMob: **Privacy & messaging → GDPR → Create message**, choose the LANDRUSH
app, languages English, Latvian and Russian, and publish. The app already
shows this form when needed. Also publish the **IDFA explainer** message there
(it appears before Apple's "Allow tracking?" question).

## 3. Put the IDs in the app

In `app/app.json`:

- `react-native-google-mobile-ads` → `iosAppId`: your **App ID** (with `~`)
- `extra` → `admob` → `iosRewarded`: your **ad unit ID** (with `/`)

Send me both IDs (they're not secret) and I'll make the change, or edit them
yourself. Then build and ship a new version to TestFlight.

## 4. Turn on verification on the server

Once the new build with your real IDs is out, make the server pay only when
Google confirms an ad was watched (so a hacked app can't fake ads). On the VPS:

```bash
cd /opt/landrush/deploy
docker compose exec db psql -U landrush landrush -c "INSERT INTO economy_config (key, value, updated_at) VALUES ('ads', '{\"requireSsv\": true}', now()) ON CONFLICT (key) DO UPDATE SET value = economy_config.value || '{\"requireSsv\": true}', updated_at = now();"
```

It takes effect within 30 seconds. Other settings can be changed the same way,
e.g. `{"maxPerDay": 15}` or `{"bonus": {"coins": 100, "points": 5}}`.

## 5. App Store Connect privacy answers

Ads change the App Privacy section (App Store Connect → your app → App
Privacy). Add:

- **Identifiers → Device ID**: used for *Third-Party Advertising*, linked to
  the user: No, used for tracking: Yes.
- **Usage Data → Advertising Data**: *Third-Party Advertising*, not linked,
  tracking: Yes.
- **Diagnostics → Crash Data / Performance Data**: *App Functionality*, not
  linked, no tracking (the ad SDK collects these).

## 6. app-ads.txt (recommended)

AdMob asks for an `app-ads.txt` file on the website listed as your developer
website in the App Store. Without it ads still show, but fewer advertisers bid.
When you have a website, AdMob shows the exact line to put in that file.

## How much will it earn?

Rewarded video in the Baltics usually pays about **€3–10 per 1,000 views**
(about half a cent to one cent per ad). A player who watches 5 ads a day brings
in roughly €1–1.50 a month. The bonus ad pays the player 5 ⭐ (€0.005), so we
keep around half.
