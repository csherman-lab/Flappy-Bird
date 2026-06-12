import * as THREE from 'three';
import { GAME } from './colors.js';
import { Bird } from './bird.js';
import { PipeManager } from './pipes.js';
import { Environment } from './environment.js';
import { AudioManager } from './audio.js';
import { ParticleSystem } from './particles.js';
import { getMedal } from './medals.js';
import {
  createScene,
  createCamera,
  createRenderer,
  createComposer,
  createLights,
  resizeRenderer,
  resetCamera,
} from './scene.js';

const STATES = {
  READY: 'ready',
  GET_READY: 'get_ready',
  PLAYING: 'playing',
  DEAD: 'dead',
};

const GET_READY_DURATION = 1.4;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = STATES.READY;
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('flappy3d-best') || '0', 10);
    this.clock = new THREE.Clock();
    this.shakeTimer = 0;
    this.scorePopTimer = 0;
    this.flashTimer = 0;
    this.flashColor = '';
    this.getReadyTimer = 0;
    this.pipeSpeed = GAME.pipeSpeed;

    this.audio = new AudioManager();
    this.renderer = createRenderer(canvas);
    this.scene = createScene();
    this.camera = createCamera();
    this.composer = createComposer(this.renderer, this.scene, this.camera);
    this.lights = createLights(this.scene);

    this.environment = new Environment(this.scene);
    this.bird = new Bird(this.scene);
    this.pipes = new PipeManager(this.scene);
    this.particles = new ParticleSystem(this.scene);

    this.bird.onFlap = (x, y, z) => {
      this.audio.flap();
      if (this.state === STATES.PLAYING) {
        this.particles.flapTrail(x, y, z);
      }
    };

    this.ui = {
      overlay: document.getElementById('overlay'),
      title: document.getElementById('title'),
      subtitle: document.getElementById('subtitle'),
      score: document.getElementById('score'),
      best: document.getElementById('best'),
      gameover: document.getElementById('gameover'),
      finalScore: document.getElementById('final-score'),
      getReady: document.getElementById('get-ready'),
      medal: document.getElementById('medal'),
      medalLabel: document.getElementById('medal-label'),
      flash: document.getElementById('screen-flash'),
      muteBtn: document.getElementById('mute-btn'),
    };

    resizeRenderer(this.renderer, this.camera, this.composer);
    window.addEventListener('resize', () =>
      resizeRenderer(this.renderer, this.camera, this.composer)
    );

    this._bindInput();
    this._updateUI();
    this.pipes.reset();
    this.bird.reset();

    if (this.audio.isMuted()) {
      this.ui.muteBtn.textContent = '🔇';
      this.ui.muteBtn.classList.add('muted');
    }

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
      if (e.code === 'KeyM') this._toggleMute();
    });
    this.canvas.addEventListener('pointerdown', action);
    window.addEventListener('touchstart', action, { passive: false });

    this.ui.muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleMute();
    });
  }

  _toggleMute() {
    const muted = this.audio.toggleMute();
    this.ui.muteBtn.textContent = muted ? '🔇' : '🔊';
    this.ui.muteBtn.classList.toggle('muted', muted);
  }

  _onAction() {
    if (this.state === STATES.READY) {
      this.state = STATES.GET_READY;
      this.getReadyTimer = GET_READY_DURATION;
      this.bird.flap();
      this._updateUI();
      this.audio.swoosh();
      return;
    }
    if (this.state === STATES.GET_READY || this.state === STATES.PLAYING) {
      this.bird.flap();
      if (this.state === STATES.GET_READY) {
        this.state = STATES.PLAYING;
        this.ui.getReady.classList.add('hidden');
      }
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
    this.pipeSpeed = GAME.pipeSpeed;
    this.particles.clear();
    this.bird.reset();
    this.pipes.reset();
    this._updateUI();
  }

  _getPipeSpeed() {
    return GAME.pipeSpeed + Math.floor(this.score / 5) * 0.35;
  }

  _flash(color, duration = 0.15) {
    this.flashColor = color;
    this.flashTimer = duration;
    this.ui.flash.style.background = color;
    this.ui.flash.classList.add('active');
  }

  _gameOver() {
    this.state = STATES.DEAD;
    this.bird.die();
    this.shakeTimer = 0.45;
    this.audio.hit();
    this._flash('rgba(255,80,60,0.35)', 0.3);
    const pos = this.bird.group.position;
    this.particles.burstFeathers(pos.x, pos.y, pos.z);
    if (pos.y < GAME.groundY + 1.5) {
      this.particles.dustPuff(pos.x, GAME.groundY + 0.4, pos.z);
    }
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('flappy3d-best', String(this.bestScore));
    }
    this._updateUI();
  }

  _updateUI() {
    const {
      overlay, title, subtitle, score, best, gameover,
      finalScore, getReady, medal, medalLabel,
    } = this.ui;

    score.textContent = String(this.score);
    best.textContent = `BEST ${this.bestScore}`;

    if (this.state === STATES.READY) {
      overlay.classList.remove('hidden');
      title.textContent = 'FLAPPY BIRD';
      subtitle.textContent = 'TAP OR SPACE TO START';
      gameover.classList.add('hidden');
      getReady.classList.add('hidden');
      medal.classList.add('hidden');
    } else if (this.state === STATES.GET_READY) {
      overlay.classList.add('hidden');
      getReady.classList.remove('hidden');
      gameover.classList.add('hidden');
    } else if (this.state === STATES.PLAYING) {
      overlay.classList.add('hidden');
      getReady.classList.add('hidden');
      gameover.classList.add('hidden');
    } else {
      overlay.classList.remove('hidden');
      title.textContent = 'GAME OVER';
      subtitle.textContent = 'TAP TO RETRY';
      gameover.classList.remove('hidden');
      getReady.classList.add('hidden');
      finalScore.textContent = String(this.score);

      const m = getMedal(this.score);
      if (m) {
        medal.classList.remove('hidden');
        medal.className = `medal medal-${m.id}`;
        medalLabel.textContent = m.label;
        medalLabel.style.color = m.color;
      } else {
        medal.classList.add('hidden');
      }
    }
  }

  _loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === STATES.GET_READY) {
      this.getReadyTimer -= dt;
      this.bird.update(dt);
      this.environment.update(dt, 0);
      if (this.getReadyTimer <= 0) {
        this.state = STATES.PLAYING;
        this.ui.getReady.classList.add('hidden');
      }
    } else if (this.state === STATES.PLAYING) {
      this.pipeSpeed = this._getPipeSpeed();
      this.bird.update(dt);
      this.pipes.update(dt, this.pipeSpeed);
      this.environment.update(dt, this.pipeSpeed);

      const scoreEvents = this.pipes.checkScore(this.bird.group.position.x);
      if (scoreEvents.length > 0) {
        this.score += scoreEvents.length;
        this.scorePopTimer = 0.25;
        this.audio.score();
        this._flash('rgba(255,255,255,0.12)', 0.1);
        scoreEvents.forEach((e) => this.particles.burstScore(e.x, e.y, e.z));
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

    this.particles.update(dt);

    if (this.scorePopTimer > 0) {
      this.scorePopTimer -= dt;
      this.ui.score.style.transform = `scale(${1 + this.scorePopTimer * 0.8})`;
    } else {
      this.ui.score.style.transform = '';
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.ui.flash.classList.remove('active');
      }
    }

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const intensity = this.shakeTimer * 0.12;
      shakeX = (Math.random() - 0.5) * intensity;
      shakeY = (Math.random() - 0.5) * intensity;
    }

    const birdY = this.bird.group.position.y;
    resetCamera(this.camera, birdY, shakeX, shakeY);

    this.composer.render();
    requestAnimationFrame(this._loop);
  }
}
