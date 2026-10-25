import { expect, test, type Page } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:4337' });

// Mimics the real Twikoo bundle: styles are injected into <head> once while
// the script executes, and twikoo.init() renders markup into the mount node
// on every call. Astro's client router swaps <head> on navigation and would
// drop those injected styles without the runtime style preservation.
async function mockTwikoo(page: Page) {
  await page.route('**/twikoo@*/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        (function () {
          var style = document.createElement('style');
          style.textContent =
            '.tk-comments { display: flex; }' +
            '.tk-avatar { width: 2.5rem; height: 2.5rem; flex-shrink: 0; }' +
            '.tk-main { flex: 1; width: 0; }';
          document.head.appendChild(style);
          window.__twikooCalls = 0;
          window.twikoo = {
            init: function (options) {
              window.__twikooCalls++;
              var mount = document.querySelector(options.el);
              if (mount) {
                mount.innerHTML =
                  '<div class="tk-comments">' +
                  '<div class="tk-avatar"><img alt="avatar"></div>' +
                  '<div class="tk-main"><div class="tk-content">评论内容</div></div>' +
                  '</div>';
              }
              return Promise.resolve({});
            },
          };
        })();
      `,
    }),
  );
}

async function ready(page: Page) {
  await expect(page.locator('html')).toHaveAttribute(
    'data-solitude-runtime',
    'ready',
  );
}

async function navigateToAnotherPost(page: Page) {
  const current = page.url();
  await page.locator('a[href*="/p/"]').evaluateAll((links) => {
    const link = links.find(
      (candidate) => candidate instanceof HTMLAnchorElement && candidate.href !== location.href,
    );
    (link as HTMLAnchorElement | undefined)?.click();
  });
  await expect(page).not.toHaveURL(current);
  await ready(page);
}

async function twikooStyleCount(page: Page) {
  return page.evaluate(
    () =>
      Array.from(document.head.querySelectorAll('style')).filter((style) =>
        (style.textContent || '').includes('.tk-'),
      ).length,
  );
}

test('twikoo styles survive client-side navigation between posts', async ({
  page,
}) => {
  await mockTwikoo(page);
  await page.goto('/p/huangyan/');
  await ready(page);

  // The script executed once and injected its styles.
  await expect(page.locator('#twikoo .tk-comments')).toBeVisible();
  expect(await twikooStyleCount(page)).toBeGreaterThan(0);
  const initialCalls = await page.evaluate(() => window.__twikooCalls);
  expect(initialCalls).toBeGreaterThan(0);

  // Navigate without a full page reload.
  await navigateToAnotherPost(page);
  await expect(page.locator('#twikoo .tk-comments')).toBeVisible();
  expect(await page.evaluate(() => window.__twikooCalls)).toBeGreaterThan(
    initialCalls,
  );
  // The styles injected at runtime must still exist after the head swap.
  expect(await twikooStyleCount(page)).toBeGreaterThan(0);
  const avatarWidth = await page
    .locator('#twikoo .tk-avatar')
    .evaluate((el) => getComputedStyle(el).width);
  expect(parseFloat(avatarWidth)).toBeGreaterThan(0);

  // A second navigation keeps the preserved styles around without duplicating
  // them on every hop.
  const stylesAfterFirstHop = await twikooStyleCount(page);
  await navigateToAnotherPost(page);
  await expect(page.locator('#twikoo .tk-comments')).toBeVisible();
  expect(await twikooStyleCount(page)).toBe(stylesAfterFirstHop);
});

test('twikoo styles are preserved after returning to a post via history', async ({
  page,
}) => {
  await mockTwikoo(page);
  await page.goto('/p/huangyan/');
  await ready(page);
  await expect(page.locator('#twikoo .tk-comments')).toBeVisible();

  await navigateToAnotherPost(page);
  await expect(page.locator('#twikoo .tk-comments')).toBeVisible();
  expect(await twikooStyleCount(page)).toBeGreaterThan(0);

  await page.goBack();
  await ready(page);
  await expect(page.locator('#twikoo .tk-comments')).toBeVisible();
  expect(await twikooStyleCount(page)).toBeGreaterThan(0);
});
