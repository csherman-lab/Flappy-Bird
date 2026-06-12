import * as THREE from 'three';
import { COLORS, GAME } from './colors.js';

function createGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#73BF2E';
  ctx.fillRect(0, 0, 512, 64);

  for (let i = 0; i < 800; i++) {
    const x = Math.random() * 512;
    const h = 4 + Math.random() * 14;
    const shade = Math.random() > 0.5 ? '#8ED63F' : '#5A9624';
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, -h);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(24, 1);
  return tex;
}

function createDirtTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#DED895';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = Math.random() > 0.5 ? '#C4B87A' : '#E8E0A8';
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 2);
  return tex;
}

function createCloudCluster() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: COLORS.cloud,
    roughness: 0.95,
    metalness: 0,
    emissive: 0xffffff,
    emissiveIntensity: 0.08,
  });

  const blobs = [
    [0, 0, 0, 1.1],
    [0.9, 0.15, 0, 0.85],
    [-0.85, 0.1, 0.1, 0.75],
    [0.4, 0.35, 0.2, 0.65],
    [-0.35, 0.25, -0.15, 0.7],
  ];

  blobs.forEach(([x, y, z, s]) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 12), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  });

  return group;
}

function createBuilding(width, height, depth) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: COLORS.building,
    roughness: 0.85,
    metalness: 0.05,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: COLORS.buildingDark,
    roughness: 0.9,
    metalness: 0.05,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
  body.position.y = height / 2;
  group.add(body);

  const rows = Math.floor(height / 0.55);
  const cols = Math.floor(width / 0.45);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() > 0.35) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), darkMat);
      win.position.set(
        -width / 2 + 0.35 + c * 0.45,
        0.5 + r * 0.55,
        depth / 2 + 0.01
      );
      group.add(win);
    }
  }

  return group;
}

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.buildings = [];
    this.groundOffset = 0;
    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildSky();
    this._buildGround();
    this._buildClouds();
    this._buildCityscape();
  }

  _buildSky() {
    const skyGeo = new THREE.SphereGeometry(120, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(COLORS.skyTop) },
        bottomColor: { value: new THREE.Color(COLORS.skyBottom) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;
          gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(sky);
  }

  _buildGround() {
    this.groundGroup = new THREE.Group();

    const grassTex = createGrassTexture();
    const dirtTex = createDirtTexture();

    const grassMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0,
    });
    const dirtMat = new THREE.MeshStandardMaterial({
      map: dirtTex,
      color: 0xffffff,
      roughness: 0.98,
      metalness: 0,
    });

    this.grassMesh = new THREE.Mesh(
      new THREE.BoxGeometry(200, 0.35, 8),
      grassMat
    );
    this.grassMesh.position.set(0, GAME.groundY + 0.18, -1);
    this.grassMesh.receiveShadow = true;
    this.grassMesh.castShadow = true;

    this.dirtMesh = new THREE.Mesh(
      new THREE.BoxGeometry(200, 1.8, 8),
      dirtMat
    );
    this.dirtMesh.position.set(0, GAME.groundY - 0.72, -1);
    this.dirtMesh.receiveShadow = true;

    this.groundGroup.add(this.dirtMesh);
    this.groundGroup.add(this.grassMesh);
    this.group.add(this.groundGroup);

    this.grassTex = grassTex;
    this.dirtTex = dirtTex;
    this._buildGrassBlades();
  }

  _buildGrassBlades() {
    const bladeGeo = new THREE.PlaneGeometry(0.08, 0.35);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: COLORS.grassDark,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const count = 180;
    const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      dummy.position.set(
        -40 + Math.random() * 80,
        GAME.groundY + 0.38,
        -2 + Math.random() * 4
      );
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.rotation.z = (Math.random() - 0.5) * 0.4;
      dummy.scale.setScalar(0.6 + Math.random() * 0.8);
      dummy.updateMatrix();
      blades.setMatrixAt(i, dummy.matrix);
    }
    blades.instanceMatrix.needsUpdate = true;
    blades.castShadow = true;
    this.grassBlades = blades;
    this.groundGroup.add(blades);
  }

  _buildClouds() {
    const positions = [
      [-8, 5.5, -12],
      [2, 6.8, -15],
      [14, 5.2, -10],
      [-18, 7.2, -18],
      [22, 6.0, -14],
      [-4, 8.5, -20],
      [30, 5.8, -16],
    ];

    positions.forEach(([x, y, z], i) => {
      const cloud = createCloudCluster();
      cloud.position.set(x, y, z);
      cloud.scale.setScalar(1.2 + (i % 3) * 0.35);
      cloud.userData.speed = 0.15 + (i % 4) * 0.08;
      cloud.userData.baseX = x;
      this.clouds.push(cloud);
      this.group.add(cloud);
    });
  }

  _buildCityscape() {
    const skyline = new THREE.Group();
    skyline.position.set(0, GAME.groundY, -8);

    const specs = [
      [2.2, 3.5, 1.8, -35],
      [1.8, 5.2, 1.5, -28],
      [2.5, 2.8, 2.0, -22],
      [1.5, 6.5, 1.4, -16],
      [2.0, 4.0, 1.6, -10],
      [1.7, 3.2, 1.5, -4],
      [2.3, 5.8, 1.7, 3],
      [1.6, 2.5, 1.4, 9],
      [2.1, 4.5, 1.8, 16],
      [1.9, 7.0, 1.5, 23],
      [2.4, 3.8, 1.9, 30],
      [1.8, 5.0, 1.6, 37],
    ];

    specs.forEach(([w, h, d, x]) => {
      const b = createBuilding(w, h, d);
      b.position.set(x, 0, 0);
      skyline.add(b);
      this.buildings.push({ mesh: b, x });
    });

    this.skyline = skyline;
    this.group.add(skyline);
  }

  update(dt, scrollSpeed) {
    this.groundOffset += scrollSpeed * dt;
    if (this.grassTex) this.grassTex.offset.x = this.groundOffset * 0.12;
    if (this.dirtTex) this.dirtTex.offset.x = this.groundOffset * 0.12;

    this.clouds.forEach((cloud) => {
      cloud.position.x -= cloud.userData.speed * dt;
      if (cloud.position.x < -40) {
        cloud.position.x = 45 + Math.random() * 15;
      }
    });

    if (this.skyline) {
      this.skyline.position.x -= scrollSpeed * dt * 0.15;
      if (this.skyline.position.x < -20) {
        this.skyline.position.x += 20;
      }
    }
  }
}
