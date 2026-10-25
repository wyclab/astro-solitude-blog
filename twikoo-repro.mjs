// 精确定位：Twikoo 样式注入位置 + Astro swap 后是否丢失
import { chromium } from '@playwright/test';

const styleProbe = () => {
  const report = [];
  document.querySelectorAll('style').forEach((s, i) => {
    const txt = s.textContent || '';
    if (txt.includes('.tk-') || txt.includes('tk-comments')) {
      report.push({
        index: i,
        parent: s.parentElement?.tagName + (s.parentElement?.id ? '#' + s.parentElement.id : ''),
        len: txt.length,
        head: txt.slice(0, 60),
      });
    }
  });
  return {
    totalStyles: document.querySelectorAll('style').length,
    tkStyles: report,
    twikooScript: !!document.querySelector('script[src*="twikoo"]'),
  };
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('https://blog.wyclab.com/p/huangyan/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const s1 = await page.evaluate(styleProbe);
  console.log('== 文章1 加载后样式状态 ==');
  console.log(JSON.stringify(s1, null, 2));

  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/p/"]'))
      .filter((a) => a.href !== location.href);
    links[0]?.click();
  });
  await page.waitForTimeout(5000);

  const s2 = await page.evaluate(styleProbe);
  console.log('== 切换文章后样式状态 ==');
  console.log(JSON.stringify(s2, null, 2));

  const commentEl = await page.$('#post-comment');
  if (commentEl) {
    await commentEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await commentEl.screenshot({ path: '/tmp/twikoo-comment-area.png' });
    console.log('评论区截图已保存');
  } else {
    console.log('!! #post-comment 不存在');
  }

  const globals = await page.evaluate(() => ({
    hasTwikoo: typeof window.twikoo,
    twikooKeys: window.twikoo ? Object.keys(window.twikoo) : null,
  }));
  console.log('== twikoo 全局 ==');
  console.log(JSON.stringify(globals, null, 2));

  await browser.close();
};

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
