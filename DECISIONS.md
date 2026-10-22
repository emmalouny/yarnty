# YarnTŷ — Design Decisions & Phase 1 Plan

Status: agreed 2026-10-22, pending confirmation. No code written yet.

## 1. What this is

A knitting and crochet **project tracker that works without signal**, UK-first, built
solo on roughly 6–8 hours a week, with something real in front of a small group of
testers in about 3 months.

It is deliberately **not** an open pattern library at launch. That was the original
differentiator and it is the wrong first move: an empty pattern library is a
content-acquisition problem, not a coding problem, and it cannot be solved on a
Sunday afternoon. The tracker can be built alone, from zero, with no seeded content
and no copyright exposure — and it is the thing people open daily.

## 2. Audience and seriousness

| Decision | Choice |
|---|---|
| First cohort | Invite-only, 5–10 people from the existing Discord |
| Destination | Public product |
| Community features | **Not built.** The Discord already is the community |
| Build in public | Yes — landing page gets email capture + a plain description |

The two decisions treated as if the product were already public, because they are
expensive to reverse: how pattern files are stored and owned (§5), and how user data
is modelled and deleted (§9).

## 3. Scope

**In:** knitting and crochet.
**Out:** sewing (different data model entirely — pattern pieces, yardage, body
measurements; Ribblr already covers it), spinning, weaving, dyeing. Those may later
appear as *stash* types without touching the pattern schema.

## 4. UK-first identity

This is a wedge, not decoration. UK and US crochet terms collide directly — UK double
crochet is US single crochet, UK treble is US double — and getting it wrong makes a
pattern unworkable. Ravelry handles this badly.

- `terminology: UK | US` stored per pattern; displayed as written, never silently converted.
- A one-click convert/translate view is a **later** feature, not v1.
- Metric canonical: millimetres for hooks and needles, grams for yarn.
- UK weight names primary (4ply, DK, aran), US names as aliases.
- `locale` column from day one, defaulting to `en-GB`. Welsh stays in the name for now;
  the column keeps the door open for a few pence.

## 5. Patterns: private only

A pattern is **metadata plus, optionally, one private file the owner uploaded**.
Nothing is public, nothing is searchable across users, nothing is shared in v1.

This matches the real workflow — "I bought this PDF, now I need to track it" — and it
removes the entire legal surface: no DMCA process, no moderation queue, no designer
piracy worry.

- `visibility` column exists from day one, hardcoded to `private`.
- The public library later becomes a flag flip plus a search index, not a migration.
- **No pattern transcription, ever.** Users typing patterns into structured rows is
  enormous manual work and the reason most such apps die.

## 6. The project data model

A pattern is a PDF, so the tracker cannot derive rows from it. The shape that works
without parsing anything:

```
project
  └── section  (ordered: "body", "sleeve 1", "sleeve 2")
        ├── count, optional target ("to row 84")
        └── reminder ("decrease every 6th row from row 12")
```

The **reminder is the feature.** Losing your place in a repeat is the actual moment of
pain while knitting, and solving it needs only arithmetic the user configures once.

Other decisions inside this:
- `project.pattern_id` is **nullable**. A large share of crochet is worked from a
  YouTube video or improvised; forcing a pattern would make the app unusable.
- One pattern, many projects.
- Projects carry free-text notes and photos.
- Counters are never deleted; projects are archived.

### Postgres schema (phase 1)

```sql
users           (id uuid pk, email citext unique, created_at, updated_at, deleted_at)
invites         (code pk, created_by, used_by, used_at, expires_at)
login_codes     (id, user_id, code_hash, token_hash, expires_at, consumed_at)
refresh_tokens  (id, user_id, token_hash, device_label, expires_at, revoked_at)

patterns        (id uuid pk, user_id, title, designer, source_url,
                 craft enum(knit|crochet), terminology enum(UK|US),
                 yarn_weight, needle_mm numeric, gauge_notes,
                 visibility default 'private', file_key null,
                 locale default 'en-GB', created_at, updated_at, deleted_at)

projects        (id uuid pk, user_id, pattern_id null, title,
                 status enum(active|finished|hibernating|frogged),
                 yarn_notes text, started_at, finished_at,
                 created_at, updated_at, deleted_at)

sections        (id uuid pk, project_id, name, position int,
                 count int, target int null, created_at, updated_at, deleted_at)

reminders       (id uuid pk, section_id, every_n int, offset int default 0,
                 message text, active bool)

counter_events  (id uuid pk, client_event_id uuid, user_id, section_id,
                 type enum(increment|decrement|set), delta int null, value int null,
                 occurred_at timestamptz,  -- client clock
                 received_at timestamptz default now())
                 UNIQUE (user_id, client_event_id)

project_photos  (id uuid pk, project_id, r2_key, width, height, caption,
                 created_at, deleted_at)
```

All primary keys are **UUIDs minted on the client**, so offline creates need no server
round-trip. `sections.count` is a **cache** of the folded event log, computed server-side.

## 7. Sync: an append-only event log

The client sends `{+1 on section X, client_event_id: uuid, occurred_at}` — never
`count = 47`.

Last-write-wins on state is actively dangerous here. Knit to row 47 on the train with
no signal, then a tablet at home syncs an older state of 30, and 17 rows of real work
vanish silently — the user finds out when the sleeves don't match. Increments commute:
two devices merge to the correct total with no conflict resolution at all.

- Idempotency via `UNIQUE (user_id, client_event_id)`, so a retried request can't double-count.
- One deliberate exception: **"set count to N" is a last-write-wins event**, because
  sometimes the user simply miscounted. Different intent, distinct event type.
- Automerge/Yjs rejected: correct, but a large library and a new mental model while
  also learning React.

### Client local model

IndexedDB, **properly versioned** via `onupgradeneeded` — not a bare key-value blob.
This is the real "painful rewrite" risk in the architecture, and it has nothing to do
with Postgres: a phone can hold a week of unsynced rows in an old shape, and a naive
upgrade drops them — exactly the failure mode the event log exists to prevent.

- Stores: `projects`, `sections`, `reminders`, `pending_events`, `meta`.
- The first upgrade path (v1 → v2) is a tested no-op, so the mechanism is proven
  before anything depends on it.
- Never ship a client schema change until unsynced data is migrated or pushed first.
- A visible **"N changes not yet synced"** indicator — so users know not to clear
  browser data, and so bug reports are legible.

## 8. Stack

| Layer | Choice | Note |
|---|---|---|
| API | **FastAPI** + SQLAlchemy + Alembic | Python is what I already know |
| DB | **Neon** Postgres | Managed; nightly backup, restore tested in week 3 |
| Client | **React + Vite + TypeScript** PWA | Learning from zero; budgeted for |
| Local store | IndexedDB, versioned | §7 |
| Images | **Cloudflare R2** | No egress fees; a photo feed is all egress |
| API host | **Fly.io** | |
| Static/PWA | **Cloudflare Workers** (static assets) | Project `yarnty-tracker`. Pages in §8 originally; switched because the account already runs Workers and Cloudflare steers new static sites there |
| Email | Resend or Postmark free tier | Not raw SMTP |
| Errors | **Sentry**, API + client | §10 |
| Deploy | **GitHub Actions + Wrangler** | Not Cloudflare's Git integration |

Cost: roughly £0–15/month, inside the £15–25 budget.

**Deploy runs from GitHub Actions, not Cloudflare's Git integration.** Cloudflare's
own builder runs the build but not the test suite, so a change that broke the
local-schema migrations would ship regardless. Driving the deploy from Actions
makes `deploy` depend on typecheck and tests passing — the suite that protects
users' unsynced rows becomes a release gate rather than a report. Secondary
benefit: no Cloudflare GitHub app, one pipeline to debug.

**yarnty.com is a separate, manually-uploaded Worker (`yarnty-app`) and is not
connected to this repo.** Editing `index.html` in git does not change the live
landing page. Connecting it is deliberate outstanding work, not an oversight.

**Go:** the goal to learn Go is real, but it is quarantined. Phase 1 ships in Python
with Pillow doing images. Once that works end to end, the **image service** gets
rewritten in Go — accept upload, strip EXIF, generate thumbnails, write to R2. No
business logic, CPU-bound, single static binary, trivially testable, and a rewrite
costs a weekend rather than the project. Explicitly *not* the sync endpoint: that is
the hardest logic in the system and the worst place to be a beginner.

**Ruled out:** HTMX + Jinja (great fit for my skills, but cannot do offline, so it
kills the core feature). React Native and Next.js both dropped for v1 — one client
only, and a PWA avoids App Store review and a second build pipeline. Svelte is easier
to learn, but React's answered-error-message advantage wins for a solo beginner.

## 9. Auth, privacy, deletion

- **Magic link + 6-digit code** in the same email (links open the wrong browser on
  phones), gated by an **invite code**. Long-lived refresh tokens — a mobile tracker
  must stay signed in for weeks.
- No passwords exist. That deletes registration, reset, verification and hashing work,
  and removes password-breach liability entirely.
- UK GDPR applies the moment the first invited stranger signs in. Before that invite:
  a one-page privacy policy and a working `DELETE /v1/me`.
- **User deletion is a hard delete** — event log, images in R2, email. Distinct from
  the soft deletes used for sync. Two mechanisms, easy to confuse, embarrassing to
  get wrong.

## 10. Observability

Sentry on both API and client before the first invite. Sync bugs are unreproducible by
nature — "I lost some rows on the train last Tuesday" is unactionable without
telemetry. Every sync error carries the failing `client_event_id` so a report maps to
a traceable event. User content is scrubbed from payloads: IDs and stack traces only.

## 11. Definition of done, and the cohort

**The gate for the first invite is: I complete one real garment, cast on to cast off,
offline, on my own phone, using only YarnTŷ.**

A feature checklist would ship something that technically works and is miserable to
use. The repeat-reminder in particular cannot be evaluated by anyone not holding
needles — ten minutes of real knitting reveals whether the tap target is reachable
one-handed and whether the reminder fires at the right moment.

Then 5–10 testers, chosen for being chatty rather than polite:
- One `#yarnty-testers` channel. No DM support, no email support, no roadmap promises.
- Cadence stated out loud and in writing: "I build on Sundays; bugs get looked at then."
- The failure mode to design against is not too little feedback — it's ten people
  reporting the same thing in DMs when there are four hours left in the week.
  Unmanaged expectations are what turns a hobby into an obligation, and the resentment
  is what actually kills these projects.

## 12. First month (~7 h/week)

**Week 1 — the shell, no features.** React + Vite + TypeScript from scratch. One page,
one button, a count that persists in IndexedDB v1 and survives an offline reload.
Installable on my phone. Produces no product value; that is the point.

**Week 2 — local-only tracker.** Projects, sections, counters, repeat reminders. All
in IndexedDB. Events written to `pending_events` but never sent. *At the end of this
week I can start knitting with it.*

**Week 3 — backend skeleton.** FastAPI on Fly, Neon, Alembic, the §6 schema,
`/v1/health`. Nightly backup configured **and one restore actually performed**.
Losing a stranger's knitting notes is the one failure that ends the project's
reputation inside my own Discord.

**Week 4 — auth and eyes.** Magic link + 6-digit code, invite codes, Resend, refresh
tokens. `DELETE /v1/me`. Sentry on both sides.

Then: month 2 is the sync endpoint — event fold, idempotency, the sync indicator, and
deliberate two-device conflict tests. Month 3 is photos, patterns (metadata + private
file), the privacy policy, the landing-page rebuild, and knitting the garment that
unlocks the invites.

## 13. Deliberately deferred, with reasons

| Deferred | Why |
|---|---|
| Open, no-login pattern library | Content acquisition problem, not a code problem. Original differentiator, wrong first move |
| Yarn and stash tables | A table addition is a five-minute migration. **But: yarn is an entity, never a string** — the only free-text allowance is a column named `yarn_notes`, permanently unstructured, which phase 3 sits alongside rather than parses |
| Yarn-based pattern discovery | Needs the yarn DB |
| In-app community, groups, comments | The Discord exists and is free |
| Native iOS/Android | PWA first; App Store review and a second pipeline would eat the weekly budget |
| UK↔US terminology conversion | Storing the field is v1; converting is later |
| Go image service | After phase 1 works in Python |
| Push notifications | Community phase |

## 14. Biggest risks

1. **Two new languages at once.** Go is quarantined specifically to stop this; the
   unavoidable learning cost is the frontend, and weeks 1–2 are budgeted for it.
2. **Sync correctness.** Mitigated by increments-not-state, idempotency keys,
   deliberate two-device tests in month 2, and Sentry.
3. **Local schema migration eating unsynced work.** Mitigated by versioned IndexedDB
   and a proven no-op upgrade path.
4. **Silence.** A 3-month quiet build is where solo projects die. Mitigated by the
   build-in-public page and the existing TikTok/Instagram channels.
