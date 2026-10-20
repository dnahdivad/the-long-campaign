# The Long Campaign

A Civil War campaign for two to six generals. Everyone writes orders in secret; when the deadline comes
(or as soon as every human has sent orders) the month is fought all at once. Deals are made on WhatsApp —
on the map you can support another army's attack, share your scouts' reports, grant free passage or send
supplies, and take any of it back next month. Every general also has secret orders worth points at the end.

*Designed and built by Claude (Anthropic) with Dave.*

## What is in here

| File | What it does |
|---|---|
| `public/engine.js` | The rules: map generation, movement, combat, supply, weather, diplomacy, scoring, computer generals. Used by both the server and the browser. |
| `public/client.js` | The player's table: the pixel-art hex map, orders, the Armies/War aims/Dispatches panels and the replay. |
| `public/index.html` | Front page: raise a campaign and get one private link per player. `/admin/<key>` is the organiser's page. |
| `public/play.html` | A player's page (`/play/<their link>`). |
| `public/solo.js` + `build.sh` | Builds `dist/the-long-campaign-solo.html`, a single file to play alone against computer generals. |
| `server.js` | A small Node server with no framework. Keeps campaigns, hides orders until a turn resolves, resolves turns on time and emails turn reports. |

## Running it on your own machine

```
npm install
node server.js        # then open http://localhost:3000
```

## Putting it on ailoveit.eu (Render)

The old Flask site is idle, so the simplest route is a new Render web service that takes over the domain.

1. Put this folder in a GitHub repository.
2. In Render: **New → Blueprint**, pick the repository. `render.yaml` sets everything up: a Node web
   service and a 1 GB persistent disk at `/var/data` where the campaigns are kept. A disk needs a paid
   instance (the Starter plan); on the free plan the files would vanish on every redeploy.
3. In the service's **Settings → Custom Domains**, move `ailoveit.eu` from the old service to this one.
4. Optional but recommended — set these environment variables:
   - `PUBLIC_URL` = `https://ailoveit.eu` (used in invite links and emails)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — the same mail details the
     contest site used, so players get an email when each turn has been fought.

**Free-plan alternative:** instead of the disk, create a free Postgres database (Render, Neon or Supabase)
and set `DATABASE_URL`. The server then keeps campaigns in Postgres automatically. Note that a free Render
web service sleeps when idle; turns still resolve on time because the server checks overdue campaigns
whenever anyone opens the site, and you can also point a free uptime pinger (or a Render cron job) at
`https://ailoveit.eu/cron?key=<CRON_KEY>` every 15 minutes.

## Starting a war

Open the site, choose the number of armies, how many are human, the map, the victory condition and how
often turns resolve, and press **Raise the armies**. You get one private link per human player — send each
friend theirs — and an organiser's link where you can see who has sent orders and fight a turn early.
Empty seats are played by computer generals.
