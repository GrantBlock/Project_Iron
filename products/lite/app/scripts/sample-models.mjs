// `pnpm models`: generates the sample GLBs (RUN.md L06) from basic shapes, to match the
// prototype's parts lists (src/renderer/data/sample.ts). Each part is a named group whose
// meshes are its bodies; the file is marked as a sample (asset.extras and scene extras).
// Output: src/renderer/assets/models/<item id>.glb (committed; small). Deterministic: the
// same three version writes the same bytes. Three.js's GLTFExporter runs in Node with a
// minimal FileReader (it only uses readAsArrayBuffer for binary output).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      });
    }
  };
}

const outDir = fileURLToPath(new URL("../src/renderer/assets/models/", import.meta.url));

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylinder = (r, h) => new THREE.CylinderGeometry(r, r, h, 24);

/** One body: a mesh named "<part> body <n>" at a position (and optional rotation). */
function body(part, n, geometry, material, [x, y, z], rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${part} body ${n}`;
  mesh.position.set(x, y, z);
  if (rotation) mesh.rotation.set(...rotation);
  return mesh;
}

/** A part: a named group of bodies, in one colour. */
function part(name, color, bodies) {
  const group = new THREE.Group();
  group.name = name;
  const material = new THREE.MeshStandardMaterial({ name, color, metalness: 0.2, roughness: 0.6 });
  bodies.forEach(([geometry, position, rotation], i) => group.add(body(name, i + 1, geometry, material, position, rotation)));
  return group;
}

/** The sample models, keyed by item id; part names and body counts as the prototype's parts lists. */
const MODELS = {
  m1: {
    title: "Palletizer frame v4",
    parts: [
      part("Frame", 0x8a8f96, [[box(2.0, 0.16, 1.2), [0, 0.08, 0]]]),
      part("Transfer axis", 0xb8bcc2, [
        [box(1.8, 0.08, 0.1), [0, 1.25, 0]],
        [box(0.3, 0.2, 0.26), [-0.3, 1.13, 0]],
        [cylinder(0.04, 0.8), [-0.3, 0.63, 0]],
      ]),
      part("Guard door", 0x6f7a86, [
        [box(0.9, 1.0, 0.03), [-0.48, 0.66, 0.62]],
        [box(0.9, 1.0, 0.03), [0.48, 0.66, 0.62]],
      ]),
      part("Gearbox GB-220", 0x55606b, [[cylinder(0.15, 0.3), [1.05, 1.25, 0], [0, 0, Math.PI / 2]]]),
    ],
  },
  m2: {
    title: "Standard guard layout",
    parts: [
      part("Guard panel", 0x6f7a86, [
        [box(1.2, 1.0, 0.03), [0, 0.5, -0.6]],
        [box(1.2, 1.0, 0.03), [0, 0.5, 0.6]],
        [box(0.03, 1.0, 1.2), [-0.6, 0.5, 0]],
        [box(0.03, 1.0, 1.2), [0.6, 0.5, 0]],
      ]),
      part("Door interlock", 0xb8bcc2, [
        [box(0.08, 0.14, 0.06), [0.52, 0.7, 0.65]],
        [box(0.08, 0.14, 0.06), [0.52, 0.5, 0.65]],
      ]),
    ],
  },
};

export const SAMPLE_NOTE = "Sample model generated from basic shapes (not a real design).";

async function exportGlb(id, model) {
  const scene = new THREE.Scene();
  scene.name = model.title;
  scene.userData = { sample: true, note: SAMPLE_NOTE };
  for (const p of model.parts) scene.add(p);
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(scene, { binary: true });
  const file = path.join(outDir, `${id}.glb`);
  writeFileSync(file, Buffer.from(glb));
  return { file, bytes: glb.byteLength };
}

mkdirSync(outDir, { recursive: true });
for (const [id, model] of Object.entries(MODELS)) {
  const { file, bytes } = await exportGlb(id, model);
  console.log(`${path.relative(process.cwd(), file)}  ${bytes} bytes  (${model.title})`);
}
