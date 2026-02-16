# Discord Adhan Bot 
Team Sandid Support Server [discord.gg/q6BRpvErCv](https://discord.com/invite/q6BRpvErCv)

Discord bot for Islamic prayer reminders (adhan) with:

- Scheduled reminders in a text channel
- Optional pre-prayer reminders (5/10/15 min before selected prayers)
- Optional adhan playback in a configured voice channel
- Random azkar reminders (server + DM)
- Random hadith reminders with grade filtering (server + DM)
- Per-server location settings (city, country, timezone, method, school)
- Per-user location settings with automatic DM prayer reminders

## Requirements

- Node.js 18.17+ (Node 20 recommended)
- A Discord bot/application with `bot` + `applications.commands` scopes
- Bot permissions in your server:
  - Send Messages
  - View Channels
  - Connect
  - Speak

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `CLIENT_SECRET` (for web dashboard login)
   - `SESSION_SECRET` (for dashboard session cookies)
   - Optional `SESSION_STORE_PATH` (defaults to `data/sessions`, persisted dashboard sessions)
   - Optional `SESSION_TTL_SECONDS` (default `604800`, 7 days)
   - Optional `SESSION_REAP_INTERVAL_SECONDS` (default `3600`)
   - Optional `WEB_RATE_LIMIT_WINDOW_MS` (default `900000`)
   - Optional `WEB_RATE_LIMIT_MAX_PUBLIC` (default `600`)
   - Optional `WEB_RATE_LIMIT_MAX_AUTH` (default `40`)
   - Optional `WEB_RATE_LIMIT_MAX_POST` (default `120`)
   - Optional `PRIVACY_CONTACT` (shown on `/privacy`)
   - Optional `DATA_ENCRYPTION_KEY` (encrypts `data/*.json` at rest)
   - Optional `WEB_BASE_URL` (default `http://localhost:3000`)
   - Optional `WEB_PORT` (default `3000`)
   - Optional `DASHBOARD_DISCORD_SYNC_SECONDS` (default `90`, lowers OAuth API request frequency)
   - Optional `BOT_PERMISSIONS` (default: `2322443439053888`)
   - Optional `GUILD_ID` for instant test command registration in one server
   - Optional `ADHAN_AUDIO_FILE` (defaults to `assets/adhan.mp3`)

3. Put an adhan audio file at `assets/adhan.mp3` (or update `ADHAN_AUDIO_FILE`).

4. Register slash commands:

```bash
npm run register:commands
```

5. Start the bot:

```bash
npm start
```

This starts both:
- Discord bot client
- Web dashboard server (default: `http://localhost:3000`)

Smoke checks before promotion:

```bash
npm run verify
```

6. In Discord Developer Portal, add this OAuth2 redirect URL:

```text
http://localhost:3000/auth/callback
```

7. Generate invite URL:

```bash
npm run invite:url
```

## VPS Reliability (Recommended)

Running in a plain terminal means any crash/disconnect leaves the bot offline until manual restart.
Use PM2 on your VPS so the process auto-restarts:

1. Install PM2 once:

```bash
npm install -g pm2
```

2. Start with restart policy:

```bash
npm run pm2:start
```

3. Save PM2 process list:

```bash
npm run pm2:save
```

4. Enable auto-start on server reboot:

```bash
pm2 startup
```

5. Useful runtime commands:

```bash
npm run pm2:logs
npm run pm2:restart
```

## Daily Data Backup (Windows)

Back up persisted runtime data daily, including:
- `data/guildConfigs.json`
- `data/userConfigs.json`
- `data/sessions/` (dashboard session store)

Run an immediate backup:

```bat
run-data-backup-now.bat
```

Install a daily scheduled backup task (default: `03:15`):

```bat
setup-daily-data-backup-task.bat
```

Install at a custom time (24h format, example `02:30`):

```bat
setup-daily-data-backup-task.bat 02:30
```

Task mode:
- The installer tries `SYSTEM` mode first (best for always-on backups).
- If not running as Administrator, it automatically falls back to interactive mode.

Backups are written to:
- `backups/data/data-backup-YYYY-MM-DD_HHMMSS.zip`

Retention:
- Keeps 30 days by default (older zip backups are removed automatically).

Session store handling:
- The backup script automatically reads `SESSION_STORE_PATH` from `.env`.
- If your session path is outside `data/`, it is included in the backup archive.

## Web Dashboard

- Homepage: `http://localhost:3000`
- Login: `Login with Discord`
- Dashboard features:
  - Invite bot to servers
  - Select server and configure all guild features from web
  - Configure personal DM features from web
  - Brand header with bot icon from `assets/bot-icon-masjid.png`
- Server settings available on dashboard:
  - Location (city/country/method/school)
  - Reminder text channel, voice channel, mention role
  - Adhan voice playback toggle
  - Pre-prayer reminders (enable + 5/10/15 min lead + per-prayer selection)
  - Global language selector (`english` or `arabic`)
  - Azkar reminders (enabled + interval)
  - Hadith reminders (enabled + daily time + min grade)
- Personal DM settings available:
  - Location
  - Prayer reminder toggle
  - DM pre-prayer reminders (enable + 5/10/15 min lead + per-prayer selection)
  - Global language selector (`english` or `arabic`)
  - Azkar reminder toggle + interval
  - Hadith reminder toggle + time + min grade

## Slash Commands

- `/set-location city country [method] [school]` (country uses autocomplete selector)
- `/set-channels reminder_channel [voice_channel] [play_voice]`
- `/set-mention-role [role]`
- `/set-azkar-reminders enabled [interval_minutes] [language]`
- `/set-hadith-reminders enabled [hour] [minute] [min_grade] [language]`
- `/config`
- `/prayer-times [date]`
- `/next-prayer`
- `/test-adhan [prayer]`
- `/test-azkar`
- `/test-hadith`
- `/my-location city country [method] [school]` (country uses autocomplete selector)
- `/dm-reminders enabled:true|false`
- `/dm-azkar-reminders enabled:true|false [interval_minutes] [language]`
- `/dm-hadith-reminders enabled:true|false [hour] [minute] [min_grade] [language]`
- `/dm-config`
- `/dm-prayer-times [date]`
- `/dm-next-prayer`
- `/dm-test [prayer]`
- `/dm-test-azkar`
- `/dm-test-hadith`
- `/export-my-data`
- `/delete-my-data`
- `/delete-guild-data` (Manage Server)

## Typical First-Time Setup In Discord

1. `/set-location city:New York country:United States`
2. `/set-channels reminder_channel:#adhan-reminders voice_channel:General play_voice:true`
3. Optional `/set-mention-role role:@Muslims`
4. `/test-adhan` to verify message + voice playback
5. Optional server content reminders:
   - `/set-azkar-reminders enabled:true interval_minutes:180`
   - `/set-hadith-reminders enabled:true hour:20 minute:00 min_grade:sahih`
6. Personal DMs: `/my-location city:New York country:United States` then:
   - `/dm-reminders enabled:true`
   - Optional `/dm-azkar-reminders enabled:true interval_minutes:180`
   - Optional `/dm-hadith-reminders enabled:true hour:20 minute:00 min_grade:sahih`

## Notes

- Prayer times are fetched from Aladhan API using your configured city/country (or legacy lat/lon), method, and school.
- Azkar and hadith are served from curated in-app datasets (`src/islamicContentService.js`).
- Dashboard global language controls prayer labels and reminder language (`english` or `arabic`) per server and per user.
- Prayer-time outputs include Arabic prayer names with the same emoji/layout style.
- Scheduler checks every 20 seconds by default (`CHECK_INTERVAL_SECONDS` in `.env`).
- Server configs persist in `data/guildConfigs.json`.
- User DM reminder configs persist in `data/userConfigs.json`.
- You can export/delete your stored settings via the dashboard (Data Controls) or `/export-my-data` and `/delete-my-data`.
