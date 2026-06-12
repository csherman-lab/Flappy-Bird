import * as THREE from 'three';
import { GAME } from './colors.js';
import { Bird } from './bird.js';
import { PipeManager } from './pipes.js';
import { Environment } from './environment.js';
import {
  createScene,
  createCamera,
  createRenderer,
  createLights,
  resizeRenderer,
} from './scene.js';

const STATES = {
  READY: 'ready',
  PLAYING: 'playing',
  DEAD: 'dead',
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = STATES.READY;
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('flappy3d-best') || '0', 10);
    this.clock = new THREE.Clock();
    this.shakeTimer = 0;
    this.scorePopTimer = 0;

    this.renderer = createRenderer(canvas);
    this.scene = createScene();
    this.camera = createCamera();
    this.lights = createLights(this.scene);

    this.environment = new Environment(this.scene);
    this.bird = new Bird(this.scene);
    this.pipes = new PipeManager(this.scene);

    this.ui = {
      overlay: document.getElementById('overlay'),
      title: document.getElementById('title'),
      subtitle: document.getElementById('subtitle'),
      score: document.getElementById('score'),
      best: document.getElementById('best'),
      gameover: document.getElementById('gameover'),
      finalScore: document.getElementById('final-score'),
    };

    resizeRenderer(this.renderer, this.camera);
    window.addEventListener('resize', () => resizeRenderer(this.renderer, this.camera));

    this._bindInput();
    this._updateUI();
    this.pipes.reset();
    this.bird.reset();

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _bindInput() {
    const action = (e) => {
      e.preventDefault();
      this._onAction();
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') action(e);
    });
    this.canvas.addEventListener('pointerdown', action);
    window.addEventListener('touchstart', action, { passive: false });
  }

  _onAction() {
    if (this.state === STATES.READY) {
      this.state = STATES.PLAYING;
      this.bird.flap();
      this._updateUI();
      return;
    }
    if (this.state === STATES.PLAYING) {
      this.bird.flap();
      return;
    }
    if (this.state === STATES.DEAD) {
      this._restart();
    }
  }

  _restart() {
    this.score = 0;
    this.state = STATES.READY;
    this.shakeTimer = 0;
    this.bird.reset();
    this.pipes.reset();
    this._updateUI();
  }

  _gameOver() {
    this.state = STATES.DEAD;
    this.bird.die();
    this.shakeTimer = 0.35;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('flappy3d-best', String(this.bestScore));
    }
    this._updateUI();
  }

  _updateUI() {
    const { overlay, title, subtitle, score, best, gameover, finalScore } = this.ui;

    score.textContent = String(this.score);
    best.textContent = `BEST ${this.bestScore}`;

    if (this.state === STATES.READY) {
      overlay.classList.remove('hidden');
      title.textContent = 'FLAPPY BIRD';
      subtitle.textContent = 'TAP OR SPACE TO START';
      gameover.classList.add('hidden');
    } else if (this.state === STATES.PLAYING) {
      overlay.classList.add('hidden');
      gameover.classList.add('hidden');
    } else {
      overlay.classList.remove('hidden');
      title.textContent = 'GAME OVER';
      subtitle.textContent = 'TAP TO RETRY';
      gameover.classList.remove('hidden');
      finalScore.textContent = String(this.score);
    }
  }

  _loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === STATES.PLAYING) {
      this.bird.update(dt);
      this.pipes.update(dt, GAME.pipeSpeed);
      this.environment.update(dt, GAME.pipeSpeed);

      const scored = this.pipes.checkScore(this.bird.group.position.x);
      if (scored > 0) {
        this.score += scored;
        this.scorePopTimer = 0.25;
        this._updateUI();
      }

      if (this.pipes.checkCollision(this.bird.getCollisionSphere())) {
        this._gameOver();
      }
    } else if (this.state === STATES.DEAD) {
      this.environment.update(dt, 0);
      this.bird.updateDeath(dt);
    } else {
      this.environment.update(dt, 1.2);
      this.bird.group.position.y = 1.5 + Math.sin(performance.now() * 0.002) * 0.15;
      this.bird.group.rotation.z = Math.sin(performance.now() * 0.003) * 0.05;
    }

    if (this.scorePopTimer > 0) {
      this.scorePopTimer -= dt;
      const scale = 1 + this.scorePopTimer * 0.8;
      this.ui.score.style.transform = `scale(${scale})`;
    } else {
      this.ui.score.style.transform = '';
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const intensity = this.shakeTimer * 0.12;
      this.camera.position.x = -2.2 + (Math.random() - 0.5) * intensity;
      this.camera.position.y = 1.6 + (Math.random() - 0.5) * intensity;
    } else {
      this.camera.position.set(-2.2, 1.6, 8.8);
      this.camera.lookAt(-1.2, 0.8, 0);
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
}
