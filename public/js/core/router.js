/**
 * Hash-based router with:
 * - routes registered as `{ path, render(container, params): Page }`,
 * - history stack (push/pop) mirroring browser hash navigation,
 * - 150ms opacity fade on transitions,
 * - automatic Telegram BackButton management (show on non-root),
 * - destroy() hooks on outgoing pages so listeners clean up.
 *
 * Pages are class-instance "Page" objects: { render(), destroy() }.
 * render() may mount DOM and start subscriptions; destroy() must undo.
 */

import { telegram } from './telegram.js';

const ROOT_PATH = '/home';

/**
 * @typedef {object} Page
 * @property {() => void} [destroy]
 */

/** @typedef {(container: HTMLElement, params: Record<string, string>) => Page | void} RouteRender */

export class Router {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this.container = container;
    /** @type {Map<string, RouteRender>} */
    this.routes = new Map();
    /** @type {Page | null} */
    this.currentPage = null;
    /** @type {string[]} */
    this.stack = [];
    /** @type {AbortController | null} */
    this.controller = null;
  }

  /**
   * @param {string} path — e.g. "/home" or "/log/:id" (params via URLSearchParams fragment)
   * @param {RouteRender} render
   */
  register(path, render) {
    this.routes.set(path, render);
  }

  start() {
    this.controller = new AbortController();
    globalThis.addEventListener(
      'hashchange',
      () => this.handleHashChange(),
      { signal: this.controller.signal },
    );
    // Initial navigation.
    this.handleHashChange();
  }

  stop() {
    this.controller?.abort();
    this.controller = null;
    this.currentPage?.destroy?.();
    this.currentPage = null;
  }

  navigate(path) {
    globalThis.location.hash = path;
  }

  back() {
    if (this.stack.length > 1) {
      this.stack.pop();
      globalThis.history.back();
    } else {
      this.navigate(ROOT_PATH);
    }
  }

  handleHashChange() {
    const { path, params } = parseHash();
    const render = this.routes.get(path) ?? this.routes.get(ROOT_PATH);
    if (!render) return;

    this.stack.push(path);

    void this.transitionTo(async (next) => {
      const page = render(next, params) ?? null;
      return page;
    });

    // BackButton visibility: hide on root, show elsewhere.
    if (path === ROOT_PATH) telegram.backButton.hide();
    else telegram.backButton.show(() => this.back());
  }

  /**
   * Crossfade current → next. Always gives the outgoing page a chance
   * to tear down.
   * @param {(container: HTMLElement) => Promise<Page | null>} mount
   */
  async transitionTo(mount) {
    this.container.style.transition = 'opacity 150ms var(--ease-out, ease)';
    this.container.style.opacity = '0';

    await new Promise((resolve) => setTimeout(resolve, 150));

    this.currentPage?.destroy?.();
    this.currentPage = null;
    this.container.innerHTML = '';

    this.currentPage = await mount(this.container);

    // next frame paints the new content before we fade back in.
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
    });
  }
}

function parseHash() {
  const raw = globalThis.location.hash.slice(1) || ROOT_PATH;
  const [path, query = ''] = raw.split('?');
  /** @type {Record<string, string>} */
  const params = {};
  new URLSearchParams(query).forEach((v, k) => {
    params[k] = v;
  });
  return { path, params };
}
