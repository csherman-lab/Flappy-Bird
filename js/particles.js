import * as THREE from 'three';
import { COLORS } from './colors.js';

const MAX_PARTICLES = 120;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.group = new THREE.Group();
    scene.add(this.group);

    const geo = new THREE.PlaneGeometry(0.12, 0.12);
    this._mats = {
      feather: new THREE.MeshBasicMaterial({
        color: COLORS.birdWing,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      yellow: new THREE.MeshBasicMaterial({
        color: COLORS.birdBody,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      spark: new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      dust: new THREE.MeshBasicMaterial({
        color: COLORS.dirt,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    };

    this._pool = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mesh = new THREE.Mesh(geo, this._mats.feather.clone());
      mesh.visible = false;
      this.group.add(mesh);
      this._pool.push(mesh);
    }
  }

  _acquire(matKey) {
    const mesh = this._pool.find((m) => !m.visible);
    if (!mesh) return null;
    mesh.visible = true;
    mesh.material = this._mats[matKey];
    mesh.scale.setScalar(1);
    mesh.rotation.set(0, 0, 0);
    return mesh;
  }

  burstFeathers(x, y, z, count = 14) {
    for (let i = 0; i < count; i++) {
      const mesh = this._acquire(i % 3 === 0 ? 'yellow' : 'feather');
      if (!mesh) break;
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(0.4 + Math.random() * 0.5);
      mesh.rotation.z = Math.random() * Math.PI;
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 5,
        vz: (Math.random() - 0.5) * 3,
        life: 0.6 + Math.random() * 0.5,
        rotSpeed: (Math.random() - 0.5) * 10,
        gravity: -12,
      });
    }
  }

  burstScore(x, y, z) {
    for (let i = 0; i < 8; i++) {
      const mesh = this._acquire('spark');
      if (!mesh) break;
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(0.25 + Math.random() * 0.2);
      const angle = (i / 8) * Math.PI * 2;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3 + 1,
        vz: (Math.random() - 0.5) * 2,
        life: 0.35,
        rotSpeed: 0,
        gravity: 0,
      });
    }
  }

  dustPuff(x, y, z) {
    for (let i = 0; i < 6; i++) {
      const mesh = this._acquire('dust');
      if (!mesh) break;
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(0.3 + Math.random() * 0.4);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 2,
        vy: 1 + Math.random() * 2,
        vz: (Math.random() - 0.5) * 1,
        life: 0.4 + Math.random() * 0.2,
        rotSpeed: 0,
        gravity: -4,
      });
    }
  }

  flapTrail(x, y, z) {
    const mesh = this._acquire('feather');
    if (!mesh) return;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(0.2);
    this.particles.push({
      mesh,
      vx: -1.5 + Math.random() * 0.5,
      vy: (Math.random() - 0.5) * 1,
      vz: (Math.random() - 0.5) * 0.5,
      life: 0.2,
      rotSpeed: 5,
      gravity: 0,
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.z += p.rotSpeed * dt;
      p.mesh.material.opacity = Math.min(1, p.life * 2);
      p.mesh.scale.multiplyScalar(1 - dt * 0.5);
    }
  }

  clear() {
    this.particles.forEach((p) => { p.mesh.visible = false; });
    this.particles = [];
  }
}
