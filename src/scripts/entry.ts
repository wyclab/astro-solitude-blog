import { prepareAssets } from './assets';
import './comments';
import { Solitude } from './core/api';
import { lifecycle } from './core/lifecycle';
import './utils';
// Astro 7.3.2 does not observe ViewTransition.ready. A superseding navigation
// legitimately rejects it when skipTransition() cancels the visual transition.
// Observe that promise without changing DOM updates or suppressing page errors.
const startViewTransition = document.startViewTransition?.bind(document);
if (startViewTransition) {
  document.startViewTransition = (...args) => {
    const transition = startViewTransition(...args);
    void transition.ready.catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.warn('Solitude view transition could not animate:', error);
      }
    });
    return transition;
  };
}
let first = true;
let navigation = 0;
// Astro's client router replaces <head> during navigation and drops styles
// that third-party widgets (Twikoo, etc.) inject at runtime, leaving their
// markup unstyled after a client-side navigation. Snapshot any style element
// that is not part of the server-rendered baseline before the swap and
// reinstate it once the new head is in place.
const PRESERVED_STYLE_ATTR = 'data-solitude-preserved-style';
let baselineStyles = new Set<Element>();
let runtimeStyles: string[] = [];
const snapshotBaselineStyles = () => {
  baselineStyles = new Set(
    Array.from(
      document.head.querySelectorAll(`style:not([${PRESERVED_STYLE_ATTR}])`),
    ),
  );
};
document.addEventListener('astro:before-swap', () => {
  navigation++;
  document.documentElement.dataset.solitudeRuntime = 'mounting';
  lifecycle.emit('beforeNavigate');
  lifecycle.disposePage();
  runtimeStyles = Array.from(document.head.querySelectorAll('style'))
    .filter((style) => !baselineStyles.has(style))
    .map((style) => style.textContent || '')
    .filter(Boolean);
  document.body.style.overflow = '';
  document.documentElement.classList.remove('search-open');
  window.Fancybox?.close?.();
});
document.addEventListener('astro:after-swap', () => {
  if (!runtimeStyles.length) return;
  const fragment = document.createDocumentFragment();
  for (const css of runtimeStyles) {
    const style = document.createElement('style');
    style.setAttribute(PRESERVED_STYLE_ATTR, '');
    style.textContent = css;
    fragment.append(style);
  }
  document.head.append(fragment);
  runtimeStyles = [];
});
document.addEventListener('astro:page-load', snapshotBaselineStyles);
async function mount() {
  const version = ++navigation;
  document.documentElement.dataset.solitudeRuntime = 'mounting';
  await prepareAssets();
  if (version !== navigation) return;
  const { initializeApp } = await import('./main');
  if (version !== navigation) return;
  if (first) {
    first = false;
    await initializeApp(() => version === navigation);
  } else {
    await Solitude.refresh();
    if (version !== navigation) return;
    lifecycle.emit('afterNavigate', { page: Solitude.page });
  }
  if (version !== navigation) return;
  await import('./tag-runtime');
  if (version !== navigation) return;
  window.__solitudeShortcodeRuntime?.init();
  if (version === navigation) {
    document.documentElement.dataset.solitudeRuntime = 'ready';
    Solitude.endLoading?.();
  }
}
document.addEventListener('astro:page-load', () => {
  void mount().catch((error) => {
    document.documentElement.dataset.solitudeRuntime = 'error';
    console.error('Solitude initialization failed', error);
  });
});
