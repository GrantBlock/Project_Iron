// The 3D viewer (L06, D8): Three.js renders a GLB on a canvas with orbit (drag), pan (right
// drag or Shift + drag), zoom (wheel) and fit to view; a part can be selected and highlighted,
// from the parts list or by clicking it in the viewer. Takes the GLB as bytes or as a local
// URL, so L08 can show files from disk. Renders on demand only (no animation loop).
// Loaded with a dynamic import, so Three.js is fetched (locally) only when a model opens.
import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface ViewerPart {
  readonly name: string;
  readonly bodies: number;
}

export interface ModelViewer {
  readonly canvas: HTMLCanvasElement;
  /** Loads a GLB (bytes, or a local URL) and fits it to the view. Resolves to its parts. */
  load(source: ArrayBuffer | string): Promise<ViewerPart[]>;
  fitToView(): void;
  /** Highlights a part by name (null clears). */
  selectPart(name: string | null): void;
  /** Called when a click in the viewer picks a part (or empty space: null). */
  onPick(listener: (name: string | null) => void): void;
  dispose(): void;
}

export interface ViewerOptions {
  /** The highlight colour (the steel-blue token). */
  highlight: string;
}

/** The direction the camera looks from when fitting: front, right, above. */
const VIEW_DIRECTION = new Vector3(1, 0.75, 1.4).normalize();
const BLACK = new Color(0x000000);

/** Distance at which a sphere of `radius` fills a camera with vertical field of view `fovDeg` and `aspect`. */
export function fitDistance(radius: number, fovDeg: number, aspect: number): number {
  const vFov = (fovDeg * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const fov = Math.min(vFov, hFov);
  return (radius / Math.sin(fov / 2)) * 1.02;
}

/** A node's name as written in the file (GLTFLoader turns spaces into "_" in .name and keeps the original in userData.name). */
export function nodeName(o: Object3D): string {
  const original = (o.userData as { name?: unknown }).name;
  return typeof original === "string" ? original : o.name;
}

/** The part an object belongs to: the ancestor that is a direct child of `root`. */
export function partOf(object: Object3D | null, root: Object3D): Object3D | null {
  let o = object;
  while (o && o.parent && o.parent !== root) o = o.parent;
  return o && o.parent === root ? o : null;
}

export function createViewer(container: HTMLElement, options: ViewerOptions): ModelViewer {
  const canvas = document.createElement("canvas");
  canvas.className = "l-canvas";
  // preserveDrawingBuffer: the picture stays readable between frames (render on demand; e2e reads it).
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(canvas);

  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x444448, 2.2));
  const sun = new DirectionalLight(0xffffff, 2.0);
  sun.position.set(3, 5, 4);
  scene.add(sun);

  const camera = new PerspectiveCamera(35, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.screenSpacePanning = true;

  const highlight = new Color(options.highlight);
  let root: Object3D | null = null;
  let partRoot: Object3D | null = null;
  let parts: Object3D[] = [];
  let selected: string | null = null;
  const pickListeners: ((name: string | null) => void)[] = [];

  const render = () => renderer.render(scene, camera);
  controls.addEventListener("change", render);

  const resize = () => {
    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  // Click (not drag) picks a part.
  const raycaster = new Raycaster();
  let down: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener("pointerup", (e) => {
    if (!down || e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4 || !root || !partRoot) return;
    down = null;
    const r = canvas.getBoundingClientRect();
    const ndc = new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(root, true)[0];
    const part = hit ? partOf(hit.object, partRoot) : null;
    for (const l of pickListeners) l(part ? nodeName(part) : null);
  });

  // Highlight: the selected part takes the steel-blue colour (and a little glow); others keep their own.
  const original = new WeakMap<MeshStandardMaterial, Color>();
  const paint = () => {
    for (const p of parts) {
      const on = nodeName(p) === selected;
      p.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        for (const m of materials(o)) {
          if (!(m instanceof MeshStandardMaterial)) continue;
          if (!original.has(m)) original.set(m, m.color.clone());
          m.color.copy(on ? highlight : (original.get(m) ?? m.color));
          m.emissive.copy(on ? highlight : BLACK);
          m.emissiveIntensity = on ? 0.35 : 0;
        }
      });
    }
    render();
  };

  const viewer: ModelViewer = {
    canvas,
    async load(source) {
      const bytes = typeof source === "string" ? await (await fetch(source)).arrayBuffer() : source;
      const gltf = await new GLTFLoader().parseAsync(bytes, "");
      if (root) scene.remove(root);
      root = gltf.scene;
      // Each mesh gets its own material copy, so highlighting one part never tints another.
      root.traverse((o) => {
        if (o instanceof Mesh) o.material = Array.isArray(o.material) ? o.material.map((m: Material) => m.clone()) : o.material.clone();
      });
      // Parts: the scene's top-level nodes, or the children of a single wrapper node (as glb.ts).
      partRoot = root.children.length === 1 && root.children[0].children.length > 0 && !(root.children[0] instanceof Mesh) ? root.children[0] : root;
      parts = [...partRoot.children];
      scene.add(root);
      resize();
      viewer.fitToView();
      paint();
      return parts.map((p, i) => {
        let bodies = 0;
        p.traverse((o) => (bodies += o instanceof Mesh ? 1 : 0));
        return { name: nodeName(p) || `Part ${i + 1}`, bodies };
      });
    },
    fitToView() {
      if (!root) return;
      const sphere = new Box3().setFromObject(root).getBoundingSphere(new Sphere());
      const radius = Math.max(sphere.radius, 1e-3);
      const distance = fitDistance(radius, camera.fov, camera.aspect);
      controls.target.copy(sphere.center);
      camera.position.copy(sphere.center).addScaledVector(VIEW_DIRECTION, distance);
      camera.near = distance / 100;
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
      controls.update();
      render();
    },
    selectPart(name) {
      selected = name;
      paint();
    },
    onPick(listener) {
      pickListeners.push(listener);
    },
    dispose() {
      observer.disconnect();
      controls.dispose();
      root?.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          for (const m of materials(o)) m.dispose();
        }
      });
      renderer.dispose();
      canvas.remove();
    },
  };
  return viewer;
}

function materials(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}
