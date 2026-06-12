# Flappy Bird 3D

A realistic 3D reimagining of the original Flappy Bird mobile game, built with Three.js. The classic cyan sky, green pipes, yellow bird, and pixel-art UI colors are preserved — but the world is fully 3D with lighting, shadows, and depth.

## Play locally

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

## Controls

- **Click / Tap** — flap
- **Space / Up Arrow** — flap

## Features

- Faithful OG color palette (`#4EC0CA` sky, `#73BF2E` pipes, `#F7DC16` bird)
- 3D bird with animated wings, beak, and tail feathers
- Cylindrical pipes with rim caps and highlight stripes
- Scrolling grass/dirt ground with procedural textures
- Parallax clouds and distant city skyline
- Real-time shadows and PBR-style materials
- Score tracking with local best score
