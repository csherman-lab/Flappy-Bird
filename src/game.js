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
const treeLines = createTreeLines();
const lensDust = createLensDust();
const textures = createTextures();

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
  drawForestDepth(t);
  drawClouds(t);
  drawLensDust(t);
  drawPipes(t);
  drawParticles();
  drawBird(bird.x, bird.y, bird.rotation, t, 1);
  drawGround(t);
  drawScoreCounter();
  drawVignette();
  drawFilmGrain();
  drawOverlay();
}

function drawSky(t) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height - WORLD.ground);
  sky.addColorStop(0, "#5f8fb4");
  sky.addColorStop(0.32, "#9fbfd2");
  sky.addColorStop(0.68, "#d3b083");
  sky.addColorStop(1, "#7f5e43");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const sunGlow = ctx.createRadialGradient(315, 116, 3, 315, 116, 185);
  sunGlow.addColorStop(0, "rgba(255, 244, 202, 0.95)");
  sunGlow.addColorStop(0.16, "rgba(246, 209, 142, 0.52)");
  sunGlow.addColorStop(0.55, "rgba(214, 143, 83, 0.18)");
  sunGlow.addColorStop(1, "rgba(255, 204, 128, 0)");
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(315, 116, 185, 0, Math.PI * 2);
  ctx.fill();

  const haze = ctx.createLinearGradient(0, 250, 0, WORLD.height - WORLD.ground);
  haze.addColorStop(0, "rgba(255, 242, 203, 0)");
  haze.addColorStop(0.62, "rgba(255, 232, 180, 0.32)");
  haze.addColorStop(1, "rgba(126, 95, 65, 0.36)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 230, WORLD.width, WORLD.height - WORLD.ground - 230);

  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = textures.skyNoise;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height - WORLD.ground);
  ctx.restore();
}

function drawDistantLandscape(t) {
  const horizon = WORLD.height - WORLD.ground;

  drawMountainLayer(horizon - 156, "#556f75", 0.2, t * 3);
  drawMountainLayer(horizon - 116, "#405c5b", 0.28, t * 6);

  const field = ctx.createLinearGradient(0, horizon - 92, 0, horizon + 4);
  field.addColorStop(0, "rgba(65, 94, 62, 0.42)");
  field.addColorStop(0.62, "rgba(90, 106, 55, 0.58)");
  field.addColorStop(1, "rgba(42, 53, 36, 0.72)");
  ctx.fillStyle = field;
  ctx.beginPath();
  ctx.moveTo(0, horizon - 74);
  for (let x = 0; x <= WORLD.width + 16; x += 16) {
    const y = horizon - 70 - Math.sin(x * 0.04 + t * 0.4) * 10 - ((x * 13) % 17);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WORLD.width, horizon);
  ctx.lineTo(0, horizon);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#f2d19c";
  for (let y = horizon - 42; y < horizon; y += 9) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(t + y) * 2);
    for (let x = 0; x <= WORLD.width; x += 22) {
      ctx.lineTo(x, y + Math.sin(x * 0.025 + t * 0.7) * 3);
    }
    ctx.stroke();
  }
  ctx.restore();
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
    ctx.filter = `blur(${cloud.blur}px)`;
    ctx.fillStyle = cloud.tone;
    ctx.shadowColor = "rgba(70, 94, 120, 0.18)";
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.ellipse(x, cloud.y, cloud.w * 0.35, cloud.h * 0.42, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.23, cloud.y - 8, cloud.w * 0.32, cloud.h * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.52, cloud.y, cloud.w * 0.38, cloud.h * 0.38, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.76, cloud.y + 5, cloud.w * 0.28, cloud.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawForestDepth(t) {
  const horizon = WORLD.height - WORLD.ground;
  for (const layer of treeLines) {
    const offset = (t * layer.speed) % layer.spacing;
    ctx.save();
    ctx.globalAlpha = layer.alpha;
    ctx.fillStyle = layer.color;
    ctx.filter = `blur(${layer.blur}px)`;
    for (let x = -layer.spacing - offset; x < WORLD.width + layer.spacing; x += layer.spacing) {
      const trunkX = x + layer.offset;
      const baseY = horizon - layer.base;
      const height = layer.height + Math.sin((x + layer.seed) * 0.07) * layer.variance;
      ctx.fillRect(trunkX - 1, baseY - height * 0.55, 2, height * 0.55);
      ctx.beginPath();
      ctx.ellipse(trunkX, baseY - height * 0.75, layer.crownW, height * 0.38, 0, 0, Math.PI * 2);
      ctx.ellipse(trunkX - layer.crownW * 0.32, baseY - height * 0.6, layer.crownW * 0.7, height * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(trunkX + layer.crownW * 0.35, baseY - height * 0.58, layer.crownW * 0.78, height * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawLensDust(t) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const speck of lensDust) {
    const pulse = 0.5 + Math.sin(t * speck.speed + speck.phase) * 0.5;
    ctx.globalAlpha = speck.alpha * (0.55 + pulse * 0.45);
    ctx.fillStyle = speck.color;
    ctx.beginPath();
    ctx.arc(speck.x, speck.y, speck.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
  const capHeight = 38;
  const capY = isTop ? y + height - capHeight : y;
  const bodyY = isTop ? y : y + capHeight - 8;
  const bodyHeight = height - capHeight + 8;

  ctx.save();
  ctx.shadowColor = "rgba(12, 18, 14, 0.52)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = -10;
  ctx.shadowOffsetY = 14;

  drawRoundedPipeRect(x + 8, bodyY, width - 16, bodyHeight, 12);
  const bodyGradient = ctx.createLinearGradient(x, 0, x + width, 0);
  bodyGradient.addColorStop(0, "#17231f");
  bodyGradient.addColorStop(0.08, "#35564c");
  bodyGradient.addColorStop(0.24, "#7a5e35");
  bodyGradient.addColorStop(0.43, "#b77842");
  bodyGradient.addColorStop(0.55, "#d29a5d");
  bodyGradient.addColorStop(0.72, "#556c4e");
  bodyGradient.addColorStop(0.9, "#234236");
  bodyGradient.addColorStop(1, "#101b18");
  ctx.fillStyle = bodyGradient;
  ctx.fill();

  ctx.clip();
  drawPipeTexture(x + 8, bodyY, width - 16, bodyHeight, seed, t);
  drawPipeVerticalSeam(x + width * 0.72, bodyY, bodyHeight, seed);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(13, 18, 14, 0.55)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  drawRoundedPipeRect(x - 1, capY, width + 2, capHeight, 12);
  const capGradient = ctx.createLinearGradient(x - 1, 0, x + width + 1, 0);
  capGradient.addColorStop(0, "#111c18");
  capGradient.addColorStop(0.15, "#375b50");
  capGradient.addColorStop(0.35, "#a87842");
  capGradient.addColorStop(0.55, "#d2a766");
  capGradient.addColorStop(0.75, "#5a7353");
  capGradient.addColorStop(1, "#102019");
  ctx.fillStyle = capGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(247, 226, 174, 0.28)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.clip();
  drawPipeTexture(x - 1, capY, width + 2, capHeight, seed + 51, t);
  ctx.restore();

  drawPipeRim(x, capY, width, capHeight, isTop);
  drawPipeBolts(x, capY, width, capHeight, seed);
  drawPipeDrips(x, isTop ? capY + capHeight - 2 : capY + 2, width, isTop, seed, t);
}

function drawPipeRim(x, y, width, height, isTop) {
  ctx.save();
  const rimY = isTop ? y + height - 10 : y + 10;
  const rim = ctx.createLinearGradient(x, rimY - 12, x, rimY + 12);
  rim.addColorStop(0, "rgba(255, 234, 178, 0.38)");
  rim.addColorStop(0.48, "rgba(74, 48, 32, 0.2)");
  rim.addColorStop(1, "rgba(5, 8, 7, 0.5)");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(x + width / 2, rimY, width * 0.46, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(10, 18, 15, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawPipeBolts(x, y, width, height, seed) {
  ctx.save();
  for (let i = 0; i < 4; i += 1) {
    const bx = x + 12 + i * ((width - 24) / 3);
    const by = y + height * 0.48 + Math.sin(seed + i) * 2;
    const bolt = ctx.createRadialGradient(bx - 1, by - 1, 1, bx, by, 5);
    bolt.addColorStop(0, "#f2c17a");
    bolt.addColorStop(0.45, "#735033");
    bolt.addColorStop(1, "#161513");
    ctx.fillStyle = bolt;
    ctx.beginPath();
    ctx.arc(bx, by, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
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
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = textures.pipeNoise;
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = "#18251f";
  ctx.lineWidth = 1.1;
  for (let yy = y + 14; yy < y + height; yy += 19) {
    ctx.beginPath();
    ctx.moveTo(x + 3, yy);
    ctx.bezierCurveTo(
      x + width * 0.28,
      yy + Math.sin(yy + seed) * 5,
      x + width * 0.66,
      yy - 4 + Math.cos(seed + yy) * 2,
      x + width - 2,
      yy + 2,
    );
    ctx.stroke();
  }

  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 28; i += 1) {
    const spotX = x + 7 + ((seed * 17 + i * 23) % Math.max(width - 14, 1));
    const spotY = y + 8 + ((seed * 31 + i * 41 + t * 2) % Math.max(height - 16, 1));
    ctx.fillStyle = i % 4 === 0 ? "rgba(37, 91, 74, 0.86)" : i % 3 === 0 ? "rgba(98, 59, 31, 0.75)" : "rgba(12, 25, 19, 0.72)";
    ctx.beginPath();
    ctx.ellipse(spotX, spotY, 1.2 + (i % 5), 0.9 + (i % 3), Math.sin(seed + i), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.32;
  ctx.fillStyle = "rgba(255, 225, 170, 0.8)";
  ctx.fillRect(x + width * 0.42, y, 2, height);
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(x + width * 0.88, y, 3, height);
  ctx.globalAlpha = 1;
}

function drawPipeVerticalSeam(x, y, height, seed) {
  ctx.save();
  ctx.strokeStyle = "rgba(22, 21, 17, 0.54)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let yy = y; yy < y + height; yy += 18) {
    ctx.lineTo(x + Math.sin(yy * 0.07 + seed) * 1.5, yy);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(241, 196, 126, 0.24)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 3, y);
  ctx.lineTo(x - 3, y + height);
  ctx.stroke();
  ctx.restore();
}

function drawPipeDrips(x, y, width, isTop, seed, t) {
  ctx.save();
  ctx.strokeStyle = "rgba(43, 92, 73, 0.72)";
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i += 1) {
    const dx = x + 10 + ((seed * 19 + i * 17) % (width - 20));
    const length = 7 + ((seed + i * 11) % 18);
    const wobble = Math.sin(t * 1.7 + i + seed) * 1.2;
    ctx.lineWidth = 1 + (i % 3) * 0.4;
    ctx.beginPath();
    ctx.moveTo(dx, y);
    ctx.lineTo(dx + wobble, y + (isTop ? length : -length));
    ctx.stroke();
  }
  ctx.restore();
}

function drawBird(x, y, rotation, t, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(1.08, 1.08);
  ctx.globalAlpha = alpha;

  const pulse = bird.flapPulse * 2;
  const wingLift = Math.sin(bird.wing) * 12 - pulse * 7;

  ctx.shadowColor = "rgba(9, 14, 17, 0.5)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 12;

  drawBirdDropShadow();
  drawTailFeathers();
  drawLegs();
  drawWing(-3, 4, wingLift);
  drawBody();
  drawBodyFeatherDetail();
  drawHead(t);
  drawBeak();
  drawEye();

  ctx.restore();
}

function drawBirdDropShadow() {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(-2, 20, 32, 6, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBody() {
  const body = ctx.createRadialGradient(-9, -12, 2, -4, 1, 34);
  body.addColorStop(0, "#f6ead3");
  body.addColorStop(0.28, "#d7b37a");
  body.addColorStop(0.52, "#9b6a3c");
  body.addColorStop(0.78, "#5f3f29");
  body.addColorStop(1, "#2d2119");

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-5, 2, 29, 20, -0.08, 0, Math.PI * 2);
  ctx.fill();

  const belly = ctx.createRadialGradient(2, 11, 2, 2, 11, 20);
  belly.addColorStop(0, "rgba(244, 226, 194, 0.96)");
  belly.addColorStop(0.52, "rgba(214, 178, 125, 0.42)");
  belly.addColorStop(1, "rgba(255, 206, 125, 0)");
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(1, 8, 19, 11, 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawBodyFeatherDetail() {
  ctx.save();
  ctx.lineCap = "round";

  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const fx = -23 + col * 5.7 + (row % 2) * 2.5;
      const fy = -10 + row * 4.8 + Math.sin(col + row) * 1.2;
      const length = 8 + ((col + row) % 4);
      const alpha = 0.2 + row * 0.035;
      drawFineFeather(fx, fy, length, 0.35 + row * 0.08, `rgba(43, 29, 19, ${alpha})`, 0.7);
      drawFineFeather(fx + 0.8, fy - 0.8, length * 0.55, 0.18, "rgba(248, 226, 178, 0.18)", 0.45);
    }
  }

  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#f7e2bc";
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-18 + i * 6, -12 + Math.sin(i) * 2);
    ctx.quadraticCurveTo(-11 + i * 5, -2, -15 + i * 6, 12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHead(t) {
  const head = ctx.createRadialGradient(9, -19, 2, 10, -12, 23);
  head.addColorStop(0, "#f8ebcf");
  head.addColorStop(0.3, "#bb8956");
  head.addColorStop(0.63, "#6e482c");
  head.addColorStop(1, "#241a14");

  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.ellipse(11, -12, 20, 17, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(40, 25, 17, 0.58)";
  ctx.beginPath();
  ctx.ellipse(2, -22, 13, 5.5, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(239, 219, 184, 0.64)";
  ctx.beginPath();
  ctx.ellipse(18, -10, 10, 8, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(31, 22, 16, 0.44)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 13; i += 1) {
    const sx = -6 + i * 3.6;
    const sy = -19 + Math.sin(t * 1.5 + i) * 1.2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + 6, sy - 5 - Math.sin(t * 2 + i) * 1.2, sx + 11, sy + 1);
    ctx.stroke();
  }
}

function drawWing(x, y, lift) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-0.18 + lift * 0.018) * Math.PI);

  const wingGradient = ctx.createLinearGradient(-22, -10, 24, 22);
  wingGradient.addColorStop(0, "#2c2118");
  wingGradient.addColorStop(0.2, "#634025");
  wingGradient.addColorStop(0.42, "#a16b3d");
  wingGradient.addColorStop(0.68, "#c79a60");
  wingGradient.addColorStop(1, "#3b2a1d");
  ctx.fillStyle = wingGradient;
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.bezierCurveTo(-33, 0, -30, 31, -2, 27);
  ctx.bezierCurveTo(24, 23, 25, -1, 0, -10);
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 15; i += 1) {
    const featherX = -18 + i * 2.8;
    const featherY = -4 + i * 1.5;
    drawFineFeather(
      featherX,
      featherY,
      20 - i * 0.45,
      1.05 + i * 0.04,
      i % 2 ? "rgba(40, 26, 17, 0.58)" : "rgba(248, 221, 164, 0.22)",
      i % 2 ? 1.05 : 0.55,
    );
  }

  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "#f1cd8c";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-13, -5);
  ctx.quadraticCurveTo(3, 5, 18, 11);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawTailFeathers() {
  const colors = ["#201811", "#4c2f1c", "#7a4927", "#a66332", "#3a261b"];
  for (let i = 0; i < 5; i += 1) {
    const tail = ctx.createLinearGradient(-42, 0, -14, 12);
    tail.addColorStop(0, colors[i]);
    tail.addColorStop(0.75, "#a96a39");
    tail.addColorStop(1, "#22170f");
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.ellipse(-30 - i * 1.5, -4 + i * 4, 17, 4.2, -0.55 + i * 0.23, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(244, 202, 131, 0.24)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function drawLegs() {
  ctx.save();
  ctx.strokeStyle = "#6b4226";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (let i = 0; i < 2; i += 1) {
    const x = -3 + i * 9;
    ctx.beginPath();
    ctx.moveTo(x, 17);
    ctx.lineTo(x + 1, 25);
    ctx.lineTo(x + 7, 25);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(25, 15, 10, 0.5)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-3 + i * 3.3, 23);
    ctx.lineTo(-5 + i * 3.4, 26);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBeak() {
  const beak = ctx.createLinearGradient(23, -12, 48, -8);
  beak.addColorStop(0, "#7b4a25");
  beak.addColorStop(0.32, "#d49b50");
  beak.addColorStop(0.6, "#f2d58d");
  beak.addColorStop(1, "#4c2a17");

  ctx.fillStyle = beak;
  ctx.beginPath();
  ctx.moveTo(24, -14);
  ctx.quadraticCurveTo(43, -16, 52, -8);
  ctx.quadraticCurveTo(36, -3, 24, -6);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(44, 25, 14, 0.64)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(27, -8);
  ctx.quadraticCurveTo(38, -8, 50, -7);
  ctx.stroke();

  ctx.fillStyle = "rgba(25, 13, 8, 0.42)";
  ctx.beginPath();
  ctx.arc(32, -11.5, 0.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawEye() {
  ctx.fillStyle = "#f1e6d0";
  ctx.beginPath();
  ctx.ellipse(21, -16, 5.8, 6.7, -0.1, 0, Math.PI * 2);
  ctx.fill();

  const iris = ctx.createRadialGradient(22.5, -16.5, 0.6, 22, -16, 4.2);
  iris.addColorStop(0, "#51311d");
  iris.addColorStop(0.45, "#120c08");
  iris.addColorStop(1, "#020202");
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(22, -16, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(23.8, -18.2, 1.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(18, 10, 7, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(21, -16, 5.8, 6.7, -0.1, 0, Math.PI * 2);
  ctx.stroke();
}

function drawFineFeather(x, y, length, curve, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + length * 0.34, y + curve * 3, x + length, y + curve * 9);
  ctx.stroke();
  ctx.restore();
}

function drawGround(t) {
  const y = WORLD.height - WORLD.ground;
  const soil = ctx.createLinearGradient(0, y, 0, WORLD.height);
  soil.addColorStop(0, "#273d25");
  soil.addColorStop(0.14, "#61753b");
  soil.addColorStop(0.21, "#4d3926");
  soil.addColorStop(0.55, "#2e231a");
  soil.addColorStop(1, "#16100d");
  ctx.fillStyle = soil;
  ctx.fillRect(0, y, WORLD.width, WORLD.ground);

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.36;
  ctx.fillStyle = textures.groundNoise;
  ctx.fillRect(0, y, WORLD.width, WORLD.ground);
  ctx.restore();

  ctx.fillStyle = "rgba(232, 206, 148, 0.32)";
  ctx.fillRect(0, y + 9, WORLD.width, 1.5);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#0c0f0b";
  for (let i = 0; i < 42; i += 1) {
    const rockX = (i * 29 + t * 24) % WORLD.width;
    const rockY = y + 22 + ((i * 17) % 46);
    ctx.beginPath();
    ctx.ellipse(rockX, rockY, 2 + (i % 4), 1 + (i % 3), Math.sin(i), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

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

function drawScoreCounter() {
  ctx.save();
  ctx.translate(16, 16);
  ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  roundRect(0, 0, 122, 46, 14);
  const plaque = ctx.createLinearGradient(0, 0, 122, 46);
  plaque.addColorStop(0, "rgba(56, 37, 21, 0.82)");
  plaque.addColorStop(0.4, "rgba(150, 99, 49, 0.74)");
  plaque.addColorStop(0.7, "rgba(71, 53, 32, 0.84)");
  plaque.addColorStop(1, "rgba(22, 17, 12, 0.9)");
  ctx.fillStyle = plaque;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 220, 142, 0.28)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = textures.pipeNoise;
  ctx.fillRect(3, 3, 116, 40);
  ctx.restore();

  drawScrew(12, 12);
  drawScrew(110, 12);
  drawScrew(12, 34);
  drawScrew(110, 34);

  ctx.fillStyle = "rgba(255, 239, 199, 0.76)";
  ctx.font = "700 10px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("FIELD COUNT", 22, 15);

  ctx.fillStyle = "#f6d895";
  ctx.font = "900 26px Georgia, serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  ctx.fillText(String(score).padStart(2, "0"), 61, 38);
  ctx.restore();
}

function drawScrew(x, y) {
  const screw = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, 4);
  screw.addColorStop(0, "#f6d999");
  screw.addColorStop(0.45, "#7e5732");
  screw.addColorStop(1, "#15100d");
  ctx.fillStyle = screw;
  ctx.beginPath();
  ctx.arc(x, y, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(12, 8, 6, 0.5)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - 2, y);
  ctx.lineTo(x + 2, y);
  ctx.stroke();
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

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const flare = ctx.createLinearGradient(270, 72, WORLD.width, 190);
  flare.addColorStop(0, "rgba(255, 232, 180, 0.18)");
  flare.addColorStop(0.38, "rgba(255, 202, 124, 0.06)");
  flare.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = flare;
  ctx.fillRect(230, 60, 190, 170);
  ctx.restore();
}

function drawFilmGrain() {
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = textures.filmGrain;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.restore();
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
  const panelY = state === "ready" ? WORLD.height - WORLD.ground - 136 : WORLD.height * 0.3;
  const panelHeight = state === "ready" ? 112 : state === "gameover" ? 178 : 150;

  ctx.save();
  ctx.fillStyle = state === "ready" ? "rgba(5, 12, 18, 0.16)" : "rgba(5, 12, 18, 0.42)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  drawGlassPanel(WORLD.width / 2 - 150, panelY, 300, panelHeight);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fffaf0";
  ctx.font = state === "ready" ? "800 26px Inter, system-ui, sans-serif" : "800 30px Inter, system-ui, sans-serif";
  ctx.fillText(title, WORLD.width / 2, panelY + 42);

  ctx.fillStyle = "rgba(255, 250, 240, 0.78)";
  ctx.font = "600 14px Inter, system-ui, sans-serif";
  wrapText(subtitle, WORLD.width / 2, panelY + 70, 240, 20);

  if (state === "gameover") {
    ctx.fillStyle = "#ffd36a";
    ctx.font = "900 42px Inter, system-ui, sans-serif";
    ctx.fillText(String(score), WORLD.width / 2, panelY + 142);
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
    alpha: 0.2 + Math.random() * 0.28,
    blur: 2 + Math.random() * 5,
    tone: Math.random() > 0.5 ? "rgba(248, 246, 236, 0.78)" : "rgba(214, 222, 224, 0.68)",
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

function createTreeLines() {
  return [
    {
      color: "#25382f",
      alpha: 0.18,
      blur: 3.2,
      spacing: 42,
      offset: 12,
      speed: 2.4,
      base: 40,
      height: 88,
      variance: 24,
      crownW: 24,
      seed: 12,
    },
    {
      color: "#1f3327",
      alpha: 0.28,
      blur: 1.8,
      spacing: 35,
      offset: 6,
      speed: 5.8,
      base: 22,
      height: 70,
      variance: 18,
      crownW: 20,
      seed: 47,
    },
    {
      color: "#15241b",
      alpha: 0.32,
      blur: 0.8,
      spacing: 31,
      offset: 16,
      speed: 10,
      base: 10,
      height: 52,
      variance: 14,
      crownW: 17,
      seed: 89,
    },
  ];
}

function createLensDust() {
  return Array.from({ length: 24 }, (_, i) => ({
    x: 18 + Math.random() * (WORLD.width - 36),
    y: 20 + Math.random() * (WORLD.height - WORLD.ground - 40),
    radius: 0.8 + Math.random() * 2.7,
    alpha: 0.025 + Math.random() * 0.055,
    speed: 0.7 + Math.random() * 1.8,
    phase: i * 0.8 + Math.random(),
    color: Math.random() > 0.5 ? "#fff3d0" : "#d6f0ff",
  }));
}

function createTextures() {
  return {
    skyNoise: makeNoisePattern(96, 96, [
      [92, 112, 125, 25],
      [255, 235, 198, 18],
      [31, 45, 56, 16],
    ]),
    pipeNoise: makeNoisePattern(92, 92, [
      [25, 41, 31, 94],
      [112, 74, 41, 82],
      [38, 105, 83, 70],
      [224, 184, 111, 34],
    ]),
    groundNoise: makeNoisePattern(88, 88, [
      [16, 12, 8, 120],
      [80, 62, 39, 82],
      [45, 77, 35, 62],
      [190, 161, 104, 36],
    ]),
    filmGrain: makeNoisePattern(128, 128, [
      [255, 255, 255, 45],
      [0, 0, 0, 48],
    ]),
  };
}

function makeNoisePattern(width, height, palette) {
  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = width;
  patternCanvas.height = height;
  const patternCtx = patternCanvas.getContext("2d");
  const image = patternCtx.createImageData(width, height);

  for (let i = 0; i < image.data.length; i += 4) {
    const color = palette[Math.floor(Math.random() * palette.length)];
    const jitter = Math.floor(Math.random() * 38) - 19;
    image.data[i] = clamp(color[0] + jitter, 0, 255);
    image.data[i + 1] = clamp(color[1] + jitter, 0, 255);
    image.data[i + 2] = clamp(color[2] + jitter, 0, 255);
    image.data[i + 3] = clamp(color[3] * (0.35 + Math.random() * 0.65), 0, 255);
  }

  patternCtx.putImageData(image, 0, 0);

  for (let i = 0; i < 22; i += 1) {
    patternCtx.globalAlpha = 0.08 + Math.random() * 0.12;
    patternCtx.strokeStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
    patternCtx.lineWidth = 0.5 + Math.random();
    patternCtx.beginPath();
    const y = Math.random() * height;
    patternCtx.moveTo(0, y);
    patternCtx.bezierCurveTo(width * 0.3, y + Math.random() * 12 - 6, width * 0.7, y + Math.random() * 12 - 6, width, y);
    patternCtx.stroke();
  }

  return ctx.createPattern(patternCanvas, "repeat");
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
