# Flappy Bird 3D

A realistic 3D version of Flappy Bird (Three.js), keeping the original cyan sky, green pipes, and yellow bird.

## What's in the game

- 3D bird with flapping wings, blinking eye, and feather particles
- Procedural sound (flap, score ding, crash) — press **M** or tap 🔊 to mute
- OG-style medals: Bronze (10+), Silver (20+), Gold (30+), Platinum (40+)
- "GET READY" countdown, progressive pipe speed, camera follow, bloom lighting
- Feather burst on death, sparkles when you score

---

## Step-by-step: how to run

### Step 1 — Get the code

Open a terminal and run:

```bash
git clone https://github.com/csherman-lab/Flappy-Bird.git
cd Flappy-Bird
```

### Step 2 — Switch to the game branch

The game is on this branch (not `main`):

```bash
git checkout cursor/realistic-3d-flappy-bird-d4fe
```

Check that you have the game files:

```bash
ls
```

You should see `index.html`, `js/`, `css/`, and `assets/`.

### Step 3 — Start a local web server

**Option A (easiest):**

```bash
chmod +x start.sh
./start.sh
```

**Option B (Python):**

```bash
python3 -m http.server 8080
```

**Option C (Node):**

```bash
npm start
```

You should see something like: `Serving HTTP on ... port 8080`

### Step 4 — Open in your browser

Go to:

**http://localhost:8080**

Do **not** double-click `index.html`. That will not work.

### Step 5 — Play

- Click the screen, tap (mobile), or press **Space** / **↑** to flap
- Avoid the green pipes
- Tap again after game over to retry

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page / only "Flappy-Bird" text | You are on `main`. Run `git checkout cursor/realistic-3d-flappy-bird-d4fe` |
| "Setup required" message | You opened the file directly. Use a server (Step 3) and visit `http://localhost:8080` |
| `index.html not found` | `cd` into the project folder first |
| Port 8080 in use | Use another port: `python3 -m http.server 3000` then open `http://localhost:3000` |

---

## Controls

- **Click / Tap** — flap
- **Space / Up Arrow** — flap
