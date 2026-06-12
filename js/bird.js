import * as THREE from 'three';
import { COLORS, GAME } from './colors.js';

export class Bird {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(GAME.birdX, 0, 0);
    scene.add(this.group);

    this.velocityY = 0;
    this.rotationZ = 0;
    this.flapTimer = 0;
    this.alive = true;
    this.blinkTimer = 2 + Math.random() * 3;
    this.pupil = null;
    this.onFlap = null;

    this._buildModel();
  }

  _buildModel() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.birdBody,
      roughness: 0.55,
      metalness: 0.02,
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: COLORS.birdBelly,
      roughness: 0.6,
      metalness: 0.01,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: COLORS.birdWing,
      roughness: 0.7,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const beakMat = new THREE.MeshStandardMaterial({
      color: COLORS.birdBeak,
      roughness: 0.45,
      metalness: 0.05,
    });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: COLORS.birdEye,
      roughness: 0.3,
      metalness: 0,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: COLORS.birdPupil,
      roughness: 0.2,
      metalness: 0.1,
    });

    // Torso — plump ellipsoid like the OG round bird
    const torso = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 24, 18),
      bodyMat
    );
    torso.scale.set(1.05, 0.92, 0.88);
    torso.castShadow = true;
    this.group.add(torso);

    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 12),
      bellyMat
    );
    belly.position.set(0.02, -0.08, 0.12);
    belly.scale.set(0.85, 0.7, 0.5);
    this.group.add(belly);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 20, 16),
      bodyMat
    );
    head.position.set(0.28, 0.18, 0);
    head.castShadow = true;
    this.group.add(head);

    // Beak — orange wedge
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.32, 8),
      beakMat
    );
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.58, 0.16, 0);
    beak.castShadow = true;
    this.group.add(beak);

    // Eye
    const eyeWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10),
      eyeWhiteMat
    );
    eyeWhite.position.set(0.38, 0.28, 0.14);
    this.group.add(eyeWhite);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 10, 8),
      pupilMat
    );
    pupil.position.set(0.44, 0.28, 0.2);
    this.group.add(pupil);
    this.pupil = pupil;

    // Cheek highlight (OG white patch)
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 8),
      wingMat
    );
    cheek.position.set(0.32, 0.1, 0.18);
    cheek.scale.set(1.2, 0.8, 0.6);
    this.group.add(cheek);

    // Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.quadraticCurveTo(0.35, 0.15, 0.55, -0.05);
    wingShape.quadraticCurveTo(0.4, -0.25, 0, -0.15);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });

    this.wing = new THREE.Mesh(wingGeo, wingMat);
    this.wing.position.set(-0.05, 0.02, 0.18);
    this.wing.rotation.y = Math.PI / 2;
    this.wing.castShadow = true;
    this.group.add(this.wing);

    this.wingBack = this.wing.clone();
    this.wingBack.position.z = -0.18;
    this.wingBack.rotation.y = -Math.PI / 2;
    this.group.add(this.wingBack);

    // Tail feathers
    for (let i = 0; i < 3; i++) {
      const feather = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.04, 0.02),
        wingMat
      );
      feather.position.set(-0.42, -0.02 + i * 0.06, (i - 1) * 0.05);
      feather.rotation.z = 0.25 + i * 0.08;
      feather.castShadow = true;
      this.group.add(feather);
    }
  }

  flap() {
    this.velocityY = GAME.flapVelocity;
    this.flapTimer = 0.18;
    if (this.onFlap) {
      this.onFlap(this.group.position.x, this.group.position.y, this.group.position.z);
    }
  }

  reset() {
    this.group.position.y = 1.5;
    this.velocityY = 0;
    this.rotationZ = 0;
    this.flapTimer = 0;
    this.alive = true;
    this.group.rotation.z = 0;
  }

  update(dt) {
    if (!this.alive) return;

    this.velocityY += GAME.gravity * dt;
    this.group.position.y += this.velocityY * dt;

    const targetRot = THREE.MathUtils.clamp(this.velocityY * 0.055, -0.6, 0.85);
    this.rotationZ = THREE.MathUtils.lerp(this.rotationZ, targetRot, dt * 8);
    this.group.rotation.z = this.rotationZ;

    if (this.flapTimer > 0) {
      this.flapTimer -= dt;
      const flapPhase = this.flapTimer / 0.18;
      const wingAngle = -0.9 * flapPhase;
      this.wing.rotation.x = wingAngle;
      this.wingBack.rotation.x = -wingAngle;
    } else {
      this.wing.rotation.x = THREE.MathUtils.lerp(this.wing.rotation.x, 0.15, dt * 6);
      this.wingBack.rotation.x = THREE.MathUtils.lerp(this.wingBack.rotation.x, -0.15, dt * 6);
    }

    this.blinkTimer -= dt;
    if (this.pupil) {
      if (this.blinkTimer <= 0 && this.blinkTimer > -0.12) {
        this.pupil.scale.y = 0.15;
      } else if (this.blinkTimer <= -0.12) {
        this.pupil.scale.y = 1;
        this.blinkTimer = 2.5 + Math.random() * 4;
      } else {
        this.pupil.scale.y = 1;
      }
    }
  }

  getCollisionSphere() {
    return {
      x: this.group.position.x,
      y: this.group.position.y,
      z: this.group.position.z,
      radius: GAME.birdRadius,
    };
  }

  die() {
    this.alive = false;
    this.deathSpin = 0;
  }

  updateDeath(dt) {
    this.velocityY += GAME.gravity * dt * 1.2;
    this.group.position.y += this.velocityY * dt;
    this.deathSpin = (this.deathSpin || 0) + dt * 4;
    this.group.rotation.z = -Math.PI / 2 + Math.sin(this.deathSpin) * 0.15;
    this.group.position.y = Math.max(this.group.position.y, GAME.groundY + 0.5);
  }
}
