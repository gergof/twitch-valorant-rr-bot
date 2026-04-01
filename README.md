# Twitch Valorant RR Bot

Twitch Valorant RR Bot is a small web app and Twitch chat bot that tracks a streamer's Valorant RR changes while they are live and posts updates to chat when a new match is detected.

The public instance is available at [https://twitchrr.systest.eu](https://twitchrr.systest.eu) and is free to use.

## What It Does

- Lets a streamer sign in with Twitch and configure their Riot ID.
- Detects when the streamer goes live.
- Polls Valorant RR data while the stream is live.
- Stores streams and matches in PostgreSQL.
- Sends chat messages with RR updates after each detected match.
- Responds to `!rr` and `!rank` in chat with the latest known rank.

## Hosted Usage

1. Open [https://twitchrr.systest.eu](https://twitchrr.systest.eu).
2. Sign in with Twitch.
3. Go to settings.
4. Enable the bot.
5. Enter your Riot ID in the form `Name#TAG`.

Once configured, the bot will monitor your live streams and post RR updates automatically.

## Stack

- Node.js
- TypeScript
- Fastify
- MikroORM
- PostgreSQL
- Redis
- Twurple EventSub/WebSocket integrations
- EJS

## Local Development

### Requirements

- Node.js 22+
- PostgreSQL
- Redis
- A Twitch application
- A HenrikDev Valorant API key

### Install

```bash
npm ci
```

### Supporting Services

A local PostgreSQL and Redis pair is included:

```bash
docker compose up -d
```

### Environment Variables

Create a `.env` file with the following values:

```env
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
VALORANT_API_KEY=

BOT_AUTHORIZATION_MODE=false

REDIS_URL=redis://localhost:6379
SESSION_SECRET=change-me
SESSION_TTL_MS=86400000

DB_HOST=localhost
DB_USER=twitchrr
DB_PASSWORD=twitchrr
DB_NAME=twitchrr

PUBLIC_URL=http://localhost:3000
PORT=3000
```

### Run

```bash
npm start
```

That command builds the app and starts `dist/index.js`.

## Bot Authorization Mode

The bot account authorization is handled separately from normal app runtime.

Set:

```env
BOT_AUTHORIZATION_MODE=true
```

Then start the app and open the bot authorization URL printed in the logs. This mode is intended for bot setup, not normal operation.

After the bot account has been authorized, switch `BOT_AUTHORIZATION_MODE` back to `false` and run the app normally.

## Build Commands

```bash
npm run build
npm run typecheck
```

## Docker

Build the image locally:

```bash
docker build -t twitch-valorant-rr-bot .
```

## Data Model

The application stores:

- `Credential`: Twitch OAuth credentials for the bot and broadcasters
- `Channel`: streamer settings and Twitch identity
- `Stream`: tracked stream sessions
- `Match`: RR snapshots detected from Valorant match history

## Operational Notes

- RR polling only runs while a stream is considered live.
- Live state is driven by EventSub and periodic reconciliation.
- Invalid Riot IDs are treated as configuration errors and can cause the channel to be disabled automatically.

## License

GPL-3.0
