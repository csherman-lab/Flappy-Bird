import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { COLORS } from './colors.js';

const CAMERA_BASE = { x: -2.2, y: 1.6, z: 8.8 };
const CAMERA_LOOK = { x: -1.2, y: 0.8, z: 0 };

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
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.22,
    0.35,
    0.92
  );
  composer.addPass(bloom);
  composer.bloomPass = bloom;
  return composer;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  camera.position.set(CAMERA_BASE.x, CAMERA_BASE.y, CAMERA_BASE.z);
  camera.lookAt(CAMERA_LOOK.x, CAMERA_LOOK.y, CAMERA_LOOK.z);
  return camera;
}

export function resetCamera(camera, birdY = 0.8, shakeX = 0, shakeY = 0) {
  const followY = THREE.MathUtils.lerp(CAMERA_BASE.y, CAMERA_BASE.y + birdY * 0.18, 0.35);
  camera.position.set(
    CAMERA_BASE.x + shakeX,
    followY + shakeY,
    CAMERA_BASE.z
  );
  camera.lookAt(CAMERA_LOOK.x, CAMERA_LOOK.y + birdY * 0.12, CAMERA_LOOK.z);
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

export function resizeRenderer(renderer, camera, composer) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (composer) {
    composer.setSize(w, h);
    if (composer.bloomPass) {
      composer.bloomPass.resolution.set(w, h);
    }
  }
}
