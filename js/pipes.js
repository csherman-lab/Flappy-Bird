import * as THREE from 'three';
import { COLORS, GAME } from './colors.js';

function createPipeSegment(height, isTop) {
  const group = new THREE.Group();
  const w = GAME.pipeWidth;

  const pipeMat = new THREE.MeshStandardMaterial({
    color: COLORS.pipe,
    roughness: 0.35,
    metalness: 0.12,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: COLORS.pipeRim,
    roughness: 0.28,
    metalness: 0.18,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: COLORS.pipeDark,
    roughness: 0.4,
    metalness: 0.1,
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.46, w * 0.46, height, 24, 1, false),
    pipeMat
  );
  body.castShadow = true;
  body.receiveShadow = true;

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.54, w * 0.5, 0.28, 24),
    rimMat
  );
  rim.castShadow = true;

  const innerRim = new THREE.Mesh(
    new THREE.TorusGeometry(w * 0.42, 0.06, 8, 24),
    darkMat
  );
  innerRim.rotation.x = Math.PI / 2;

  if (isTop) {
    body.position.y = -height / 2;
    rim.position.y = -height;
    innerRim.position.y = -height + 0.05;
    group.add(body, rim, innerRim);
  } else {
    body.position.y = height / 2;
    rim.position.y = height;
    innerRim.position.y = height - 0.05;
    group.add(body, rim, innerRim);
  }

  // Subtle highlight stripe like OG pipe shading
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, height, 0.02),
    new THREE.MeshStandardMaterial({
      color: COLORS.pipeHighlight,
      roughness: 0.25,
      metalness: 0.2,
      transparent: true,
      opacity: 0.35,
    })
  );
  stripe.position.set(-w * 0.35, isTop ? -height / 2 : height / 2, w * 0.44);
  group.add(stripe);

  return group;
}

class PipePair {
  constructor(x) {
    this.x = x;
    this.passed = false;
    this.group = new THREE.Group();
    this.group.position.x = x;

    const gapCenter = this._randomGapCenter();
    const topHeight = 14 - gapCenter - GAME.pipeGap / 2;
    const bottomHeight = gapCenter - GAME.pipeGap / 2 - GAME.groundY;

    this.topPipe = createPipeSegment(topHeight, true);
    this.topPipe.position.y = 14;
    this.bottomPipe = createPipeSegment(bottomHeight, false);
    this.bottomPipe.position.y = GAME.groundY;

    this.gapCenter = gapCenter;
    this.group.add(this.topPipe, this.bottomPipe);
  }

  _randomGapCenter() {
    const min = GAME.groundY + GAME.pipeGap / 2 + 1.2;
    const max = 5.5;
    return min + Math.random() * (max - min);
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.group.position.x = this.x;
  }

  isOffScreen() {
    return this.x < -12;
  }

  getColliders() {
    const w = GAME.pipeWidth * 0.48;
    const topBox = {
      minX: this.x - w,
      maxX: this.x + w,
      minY: this.gapCenter + GAME.pipeGap / 2,
      maxY: 20,
    };
    const bottomBox = {
      minX: this.x - w,
      maxX: this.x + w,
      minY: GAME.groundY,
      maxY: this.gapCenter - GAME.pipeGap / 2,
    };
    return [topBox, bottomBox];
  }
}

export class PipeManager {
  constructor(scene) {
    this.scene = scene;
    this.pipes = [];
    this.spawnTimer = 0;
    this.nextSpawnX = 14;
  }

  reset() {
    this.pipes.forEach((p) => this.scene.remove(p.group));
    this.pipes = [];
    this.spawnTimer = 0;
    this.nextSpawnX = 14;
    this._spawnPipe(14);
    this._spawnPipe(14 + GAME.pipeSpacing);
  }

  _spawnPipe(x) {
    const pipe = new PipePair(x);
    this.pipes.push(pipe);
    this.scene.add(pipe.group);
  }

  update(dt, speed) {
    this.spawnTimer += dt;

    const lastPipe = this.pipes[this.pipes.length - 1];
    if (!lastPipe || lastPipe.x < 14 - GAME.pipeSpacing) {
      const spawnX = lastPipe ? lastPipe.x + GAME.pipeSpacing : 14;
      this._spawnPipe(spawnX);
    }

    this.pipes.forEach((pipe) => pipe.update(dt, speed));

    const removed = this.pipes.filter((p) => p.isOffScreen());
    removed.forEach((p) => {
      this.scene.remove(p.group);
    });
    this.pipes = this.pipes.filter((p) => !p.isOffScreen());
  }

  checkCollision(birdSphere) {
    const { x, y, radius } = birdSphere;

    if (y - radius <= GAME.groundY + 0.35) return true;
    if (y + radius >= 12) return true;

    for (const pipe of this.pipes) {
      for (const box of pipe.getColliders()) {
        const cx = THREE.MathUtils.clamp(x, box.minX, box.maxX);
        const cy = THREE.MathUtils.clamp(y, box.minY, box.maxY);
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
    return false;
  }

  checkScore(birdX) {
    let scored = 0;
    for (const pipe of this.pipes) {
      if (!pipe.passed && pipe.x + GAME.pipeWidth < birdX) {
        pipe.passed = true;
        scored++;
      }
    }
    return scored;
  }
}
