import { expect, test } from "../fixture";
import { atStage, drag, openMarkdown, openSnip, tool } from "../helpers";

// Seed: ../../../prototype-checks/pen-colour-and-thickness-memory.js
// No colour stays selected after a draw; picking a tool restores the last colour and thickness,
// per editor, also after a reload.

test("the last colour and thickness come back with the next tool, per editor, also after a reload", async ({ page, open, reload, state, shots }) => {
  await open();
  await openSnip(page);
  const pressed = (name: string) => expect(tool(page, name)).toHaveAttribute("aria-pressed", "true");
  const notPressed = (name: string) => expect(tool(page, name)).toHaveAttribute("aria-pressed", "false");

  // Snip: Rectangle, Blue, Stroke 5, draw.
  await tool(page, "Rectangle").click();
  await tool(page, "Blue").click();
  await tool(page, "Stroke 5").click();
  expect(await state()).toMatchObject({ activeTool: "rect", color: "blue", stroke: 5 });
  const [x, y] = await atStage(page, -60, 60);
  await drag(page, [x, y], [x + 60, y + 40], 3);

  // After the draw no colour is selected.
  let s = await state();
  expect(s.color).toBeNull();
  for (const c of ["Red", "Blue", "Yellow", "Gray"]) await notPressed(c);
  await shots("no-colour-after-draw");

  // Picking another tool brings back Blue and Stroke 5.
  await tool(page, "Select").click();
  await tool(page, "Ellipse").click();
  expect(await state()).toMatchObject({ activeTool: "ellipse", color: "blue", stroke: 5 });
  await pressed("Blue");
  await pressed("Stroke 5");

  // After a reload the choice is still there.
  await reload();
  await openSnip(page);
  await tool(page, "Ellipse").click();
  expect(await state()).toMatchObject({ activeTool: "ellipse", color: "blue", stroke: 5 });
  await pressed("Blue");
  await pressed("Stroke 5");

  // Markdown has its own colour and thickness.
  await openMarkdown(page);
  expect((await state()).mode).toBe("preview");
  await tool(page, "Rectangle").click();
  await tool(page, "Yellow").click();
  await tool(page, "Stroke 2").click();
  const [px, py] = await atStage(page, -60, 60);
  await drag(page, [px, py], [px + 100, py + 40], 3);
  await page.keyboard.press("Escape");
  await page.keyboard.press("c");
  s = await state();
  expect(s).toMatchObject({ editor: "markdown", color: "yellow", stroke: 2 });
  await pressed("Yellow");
  await pressed("Stroke 2");

  // And the Snip editor still has its own.
  await openSnip(page);
  await tool(page, "Line").click();
  expect(await state()).toMatchObject({ editor: "snip", activeTool: "line", color: "blue", stroke: 5 });
});
