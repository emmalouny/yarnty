# YarnTŷ

A knitting and crochet project tracker that **works without signal**. UK-first.

Built solo, in public, on about 6–8 hours a week.
The design decisions and the reasoning behind them live in **[DECISIONS.md](./DECISIONS.md)** —
read that before changing anything structural.

## Layout

```
index.html          the public landing page (live now)
DECISIONS.md        every decision made, and why
app/                the PWA — React + Vite + TypeScript
```

An `api/` directory (FastAPI) arrives in week 3.

## Running the app

Requires Node 22+.

```sh
cd app
npm install
npm run dev        # http://localhost:5173
```

### Verifying offline behaviour

The service worker is **only registered in production builds** — a caching
service worker in dev turns every change into a mystery. So:

```sh
npm run build && npm run preview
```

Open it, load it once, then turn the wifi off and reload. The app must still
boot and the count must be unchanged.

### Tests

```sh
npm test
```

These are mostly local-schema migration tests. They exist because a phone can
hold a week of unsynced rows, and a careless IndexedDB upgrade drops them
silently.

## Deploying

Pushes to `main` deploy themselves via GitHub Actions — but only after
typecheck, tests and build pass. Cloudflare's own Git integration would run the
build and skip the tests, which would let a broken local-schema migration ship.

The app is an assets-only Cloudflare Worker called `yarnty-tracker`, served at
**dev.yarnty.com** (`app/wrangler.jsonc`). It stays there until the tracker is
good enough to be the product.

`yarnty.com` keeps the Coming soon page. That is a **different**,
manually-uploaded Worker and is not wired to this repo, so editing
`index.html` here does not change the live landing page.

Requires two repository secrets: `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`.

## Status

**Week 2 of 12.** A working local tracker: projects, sections with optional
row targets, a thumb-sized counter, and repeat reminders ("decrease every 6th
row from row 12"). Everything lives in IndexedDB and works with no signal.
Nothing syncs yet — that is month 2.

Counts are never stored as bare state. Each tap appends an event to a log and
updates a cached count in the same transaction, so the two cannot drift. The
log is what will sync later, because increments merge without conflict.

Deliberately **not** built yet, with reasons: the open pattern library, yarn
and stash, in-app community, native apps. See
[DECISIONS.md §13](./DECISIONS.md#13-deliberately-deferred-with-reasons).
