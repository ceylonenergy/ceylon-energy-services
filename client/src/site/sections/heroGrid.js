/**
 * The hero's Three.js scene. A separate module with named imports so
 * the bundler only includes the parts of Three.js actually used, and so
 * it is downloaded after the rest of the page.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Plane,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { prefersReducedMotion } from '../motion.js';

export function startGrid(mount) {
  let W = mount.clientWidth;
  let H = mount.clientHeight;
  const scene = new Scene();
  const camera = new PerspectiveCamera(52, W / H, 0.1, 100);
  camera.position.set(0, 0, 14);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(W, H);
  mount.appendChild(renderer.domElement);

  /* ---- node field ---- */
  const isMobile = W < 720;
  const COUNT = prefersReducedMotion() ? 0 : isMobile ? 46 : 100;
  const BOUND = { x: 11, y: 6, z: 4 };

  const rest = [];
  const initial = [];
  for (let i = 0; i < COUNT; i++) {
    const p = {
      x: (Math.random() * 2 - 1) * BOUND.x,
      y: (Math.random() * 2 - 1) * BOUND.y,
      z: (Math.random() * 2 - 1) * BOUND.z,
      phase: Math.random() * Math.PI * 2,
    };
    rest.push(p);
    initial.push(p.x, p.y, p.z);
  }

  const textures = [];
  function makeDot(color) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new CanvasTexture(c);
    textures.push(tex);
    return tex;
  }

  const pointsGeo = new BufferGeometry();
  pointsGeo.setAttribute('position', new BufferAttribute(new Float32Array(initial), 3));
  const pointsMat = new PointsMaterial({
    size: isMobile ? 0.22 : 0.26,
    map: makeDot('rgba(255,255,255,1)'),
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  });
  scene.add(new Points(pointsGeo, pointsMat));

  /* ---- edges between nearby nodes (computed once on the rest layout) ---- */
  const edges = [];
  const maxDist = isMobile ? 3.4 : 3.1;
  for (let a = 0; a < COUNT; a++) {
    for (let b = a + 1; b < COUNT; b++) {
      const d = Math.hypot(rest[a].x - rest[b].x, rest[a].y - rest[b].y, rest[a].z - rest[b].z);
      if (d < maxDist) edges.push([a, b, d]);
    }
  }
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new BufferAttribute(new Float32Array(edges.length * 6), 3));
  const lineMat = new LineBasicMaterial({ color: 0xdff2fc, transparent: true, opacity: 0.28 });
  scene.add(new LineSegments(lineGeo, lineMat));

  /* ---- pulses travelling along the shortest edges ---- */
  const pulseEdges = [...edges].sort((x, y) => x[2] - y[2]).slice(0, isMobile ? 8 : 16);
  const pulseGeo = new BufferGeometry();
  pulseGeo.setAttribute('position', new BufferAttribute(new Float32Array(pulseEdges.length * 3), 3));
  const pulseMat = new PointsMaterial({
    size: isMobile ? 0.34 : 0.4,
    map: makeDot('rgba(120,207,255,1)'),
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  });
  scene.add(new Points(pulseGeo, pulseMat));
  const pulseT = pulseEdges.map(() => Math.random());

  /* ---- pointer ---- */
  const mouse = new Vector2(0, 0);
  const mouseWorld = new Vector3(9999, 9999, 0);
  const raycaster = new Raycaster();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  let targetCamX = 0;
  let targetCamY = 0;

  function onMove(clientX, clientY) {
    const r = mount.getBoundingClientRect();
    mouse.x = ((clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hit = new Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) mouseWorld.copy(hit);
    targetCamX = mouse.x * 0.6;
    targetCamY = mouse.y * 0.35;
  }
  const onMouseMove = (e) => onMove(e.clientX, e.clientY);
  const onTouchMove = (e) => e.touches?.[0] && onMove(e.touches[0].clientX, e.touches[0].clientY);
  const onResize = () => {
    W = mount.clientWidth;
    H = mount.clientHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('resize', onResize);

  /* ---- animation loop ---- */
  const REPEL_RADIUS = 3.2;
  const REPEL_STRENGTH = 1.6;
  const startedAt = performance.now();
  let frame = 0;
  // Pause while the hero is scrolled out of view: no point burning the
  // battery drawing something nobody can see.
  let visible = true;
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  observer.observe(mount);

  function animate() {
    frame = requestAnimationFrame(animate);
    if (!visible) return;
    const t = (performance.now() - startedAt) / 1000;

    camera.position.x += (targetCamX - camera.position.x) * 0.03;
    camera.position.y += (targetCamY - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    const arr = pointsGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      let rx = rest[i].x + Math.sin(t * 0.3 + rest[i].phase) * 0.35;
      let ry = rest[i].y + Math.cos(t * 0.25 + rest[i].phase) * 0.35;
      const dx = rx - mouseWorld.x;
      const dy = ry - mouseWorld.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < REPEL_RADIUS) {
        const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
        rx += (dx / (dist || 1)) * force;
        ry += (dy / (dist || 1)) * force;
      }
      arr[i * 3] = rx;
      arr[i * 3 + 1] = ry;
      arr[i * 3 + 2] = rest[i].z;
    }
    pointsGeo.attributes.position.needsUpdate = true;

    const larr = lineGeo.attributes.position.array;
    for (let e = 0; e < edges.length; e++) {
      const ai = edges[e][0] * 3;
      const bi = edges[e][1] * 3;
      const li = e * 6;
      larr[li] = arr[ai];
      larr[li + 1] = arr[ai + 1];
      larr[li + 2] = arr[ai + 2];
      larr[li + 3] = arr[bi];
      larr[li + 4] = arr[bi + 1];
      larr[li + 5] = arr[bi + 2];
    }
    lineGeo.attributes.position.needsUpdate = true;

    const parr = pulseGeo.attributes.position.array;
    for (let p = 0; p < pulseEdges.length; p++) {
      pulseT[p] += 0.0035;
      if (pulseT[p] > 1) pulseT[p] = 0;
      const ai = pulseEdges[p][0] * 3;
      const bi = pulseEdges[p][1] * 3;
      for (let k = 0; k < 3; k++) parr[p * 3 + k] = arr[ai + k] + (arr[bi + k] - arr[ai + k]) * pulseT[p];
    }
    pulseGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }
  animate();

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('resize', onResize);
    [pointsGeo, lineGeo, pulseGeo, pointsMat, lineMat, pulseMat, ...textures].forEach((o) => o.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  };
}
