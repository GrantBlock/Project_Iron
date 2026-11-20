// T48 (Grant 2026-11-20): the collapse button swaps the full app and the compact view.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../App";

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

const recents = () => screen.getByRole("complementary", { name: "Recents" });
const workspace = () => screen.getByTestId("app-root").querySelector("section.ws") as HTMLElement;

describe("Compact view (T48)", () => {
  it("hides the footer and the workspace even with tabs open; the same button expands and the tabs come back as they were", () => {
    window.history.replaceState(null, "", "/?sample");
    render(<App />);
    fireEvent.click(within(recents()).getByRole("button", { name: "New file" }));
    fireEvent.click(within(recents()).getByRole("button", { name: "New file" }));
    const tabs = window.__collide!.state().tabs;
    expect(tabs).toHaveLength(2);

    fireEvent.click(within(recents()).getByRole("button", { name: "Collapse window" }));
    expect(window.__collide!.state().sidebar.collapsed).toBe(true);
    expect(screen.getByTestId("app-root").className).toContain("compact");
    expect(screen.getByTestId("app-root").className).not.toContain("with-canvas");
    expect(workspace().hidden).toBe(true);
    expect(screen.queryByRole("button", { name: "Appearance" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Settings and Connect" })).toBeNull();
    expect(within(recents()).queryByText("Tags")).toBeNull();
    const expand = within(recents()).getByRole("button", { name: "Expand window" });
    expect(expand.getAttribute("title")).toMatch(/^Expand/);
    // Tab state is kept while compact.
    expect(window.__collide!.state().tabs).toEqual(tabs);

    fireEvent.click(expand);
    expect(workspace().hidden).toBe(false);
    expect(window.__collide!.state().tabs).toEqual(tabs);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Settings and Connect" })).toBeTruthy();
    expect(within(recents()).getByRole("button", { name: "Collapse window" }).getAttribute("title")).toMatch(/^Collapse/);
  });

  it("is remembered (collide.collapsed) and comes back compact", () => {
    const first = render(<App />);
    fireEvent.click(within(recents()).getByRole("button", { name: "Collapse window" }));
    expect(localStorage.getItem("collide.collapsed")).toBe("1");
    first.unmount();
    render(<App />);
    expect(window.__collide!.state().sidebar.collapsed).toBe(true);
    expect(workspace().hidden).toBe(true);
  });
});
