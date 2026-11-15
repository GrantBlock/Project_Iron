import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("App", () => {
  it("renders the empty canvas", () => {
    render(<App />);
    expect(screen.getByTestId("canvas")).toBeTruthy();
  });

  it("exposes the reference test hook: window.__collide.state() (T30)", () => {
    render(<App />);
    const s = window.__collide!.state();
    expect(s).toMatchObject({ version: 1, view: "blank", tabs: [], editor: null, activeTool: null, items: [], selection: [], zoom: null, splash: null });
    expect(s.sidebar.delay).toBe("No delay");
    // A fresh object each call; changing it changes nothing in the app.
    s.items.push({} as never);
    expect(window.__collide!.state()).not.toBe(s);
    expect(window.__collide!.state().items).toEqual([]);
  });

  it("the hook follows the app's state: the New snip delay", () => {
    render(<App />);
    fireEvent.change(screen.getByTestId("snip-delay"), { target: { value: "5" } });
    expect(window.__collide!.state().sidebar.delay).toBe("5 s");
  });
});
