import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Runs against `next dev` (the gallery is a 404 in production builds).
 * Every behaviour is checked in both themes: tokens must hold up in each.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const GALLERY = "/it/_dev/ui";

// Computed colours of the `focus` token (docs/DESIGN.md §2.1).
const FOCUS = {
  dark: "rgb(255, 179, 71)", // #FFB347
  light: "rgb(156, 71, 0)", // #9C4700
} as const;

// First compile of the route under `next dev` can take a while.
test.setTimeout(90_000);

async function openGallery(page: Page) {
  await page.goto(GALLERY);
  await expect(
    page.getByRole("heading", { level: 1, name: "UI primitives" }),
  ).toBeVisible();
  // Wait for React to hydrate before interacting (a click before that is lost).
  await page.waitForFunction(() => {
    const button = document.querySelector("main button");
    return (
      button !== null &&
      Object.keys(button).some((key) => key.startsWith("__reactProps$"))
    );
  });
}

/** Let finite animations finish so axe never samples a half-faded colour. */
async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
}

async function expectNoAxeViolations(
  page: Page,
  options: { disableRules?: string[] } = {},
) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude("nextjs-portal") // Next.js dev overlay, not our UI
    .disableRules(options.disableRules ?? [])
    .analyze();
  expect(results.violations).toEqual([]);
}

const focusInside = (container: Locator) =>
  container.evaluate((el) => el.contains(document.activeElement));

for (const theme of ["dark", "light"] as const) {
  test.describe(`gallery (${theme})`, () => {
    test.use({ colorScheme: theme });

    test.beforeEach(async ({ page }) => {
      await openGallery(page);
    });

    test("has no axe violations at rest", async ({ page }) => {
      await expectNoAxeViolations(page);
    });

    test("button: sizes are at least 44x44 and disabled stays disabled", async ({
      page,
    }) => {
      for (const name of [
        "Primary",
        "Secondary",
        "Tertiary",
        "Large",
        "Copy link",
      ]) {
        const box = await page
          .getByRole("button", { name, exact: true })
          .boundingBox();
        expect(box, name).not.toBeNull();
        expect(box?.height, `${name} height`).toBeGreaterThanOrEqual(44);
        expect(box?.width, `${name} width`).toBeGreaterThanOrEqual(44);
      }
      await expect(
        page.getByRole("button", { name: "Disabled" }),
      ).toBeDisabled();
    });

    test("fields: 44px tall, labelled, invalid state exposed", async ({
      page,
    }) => {
      for (const locator of [
        page.getByRole("textbox", { name: "Name" }),
        page.getByRole("textbox", { name: "Email (invalid example)" }),
        page.getByRole("combobox", { name: "Service" }),
      ]) {
        const box = await locator.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      const invalid = page.getByRole("textbox", {
        name: "Email (invalid example)",
      });
      await expect(invalid).toHaveAttribute("aria-invalid", "true");
      await expect(invalid).toHaveAccessibleDescription(
        "Enter an address like name@company.eu",
      );
    });

    test("every control shows a 2px focus ring from the focus token", async ({
      page,
    }) => {
      await page.keyboard.press("Tab"); // switch to keyboard modality (:focus-visible)
      const controls: Array<[string, Locator]> = [
        ["button", page.getByRole("button", { name: "Primary", exact: true })],
        ["input", page.getByRole("textbox", { name: "Name" })],
        ["textarea", page.getByRole("textbox", { name: "Message" })],
        ["select trigger", page.getByRole("combobox", { name: "Service" })],
        ["checkbox", page.getByRole("checkbox", { name: "Unchecked" })],
        ["tab", page.getByRole("tab", { name: "Agents" })],
        ["tooltip trigger", page.getByRole("button", { name: "Copy link" })],
      ];
      for (const [label, control] of controls) {
        await control.focus();
        await expect(control, label).toBeFocused();
        await settle(page); // the ring fades in with the colour transition
        const ring = await control.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            style: style.outlineStyle,
            width: style.outlineWidth,
            color: style.outlineColor,
          };
        });
        expect(ring, label).toEqual({
          style: "solid",
          width: "2px",
          color: FOCUS[theme],
        });
      }
    });

    test("checkbox: 44px hit area, Space toggles, group shows mixed state", async ({
      page,
    }) => {
      const single = page.getByRole("checkbox", { name: "Unchecked" });
      await single.scrollIntoViewIfNeeded(); // elementFromPoint ignores off-screen points
      // The box is 24px; a point 20px to the right of its centre must still hit it.
      const hit = await single.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const target = document.elementFromPoint(
          rect.left + rect.width / 2 + 20,
          rect.top + rect.height / 2,
        );
        return target === el;
      });
      expect(hit).toBe(true);

      await single.focus();
      await page.keyboard.press("Space");
      await expect(single).toBeChecked();
      await page.keyboard.press("Space");
      await expect(single).not.toBeChecked();

      const all = page.getByRole("checkbox", { name: "Select all" });
      await all.click();
      await expect(
        page.getByRole("checkbox", { name: "Agents" }),
      ).toBeChecked();
      await page.getByRole("checkbox", { name: "Agents" }).click();
      await expect(all).toHaveAttribute("aria-checked", "mixed");
      await expectNoAxeViolations(page);
    });

    test("select: opens and chooses with the keyboard, axe clean while open", async ({
      page,
    }) => {
      const select = page.getByRole("combobox", { name: "Service" });
      await select.focus();
      await page.keyboard.press("Enter");
      const listbox = page.getByRole("listbox");
      await expect(listbox).toBeVisible();

      // The highlighted option needs a visible focus indicator: its background
      // alone (surface-3 on surface-2) is only ~1.1:1.
      const first = page.getByRole("option", { name: "AI agents" });
      await expect(first).toHaveAttribute("data-highlighted", "");
      await settle(page);
      expect(
        await first.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            style: style.outlineStyle,
            width: style.outlineWidth,
            color: style.outlineColor,
          };
        }),
      ).toEqual({ style: "solid", width: "2px", color: FOCUS[theme] });

      // While the listbox is open Radix marks the rest of the page aria-hidden
      // and keeps keyboard focus inside the listbox. axe only recognises
      // role=dialog as modal, so it reports `aria-hidden-focus` for the hidden
      // (but unreachable) page content. That rule is disabled for this one scan,
      // and the premise is asserted instead: focus cannot leave the listbox.
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press("Tab");
        expect(await focusInside(listbox), `after Tab #${String(i + 1)}`).toBe(
          true,
        );
      }
      await expectNoAxeViolations(page, {
        disableRules: ["aria-hidden-focus"],
      });

      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(listbox).toBeHidden();
      await expect(select).toContainText("Workflow automation");
      await expect(select).toBeFocused();
    });

    test("tabs: arrow keys move selection and panel", async ({ page }) => {
      const agents = page.getByRole("tab", { name: "Agents" });
      await agents.focus();
      await page.keyboard.press("ArrowRight");
      const automation = page.getByRole("tab", { name: "Automation" });
      await expect(automation).toHaveAttribute("aria-selected", "true");
      await expect(automation).toBeFocused();
      await expect(
        page
          .getByRole("tabpanel")
          .getByText("Workflows that remove repeated manual steps."),
      ).toBeVisible();
      await page.keyboard.press("End");
      await expect(page.getByRole("tab", { name: "Web apps" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      for (const name of ["Agents", "Automation", "Web apps"]) {
        const box = await page.getByRole("tab", { name }).boundingBox();
        expect(box?.height, name).toBeGreaterThanOrEqual(44);
      }
    });

    test("tooltip: appears on keyboard focus and closes with Escape", async ({
      page,
    }) => {
      await page.keyboard.press("Tab");
      const trigger = page.getByRole("button", { name: "Hover or focus me" });
      await trigger.focus();
      const text = page
        .getByText("Extra context, never the only source")
        .first();
      await expect(text).toBeVisible();
      await expectNoAxeViolations(page);
      await page.keyboard.press("Escape");
      await expect(text).toBeHidden();
    });

    test("dialog: keyboard open, focus trapped, Escape returns focus, axe clean", async ({
      page,
    }) => {
      const trigger = page.getByRole("button", { name: "Open dialog" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Request a call" });
      await expect(dialog).toBeVisible();
      await expect.poll(() => focusInside(dialog)).toBe(true);

      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        expect(await focusInside(dialog), `after Tab #${String(i + 1)}`).toBe(
          true,
        );
      }
      await page.keyboard.press("Shift+Tab");
      expect(await focusInside(dialog)).toBe(true);

      await expectNoAxeViolations(page);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });

    test("sheet: all four sides open and close, axe clean", async ({
      page,
    }) => {
      for (const side of ["right", "left", "top", "bottom"]) {
        const trigger = page.getByRole("button", {
          name: `Open ${side} sheet`,
        });
        await trigger.focus();
        await page.keyboard.press("Enter");
        const sheet = page.getByRole("dialog", { name: "Filters" });
        await expect(sheet, side).toBeVisible();
        if (side === "right") await expectNoAxeViolations(page);
        await page.keyboard.press("Escape");
        await expect(sheet, side).toBeHidden();
        await expect(trigger, side).toBeFocused();
      }
    });

    test("toast: announces, error persists until dismissed, others expire", async ({
      page,
    }) => {
      await page.clock.install();
      await openGallery(page);

      await page.getByRole("button", { name: "Success toast" }).click();
      await page.getByRole("button", { name: "Error toast (stays)" }).click();
      // Toasts are list items in the labelled "Notifications" region; Radix
      // announces them through separate, short-lived live regions.
      const region = page.getByRole("region", { name: "Notifications (F8)" });
      const success = region
        .getByRole("listitem")
        .filter({ hasText: "Message sent" });
      const error = region
        .getByRole("listitem")
        .filter({ hasText: "Could not send" });
      await expect(success).toBeVisible();
      await expect(error).toBeVisible();
      await expect(
        page
          .locator('[role="status"][aria-live="polite"]')
          .filter({ hasText: "Message sent" }),
      ).toBeAttached();
      await expect(
        page
          .locator('[role="status"][aria-live="assertive"]')
          .filter({ hasText: "Could not send" }),
      ).toBeAttached();
      // Each toast shows an icon next to the text, so status is never colour alone.
      await expect(success.locator("svg").first()).toBeVisible();
      await expect(error.getByRole("button", { name: "Retry" })).toBeVisible();
      await expectNoAxeViolations(page);

      await page.clock.fastForward(10_000);
      await expect(success).toBeHidden();
      await expect(error).toBeVisible();

      await error.getByRole("button", { name: "Close" }).click();
      await expect(error).toBeHidden();
    });
  });
}

test.describe("gallery (language switcher)", () => {
  test("keeps the /_dev/ui path when switching language", async ({ page }) => {
    await openGallery(page);
    await expect(page).toHaveURL(/\/it\/_dev\/ui$/);

    await page
      .getByRole("navigation", { name: "Lingua" })
      .getByRole("link", { name: "English" })
      .click();

    await expect(page).toHaveURL(/\/en\/_dev\/ui$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { level: 1, name: "UI primitives" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Language" }),
    ).toBeVisible();
  });
});

test.describe("gallery (reduced motion)", () => {
  test.use({ reducedMotion: "reduce" });

  test("overlays do not animate", async ({ page }) => {
    await openGallery(page);
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog", { name: "Request a call" });
    await expect(dialog).toBeVisible();

    const names = await dialog.evaluate((el) => {
      const overlay = document.querySelector(
        '[data-state="open"][class*="bg-bg"]',
      );
      return {
        content: getComputedStyle(el).animationName,
        overlay: overlay ? getComputedStyle(overlay).animationName : "missing",
      };
    });
    expect(names).toEqual({ content: "none", overlay: "none" });
  });
});
