// T11: the overlay's side of the editor handshake, free of Tauri and React so it is unit-testable.
import type { OverlayResult } from "./Overlay";

export interface FramePayload {
  png: string;
  scale: number;
  width?: number;
  snipId?: number;
}

export interface BridgeIO {
  decode: (png: string) => Promise<void>;
  /** Commit the frame synchronously (flushSync) so the ack means "shown". */
  setFrame: (png: string, scale: number, physicalWidth?: number) => void;
  emit: (event: string, payload?: unknown) => void;
}

export const EV_ACK = "collide:overlay-frame-ack";
export const EV_RESULT = "collide:overlay-result";

export function createOverlayBridge(io: BridgeIO) {
  let snipId: number | undefined;
  return {
    /** Decode, show, then ack at once (no rAF: hidden windows throttle it). A failed decode sends no ack. */
    async onFrame(p: FramePayload): Promise<void> {
      try {
        await io.decode(p.png);
      } catch {
        return;
      }
      snipId = p.snipId;
      io.setFrame(p.png, p.scale, p.width);
      io.emit(EV_ACK, { snipId });
    },
    /** Crop/cancel from the overlay UI. With no frame yet, snipId is undefined and the flow ignores it. */
    onResult(r: OverlayResult): void {
      io.emit(EV_RESULT, { ...r, snipId });
    },
    currentSnipId: () => snipId,
  };
}
