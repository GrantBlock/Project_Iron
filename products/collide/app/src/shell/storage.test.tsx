// RUN3 T36: Settings → Storage. In the desktop app it shows the storage folder's real numbers (folder, item count,
// size) and whether "keep the newest N" is on; in a browser it stays the prototype's display.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { formatBytes, SettingsTab } from "./parts";
import type { Settings } from "./prefs";

afterEach(cleanup);

const saved: Settings = { keep: "", mode: "server", server: "" };

function settings(storage?: Parameters<typeof SettingsTab>[0]["storage"], keep = "") {
  const saves: Settings[] = [];
  render(
    <SettingsTab
      saved={{ ...saved, keep }}
      onSave={(s) => saves.push(s)}
      onDirty={() => undefined}
      notify={() => undefined}
      head={(save) => (
        <button type="button" onClick={save.onSave} disabled={!save.canSave}>
          Save
        </button>
      )}
      password=""
      onPassword={() => undefined}
      storage={storage}
    />,
  );
  return saves;
}

describe("formatBytes", () => {
  it("names a size for people", () => {
    expect([0, 812, 1024, 14540, 3.1 * 1024 * 1024, 1.25 * 1024 ** 3, Number.NaN].map(formatBytes)).toEqual(["0 B", "812 B", "1.00 KB", "14.2 KB", "3.10 MB", "1.25 GB", "0 B"]);
  });
});

describe("Settings → Storage", () => {
  it("in a browser: the prototype's text, no numbers", () => {
    settings();
    expect(screen.getByText(/%APPDATA%\\Collide\\/)).toBeTruthy();
    expect(screen.queryByTestId("storage-usage")).toBeNull();
    expect(screen.queryByTestId("storage-keep")).toBeNull();
  });

  it("in the desktop app: the real folder, item count and size; retention off by default", () => {
    settings({ folder: "C:\\Users\\me\\Documents\\Collide\\Markups", items: 3, bytes: 14540, keep: null });
    expect(screen.getByTestId("storage-folder").textContent).toBe("C:\\Users\\me\\Documents\\Collide\\Markups");
    expect(screen.getByTestId("storage-usage").textContent).toBe("3 items · 14.2 KB used");
    expect(screen.getByTestId("storage-keep").textContent).toBe("Off: every file is kept.");
  });

  it("says when retention is on, and saves the number typed", () => {
    const saves = settings({ folder: "/docs/Collide/Markups", items: 1, bytes: 10, keep: 4 }, "4");
    expect(screen.getByTestId("storage-usage").textContent).toBe("1 item · 10 B used");
    expect(screen.getByTestId("storage-keep").textContent).toMatch(/newest 4 are deleted, oldest first\. An item open in a tab is never deleted\./);
    fireEvent.change(screen.getByPlaceholderText("[number of files]"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(saves).toEqual([{ ...saved, keep: "2" }]);
  });
});
