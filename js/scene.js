import * as THREE from 'three';
import { COLORS } from './colors.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  camera.position.set(-2.2, 1.6, 8.8);
  camera.lookAt(-1.2, 0.8, 0);
  return camera;
}

export function createLights(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(COLORS.skyTop, COLORS.grassDark, 0.35);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.35);
  sun.position.set(8, 18, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xb8f0ff, 0.25);
  fill.position.set(-6, 4, 8);
  scene.add(fill);

  return { sun };
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(COLORS.fog, 18, 55);
  return scene;
}

export function resizeRenderer(renderer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
