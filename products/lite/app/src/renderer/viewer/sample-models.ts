// The sample GLBs (pnpm models), bundled with the app as local assets: item id → URL.
import m1 from "../assets/models/m1.glb?url";
import m2 from "../assets/models/m2.glb?url";

export const SAMPLE_MODEL_URLS: Readonly<Record<string, string>> = { m1, m2 };
