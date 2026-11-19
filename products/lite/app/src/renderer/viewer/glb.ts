// Reads a GLB's JSON chunk without Three.js: the parts list (L06) and, in L08, files opened
// from disk. Parts are the scene's top-level nodes (or, when the scene has a single node with
// children, that node's children); a part's bodies are the meshes under it.

export interface GlbPart {
  readonly name: string;
  readonly bodies: number;
}

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
}

interface GltfJson {
  asset?: { extras?: Record<string, unknown> };
  scene?: number;
  scenes?: { name?: string; nodes?: number[]; extras?: Record<string, unknown> }[];
  nodes?: GltfNode[];
}

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

/** The JSON chunk of a GLB (binary glTF 2.0). Throws on anything else. */
export function readGlbJson(buffer: ArrayBuffer | Uint8Array): GltfJson {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== MAGIC) throw new Error("Not a GLB file");
  if (view.getUint32(4, true) !== 2) throw new Error("Only glTF 2.0 GLB files are supported");
  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== JSON_CHUNK || 20 + length > bytes.byteLength) throw new Error("GLB has no JSON chunk");
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length))) as GltfJson;
}

/** The parts and their body counts, in file order. */
export function glbParts(json: GltfJson): GlbPart[] {
  const nodes = json.nodes ?? [];
  const scene = json.scenes?.[json.scene ?? 0];
  let roots = scene?.nodes ?? [];
  if (roots.length === 1 && (nodes[roots[0]]?.children?.length ?? 0) > 0 && nodes[roots[0]]?.mesh === undefined) roots = nodes[roots[0]].children ?? [];
  const count = (i: number, seen = new Set<number>()): number => {
    if (seen.has(i)) return 0;
    seen.add(i);
    const n = nodes[i];
    if (!n) return 0;
    return (n.mesh !== undefined ? 1 : 0) + (n.children ?? []).reduce((sum, c) => sum + count(c, seen), 0);
  };
  return roots.map((i, k) => ({ name: nodes[i]?.name || `Part ${k + 1}`, bodies: count(i) }));
}

/** "1 body", "3 bodies", as the prototype's parts lists. */
export function bodiesLabel(n: number): string {
  return n === 1 ? "1 body" : `${n} bodies`;
}

/** True when the file says it is a sample (the generated models do). */
export function isSample(json: GltfJson): boolean {
  const scene = json.scenes?.[json.scene ?? 0];
  return scene?.extras?.sample === true;
}
