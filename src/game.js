const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");

const WORLD = {
  width: 420,
  height: 630,
  ground: 78,
};

const SETTINGS = {
  gravity: 1480,
  flapVelocity: -455,
  pipeSpeed: 168,
  pipeWidth: 78,
  pipeGap: 165,
  pipeEvery: 1.48,
  birdX: 126,
};

const STORAGE_KEY = "realistic-flappy-best";

let dpr = 1;
let lastTime = 0;
let spawnTimer = 0;
let score = 0;
let best = loadBest();
let state = "ready";
let audio;

const bird = createBird();
const pipes = [];
const particles = [];
const clouds = createClouds();
const reeds = createReeds();

bestEl.textContent = best;

function createBird() {
  return {
    x: SETTINGS.birdX,
    y: WORLD.height * 0.42,
    vy: 0,
    radius: 18,
    wing: 0,
    rotation: 0,
    flapPulse: 0,
  };
}

function resetGame() {
  Object.assign(bird, createBird());
  pipes.length = 0;
  particles.length = 0;
  spawnTimer = 0;
  score = 0;
  scoreEl.textContent = score;
  state = "ready";
  addPipe(WORLD.width + 90);
}

function loadBest() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  best = value;
  bestEl.textContent = best;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Private browsing can disable localStorage; the in-memory score still works.
  }
}

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(WORLD.width * dpr);
  canvas.height = Math.round(WORLD.height * dpr);
}

function addPipe(x = WORLD.width + 40) {
  const playableHeight = WORLD.height - WORLD.ground;
  const margin = 84;
  const wave = Math.sin((pipes.length + score) * 0.83) * 42;
  const randomLift = (Math.random() - 0.5) * 118;
  const gapCenter = clamp(playableHeight * 0.5 + wave + randomLift, margin + 38, playableHeight - margin);

  pipes.push({
    x,
    gapCenter,
    gap: SETTINGS.pipeGap - Math.min(score * 1.6, 26),
    width: SETTINGS.pipeWidth,
    passed: false,
    seed: Math.random() * 1000,
  });
}

function startPlaying() {
  if (state === "ready" || state === "gameover") {
    if (state === "gameover") {
      resetGame();
    }
    pipes.length = 0;
    addPipe(WORLD.width + 70);
    addPipe(WORLD.width + 70 + 240);
    spawnTimer = SETTINGS.pipeEvery * 0.5;
    state = "playing";
  }
}

function flap() {
  ensureAudio();

  if (state === "paused") {
    state = "playing";
    return;
  }

  startPlaying();
  bird.vy = SETTINGS.flapVelocity;
  bird.flapPulse = 1;
  emitFeathers();
  playTone(460, 0.075, "triangle", 0.035);
}

function gameOver() {
  if (state !== "playing") return;
  state = "gameover";
  shakeCanvas();
  emitBurst(bird.x, bird.y, "#f2c27a", 18);
  playTone(120, 0.18, "sawtooth", 0.05);
  if (score > best) {
    saveBest(score);
  }
}

function togglePause() {
  if (state === "playing") {
    state = "paused";
  } else if (state === "paused") {
    state = "playing";
  }
}

function update(dt) {
  const t = performance.now() / 1000;
  updateParticles(dt);

  if (state === "ready") {
    bird.y = WORLD.height * 0.42 + Math.sin(t * 2.4) * 8;
    bird.vy = 0;
    bird.rotation = Math.sin(t * 2.1) * 0.08;
    bird.wing += dt * 7;
    return;
  }

  if (state !== "playing") {
    bird.wing += dt * 3;
    return;
  }

  bird.vy += SETTINGS.gravity * dt;
  bird.y += bird.vy * dt;
  bird.rotation = clamp(bird.vy / 620, -0.55, 1.05);
  bird.wing += dt * (bird.vy < 0 ? 17 : 8);
  bird.flapPulse = Math.max(0, bird.flapPulse - dt * 5);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer += SETTINGS.pipeEvery;
    addPipe();
  }

  const speed = SETTINGS.pipeSpeed + Math.min(score * 3.2, 52);
  for (const pipe of pipes) {
    pipe.x -= speed * dt;

    if (!pipe.passed && pipe.x + pipe.width < bird.x - bird.radius) {
      pipe.passed = true;
      score += 1;
      scoreEl.textContent = score;
      emitBurst(bird.x + 20, bird.y - 10, "#fff1a6", 10);
      playTone(820, 0.08, "sine", 0.03);
    }
  }

  while (pipes.length && pipes[0].x + pipes[0].width < -80) {
    pipes.shift();
  }

  if (collides()) {
    gameOver();
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.spin += p.spinSpeed * dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function collides() {
  const playableBottom = WORLD.height - WORLD.ground;
  if (bird.y + bird.radius > playableBottom || bird.y - bird.radius < 6) {
    return true;
  }

  const birdHit = {
    left: bird.x - 15,
    right: bird.x + 17,
    top: bird.y - 13,
    bottom: bird.y + 13,
  };

  for (const pipe of pipes) {
    const left = pipe.x + 4;
    const right = pipe.x + pipe.width - 4;
    const topPipeBottom = pipe.gapCenter - pipe.gap / 2;
    const bottomPipeTop = pipe.gapCenter + pipe.gap / 2;
    const overlapsX = birdHit.right > left && birdHit.left < right;
    const overlapsTop = birdHit.top < topPipeBottom;
    const overlapsBottom = birdHit.bottom > bottomPipeTop;

    if (overlapsX && (overlapsTop || overlapsBottom)) {
      return true;
    }
  }

  return false;
}

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  const t = performance.now() / 1000;
  drawSky(t);
  drawDistantLandscape(t);
  drawClouds(t);
  drawPipes(t);
  drawParticles();
  drawBird(bird.x, bird.y, bird.rotation, t, 1);
  drawGround(t);
  drawVignette();
  drawOverlay();
}

function drawSky(t) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height - WORLD.ground);
  sky.addColorStop(0, "#6fb9f3");
  sky.addColorStop(0.42, "#b7e5ff");
  sky.addColorStop(0.74, "#f6d6a1");
  sky.addColorStop(1, "#f4af70");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const sunGlow = ctx.createRadialGradient(314, 108, 4, 314, 108, 150);
  sunGlow.addColorStop(0, "rgba(255, 245, 186, 0.98)");
  sunGlow.addColorStop(0.22, "rgba(255, 220, 124, 0.58)");
  sunGlow.addColorStop(1, "rgba(255, 204, 128, 0)");
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(314, 108, 150, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 38; i += 1) {
    const x = (i * 97 + t * 5) % WORLD.width;
    const y = 24 + ((i * 53) % 420);
    ctx.fillStyle = i % 3 === 0 ? "#ffffff" : "#ffe4ae";
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + (i % 4) * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawDistantLandscape(t) {
  const horizon = WORLD.height - WORLD.ground;

  drawMountainLayer(horizon - 138, "#6f8c9c", 0.22, t * 4);
  drawMountainLayer(horizon - 92, "#4d6e74", 0.32, t * 8);

  ctx.fillStyle = "rgba(34, 76, 65, 0.44)";
  ctx.beginPath();
  ctx.moveTo(0, horizon - 58);
  for (let x = 0; x <= WORLD.width + 16; x += 16) {
    const y = horizon - 58 - Math.sin(x * 0.08 + t) * 7 - ((x * 13) % 19);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WORLD.width, horizon);
  ctx.lineTo(0, horizon);
  ctx.closePath();
  ctx.fill();
}

function drawMountainLayer(baseY, color, alpha, offset) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-60, WORLD.height - WORLD.ground);
  for (let x = -60; x <= WORLD.width + 80; x += 72) {
    const peak = baseY - 34 - ((x + offset) % 47);
    ctx.lineTo(x + 36 - (offset % 72), peak);
    ctx.lineTo(x + 86 - (offset % 72), WORLD.height - WORLD.ground);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawClouds(t) {
  for (const cloud of clouds) {
    const x = wrap(cloud.x - t * cloud.speed, -cloud.w, WORLD.width + cloud.w);
    ctx.save();
    ctx.globalAlpha = cloud.alpha;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(70, 94, 120, 0.22)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.ellipse(x, cloud.y, cloud.w * 0.35, cloud.h * 0.42, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.23, cloud.y - 8, cloud.w * 0.32, cloud.h * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.52, cloud.y, cloud.w * 0.38, cloud.h * 0.38, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.76, cloud.y + 5, cloud.w * 0.28, cloud.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPipes(t) {
  for (const pipe of pipes) {
    const topBottom = pipe.gapCenter - pipe.gap / 2;
    const bottomTop = pipe.gapCenter + pipe.gap / 2;
    drawPipeSegment(pipe.x, -28, pipe.width, topBottom + 28, true, pipe.seed, t);
    drawPipeSegment(pipe.x, bottomTop, pipe.width, WORLD.height - WORLD.ground - bottomTop + 16, false, pipe.seed, t);
  }
}

function drawPipeSegment(x, y, width, height, isTop, seed, t) {
  const capHeight = 34;
  const capY = isTop ? y + height - capHeight : y;
  const bodyY = isTop ? y : y + capHeight - 8;
  const bodyHeight = height - capHeight + 8;

  ctx.save();
  ctx.shadowColor = "rgba(32, 38, 28, 0.35)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = -8;
  ctx.shadowOffsetY = 12;

  drawRoundedPipeRect(x + 8, bodyY, width - 16, bodyHeight, 12);
  const bodyGradient = ctx.createLinearGradient(x, 0, x + width, 0);
  bodyGradient.addColorStop(0, "#34552f");
  bodyGradient.addColorStop(0.18, "#78a24a");
  bodyGradient.addColorStop(0.52, "#a6c45f");
  bodyGradient.addColorStop(0.75, "#597f3d");
  bodyGradient.addColorStop(1, "#203c2a");
  ctx.fillStyle = bodyGradient;
  ctx.fill();

  ctx.clip();
  drawPipeTexture(x + 8, bodyY, width - 16, bodyHeight, seed, t);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(18, 30, 22, 0.42)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  drawRoundedPipeRect(x - 1, capY, width + 2, capHeight, 12);
  const capGradient = ctx.createLinearGradient(x - 1, 0, x + width + 1, 0);
  capGradient.addColorStop(0, "#29482c");
  capGradient.addColorStop(0.18, "#80a94e");
  capGradient.addColorStop(0.5, "#c1d56f");
  capGradient.addColorStop(0.78, "#6f943f");
  capGradient.addColorStop(1, "#1d3428");
  ctx.fillStyle = capGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 225, 0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#e7f6a8";
  ctx.fillRect(x + width * 0.32, capY + 5, 5, capHeight - 10);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawRoundedPipeRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawPipeTexture(x, y, width, height, seed, t) {
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#1a3322";
  ctx.lineWidth = 1;
  for (let yy = y + 20; yy < y + height; yy += 28) {
    ctx.beginPath();
    ctx.moveTo(x + 3, yy);
    ctx.bezierCurveTo(x + width * 0.35, yy + Math.sin(yy + seed) * 5, x + width * 0.6, yy - 4, x + width - 2, yy + 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#15361f";
  for (let i = 0; i < 12; i += 1) {
    const spotX = x + 7 + ((seed * 17 + i * 23) % Math.max(width - 14, 1));
    const spotY = y + 10 + ((seed * 31 + i * 41 + t * 5) % Math.max(height - 20, 1));
    ctx.beginPath();
    ctx.ellipse(spotX, spotY, 2 + (i % 3), 1.6 + (i % 2), 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#fffbd0";
  ctx.fillRect(x + width * 0.3, y, 3, height);
  ctx.globalAlpha = 1;
}

function drawBird(x, y, rotation, t, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;

  const pulse = bird.flapPulse * 2;
  const wingLift = Math.sin(bird.wing) * 12 - pulse * 7;

  ctx.shadowColor = "rgba(21, 27, 31, 0.32)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;

  drawTailFeathers();
  drawLegs();
  drawWing(-3, 4, wingLift);
  drawBody();
  drawHead(t);
  drawBeak();
  drawEye();

  ctx.restore();
}

function drawBody() {
  const body = ctx.createRadialGradient(-5, -10, 2, -3, 0, 34);
  body.addColorStop(0, "#fff0c1");
  body.addColorStop(0.34, "#d89d4f");
  body.addColorStop(0.78, "#85552e");
  body.addColorStop(1, "#49311f");

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-4, 2, 28, 20, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = "#f5d28c";
  ctx.lineWidth = 1.1;
  for (let i = -18; i <= 12; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, -9 + Math.abs(i) * 0.14);
    ctx.quadraticCurveTo(i + 8, -2, i + 5, 9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const belly = ctx.createRadialGradient(2, 11, 2, 2, 11, 20);
  belly.addColorStop(0, "#ffe7ad");
  belly.addColorStop(1, "rgba(255, 206, 125, 0)");
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(1, 8, 19, 11, 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawHead(t) {
  const head = ctx.createRadialGradient(11, -17, 2, 9, -13, 22);
  head.addColorStop(0, "#fff6d5");
  head.addColorStop(0.48, "#bd7f3e");
  head.addColorStop(1, "#523620");

  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.ellipse(11, -12, 20, 17, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(64, 37, 22, 0.45)";
  ctx.beginPath();
  ctx.ellipse(2, -22, 12, 5, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(48, 31, 19, 0.34)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-2 + i * 6, -19);
    ctx.quadraticCurveTo(5 + i * 6, -23 - Math.sin(t * 2 + i) * 2, 9 + i * 5, -18);
    ctx.stroke();
  }
}

function drawWing(x, y, lift) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-0.18 + lift * 0.018) * Math.PI);

  const wingGradient = ctx.createLinearGradient(-22, -10, 24, 22);
  wingGradient.addColorStop(0, "#6a3d22");
  wingGradient.addColorStop(0.35, "#b87434");
  wingGradient.addColorStop(0.7, "#d5a052");
  wingGradient.addColorStop(1, "#59391f");
  ctx.fillStyle = wingGradient;
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.bezierCurveTo(-30, 2, -27, 29, 0, 25);
  ctx.bezierCurveTo(22, 20, 24, 0, 0, -10);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(46, 30, 18, 0.38)";
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-6 + i * 4, -3 + i * 1.6);
    ctx.quadraticCurveTo(-15 + i * 4, 9 + i * 3, -3 + i * 3, 22);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTailFeathers() {
  const colors = ["#4c2f1c", "#7a4927", "#a66332"];
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.ellipse(-28 - i * 2, 1 + i * 5, 15, 5, -0.4 + i * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLegs() {
  ctx.save();
  ctx.strokeStyle = "#6e3e20";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 2; i += 1) {
    const x = -3 + i * 9;
    ctx.beginPath();
    ctx.moveTo(x, 17);
    ctx.lineTo(x + 1, 25);
    ctx.lineTo(x + 7, 25);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBeak() {
  const beak = ctx.createLinearGradient(23, -12, 48, -8);
  beak.addColorStop(0, "#f5b84e");
  beak.addColorStop(0.55, "#ffdf82");
  beak.addColorStop(1, "#a95c22");

  ctx.fillStyle = beak;
  ctx.beginPath();
  ctx.moveTo(24, -14);
  ctx.quadraticCurveTo(42, -15, 50, -7);
  ctx.quadraticCurveTo(35, -4, 24, -6);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(91, 52, 26, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(27, -8);
  ctx.quadraticCurveTo(37, -8, 48, -7);
  ctx.stroke();
}

function drawEye() {
  ctx.fillStyle = "#fff8e8";
  ctx.beginPath();
  ctx.ellipse(21, -16, 5.5, 6.5, -0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1b1612";
  ctx.beginPath();
  ctx.arc(22, -16, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(23.5, -18, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawGround(t) {
  const y = WORLD.height - WORLD.ground;
  const soil = ctx.createLinearGradient(0, y, 0, WORLD.height);
  soil.addColorStop(0, "#3b7c42");
  soil.addColorStop(0.18, "#72a847");
  soil.addColorStop(0.24, "#654328");
  soil.addColorStop(1, "#2a1d17");
  ctx.fillStyle = soil;
  ctx.fillRect(0, y, WORLD.width, WORLD.ground);

  ctx.fillStyle = "rgba(244, 214, 146, 0.4)";
  ctx.fillRect(0, y + 8, WORLD.width, 2);

  for (const reed of reeds) {
    const x = wrap(reed.x - t * reed.speed, -20, WORLD.width + 20);
    ctx.save();
    ctx.translate(x, y + reed.base);
    ctx.rotate(Math.sin(t * 2.2 + reed.phase) * 0.08);
    ctx.strokeStyle = reed.color;
    ctx.lineWidth = reed.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(reed.bend, -reed.height * 0.5, reed.bend * 0.3, -reed.height);
    ctx.stroke();
    if (reed.flower) {
      ctx.fillStyle = "#7b4a2e";
      ctx.beginPath();
      ctx.ellipse(reed.bend * 0.3, -reed.height - 3, 3, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 1.8, p.size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawVignette() {
  const vignette = ctx.createRadialGradient(
    WORLD.width / 2,
    WORLD.height * 0.45,
    WORLD.width * 0.25,
    WORLD.width / 2,
    WORLD.height * 0.45,
    WORLD.height * 0.75,
  );
  vignette.addColorStop(0, "rgba(12, 19, 25, 0)");
  vignette.addColorStop(1, "rgba(12, 19, 25, 0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

function drawOverlay() {
  if (state === "playing") return;

  const title =
    state === "ready" ? "Tap to take flight" : state === "paused" ? "Paused" : "Wings clipped";
  const subtitle =
    state === "ready"
      ? "Keep the songbird between the moss-covered pipes."
      : state === "paused"
        ? "Press Esc or tap to continue."
        : "Tap again for another run.";

  ctx.save();
  ctx.fillStyle = "rgba(5, 12, 18, 0.42)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  drawGlassPanel(WORLD.width / 2 - 150, WORLD.height * 0.3, 300, state === "gameover" ? 178 : 150);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fffaf0";
  ctx.font = "800 30px Inter, system-ui, sans-serif";
  ctx.fillText(title, WORLD.width / 2, WORLD.height * 0.3 + 52);

  ctx.fillStyle = "rgba(255, 250, 240, 0.78)";
  ctx.font = "600 14px Inter, system-ui, sans-serif";
  wrapText(subtitle, WORLD.width / 2, WORLD.height * 0.3 + 84, 240, 20);

  if (state === "gameover") {
    ctx.fillStyle = "#ffd36a";
    ctx.font = "900 42px Inter, system-ui, sans-serif";
    ctx.fillText(String(score), WORLD.width / 2, WORLD.height * 0.3 + 142);
  }

  ctx.restore();
}

function drawGlassPanel(x, y, width, height) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 14;
  roundRect(x, y, width, height, 24);
  ctx.fillStyle = "rgba(14, 24, 32, 0.74)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = `${line}${word} `;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = `${word} `;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}

function emitFeathers() {
  for (let i = 0; i < 7; i += 1) {
    particles.push({
      x: bird.x - 16 + Math.random() * 10,
      y: bird.y + 8 + Math.random() * 8,
      vx: -70 - Math.random() * 90,
      vy: 20 - Math.random() * 80,
      gravity: 90,
      life: 0.55 + Math.random() * 0.25,
      maxLife: 0.75,
      spin: Math.random() * Math.PI,
      spinSpeed: -5 + Math.random() * 10,
      size: 1.9 + Math.random() * 1.8,
      color: ["#f5d28c", "#b87434", "#6a3d22"][i % 3],
    });
  }
}

function emitBurst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 45 + Math.random() * 115;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 120,
      life: 0.45 + Math.random() * 0.35,
      maxLife: 0.8,
      spin: Math.random() * Math.PI,
      spinSpeed: -8 + Math.random() * 16,
      size: 1.5 + Math.random() * 2.5,
      color,
    });
  }
}

function createClouds() {
  return Array.from({ length: 8 }, (_, i) => ({
    x: i * 72 + Math.random() * 56,
    y: 38 + Math.random() * 205,
    w: 54 + Math.random() * 64,
    h: 24 + Math.random() * 22,
    speed: 4 + Math.random() * 14,
    alpha: 0.28 + Math.random() * 0.38,
  }));
}

function createReeds() {
  return Array.from({ length: 84 }, (_, i) => ({
    x: i * 7 + Math.random() * 18,
    base: 18 + Math.random() * 58,
    height: 16 + Math.random() * 58,
    bend: -9 + Math.random() * 18,
    width: 1 + Math.random() * 1.6,
    speed: 28 + Math.random() * 34,
    phase: Math.random() * Math.PI * 2,
    color: Math.random() > 0.35 ? "#335d31" : "#91a852",
    flower: Math.random() > 0.9,
  }));
}

function ensureAudio() {
  if (!audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audio = new AudioContext();
    }
  }
}

function playTone(frequency, duration, type, volume) {
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}

function shakeCanvas() {
  canvas.animate(
    [
      { transform: "translate3d(0, 0, 0)" },
      { transform: "translate3d(-8px, 5px, 0)" },
      { transform: "translate3d(7px, -4px, 0)" },
      { transform: "translate3d(-4px, 3px, 0)" },
      { transform: "translate3d(0, 0, 0)" },
    ],
    { duration: 260, easing: "ease-out" },
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrap(value, min, max) {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000 || 0, 0.033);
  lastTime = time;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  flap();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    flap();
  } else if (event.code === "Escape") {
    togglePause();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing") {
    state = "paused";
  }
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
resetGame();
requestAnimationFrame(loop);
