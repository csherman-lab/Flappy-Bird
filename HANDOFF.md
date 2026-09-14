# HANDOFF — Flappy Bird 3D

**Offboarding summary** for Emily / Ben / Jonathan / Dan  
**Author:** Cameron Sherman (`csherman-lab`)  
**Date:** 2026-09-13

## What this is

A small Three.js 3D Flappy Bird (original cyan sky, green pipes, yellow bird). Prototype / playable demo — no backend, no API keys.

## Current status (what works)

The playable game is **not on `main`**. It lives on `cursor/realistic-3d-flappy-bird-d4fe` (committed and pushed to the personal remote). Features: 3D bird, procedural sound, medals, countdown, progressive speed, bloom, particles.

`main` is still the initial placeholder commit. Opening `main` looks like a blank / “setup required” page.

## How to run

```bash
git checkout cursor/realistic-3d-flappy-bird-d4fe
./start.sh
# or: python3 -m http.server 8080
# or: npm start
```

Open **http://localhost:8080** (do not open `index.html` as a file). Click / Space / ↑ to flap; **M** mutes.

## Key files

- `index.html`, `js/`, `css/`, `assets/`
- `start.sh` — local server helper
- README.md — run instructions and troubleshooting

No environment variables.

## Incomplete / follow-up

- Open PR: [csherman-lab/Flappy-Bird#3](https://github.com/csherman-lab/Flappy-Bird/pull/3) — merge the 3D game into `main` (or treat the feature branch as canonical).
- Draft PR #2 (`cursor/local-flappy-integration-32c1`) and closed #1 are earlier experiments.
- Other local clones under `~/deft-project/flappy-bird` and `flappy-bird-new` are older personal copies of the same GitHub repo.

## Access note

- Local origin: https://github.com/csherman-lab/Flappy-Bird (personal)
- **No** `deftai/flappy-bird` (or `Flappy-Bird`) repo exists.
- Do **not** delete the personal repo. Emily asked for summaries in GitHub repos where Deft work was done; Cameron expected this on the deftai org. Needs an org owner to create/transfer a deftai repo if the team wants it archived there.
