// T48 review round 1 (Farengar): in the compact view the Connected pill expands first, then opens Settings, so the
// Settings tab is seen; collapsing closes the Appearance pop.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../App";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const side = () => screen.getByRole("complementary", { name: "Recents" });

describe("Compact view, review round 1 (T48)", () => {
  it("the Connected pill in the compact view expands, then opens Settings in sight", () => {
    localStorage.setItem("collide.settings", JSON.stringify({ keep: "", mode: "client", server: "" }));
    render(<App />);
    fireEvent.click(within(side()).getByRole("button", { name: "Collapse window" }));
    fireEvent.click(within(side()).getByTestId("connected-pill"));
    expect(window.__collide!.state().sidebar.collapsed).toBe(false);
    expect(screen.getByRole("region", { name: "Workspace" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Settings/ })).toBeTruthy();
    expect(within(side()).getByRole("button", { name: "Collapse window" })).toBeTruthy();
  });

  it("collapsing closes the Appearance pop; it stays closed after Expand", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    expect(screen.getByRole("dialog", { name: "Appearance" })).toBeTruthy();
    fireEvent.click(within(side()).getByRole("button", { name: "Collapse window" }));
    fireEvent.click(within(side()).getByRole("button", { name: "Expand window" }));
    expect(screen.queryByRole("dialog", { name: "Appearance" })).toBeNull();
  });
});
