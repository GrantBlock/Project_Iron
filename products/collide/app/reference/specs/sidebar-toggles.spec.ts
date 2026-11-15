import { expect, test } from "../fixture";
import { recents } from "../helpers";

// Seed: ../../../prototype-checks/sidebar-toggles.js
// Snip delay and Add snip Current / Behind toggles, remembered after a reload.

test("the snip delay and the Add snip Current / Behind toggles are remembered after a reload", async ({ page, open, reload, state, shots }) => {
  await open();
  const rec = recents(page);
  const delay = rec.getByRole("radiogroup", { name: "Delay before New snip captures" });
  const where = rec.getByRole("radiogroup", { name: "Where Add snip captures" });

  // The start values.
  expect((await state()).sidebar).toMatchObject({ delay: "No delay", addMode: "Current" });
  await expect(delay.getByRole("radio", { name: "0s", exact: true })).toBeChecked();
  await expect(where.getByRole("radio", { name: "Current", exact: true })).toBeChecked();

  // Pick 5 s and Behind.
  await delay.getByRole("radio", { name: "5s", exact: true }).click();
  await where.getByRole("radio", { name: "Behind", exact: true }).click();
  await expect(delay.getByRole("radio", { name: "5s", exact: true })).toBeChecked();
  await expect(delay.getByRole("radio", { name: "0s", exact: true })).not.toBeChecked();
  await expect(where.getByRole("radio", { name: "Behind", exact: true })).toBeChecked();
  await expect(where.getByRole("radio", { name: "Current", exact: true })).not.toBeChecked();
  expect((await state()).sidebar).toMatchObject({ delay: "5 s", addMode: "Behind" });
  await shots("delay-5s-behind");

  // Remembered after a reload.
  await reload();
  expect((await state()).sidebar).toMatchObject({ delay: "5 s", addMode: "Behind" });
  await expect(delay.getByRole("radio", { name: "5s", exact: true })).toBeChecked();
  await expect(where.getByRole("radio", { name: "Behind", exact: true })).toBeChecked();

  // New snip uses the delay.
  await rec.getByRole("button", { name: "New snip" }).click();
  await expect(page.getByRole("status")).toHaveText("Collide hides, waits 5 s, then captures");

  // The other choices work too.
  await delay.getByRole("radio", { name: "10s", exact: true }).click();
  await delay.getByRole("radio", { name: "3s", exact: true }).click();
  expect((await state()).sidebar.delay).toBe("3 s");
});
