import { Component } from '../components/component.js';

/**
 * Base class for every route page. A page is a Component that owns the
 * entire #page-container for its lifetime. Subclasses override
 * render() to mount content; destroy() clears listeners automatically
 * via the inherited AbortController.
 *
 * Pages may opt into MainButton by calling setMainButton(); the router
 * is responsible for tearing down the mount via destroy() on every
 * navigation.
 *
 * Subclass pattern:
 *
 *   export class HomePage extends Page {
 *     async render() {
 *       this.root.append(this.renderHeader());
 *       const data = await this.load();
 *       this.root.append(this.renderBody(data));
 *     }
 *   }
 */
export class Page extends Component {
  /**
   * Convenience helper: create a DOM element with class and text.
   * @param {string} tag
   * @param {{ className?: string, text?: string, html?: string }} [opts]
   */
  static el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (opts.text != null) node.textContent = String(opts.text);
    else if (opts.html != null) node.innerHTML = opts.html;
    return node;
  }

  /**
   * Section wrapper with a mono kicker + body; used all over the app
   * (Home PR list, Program week strip, etc.).
   * @param {string} kicker
   */
  static section(kicker) {
    const section = Page.el('section', { className: 'page-section' });
    if (kicker) {
      const h = Page.el('h3', { className: 'page-section__kicker mono', text: kicker });
      section.append(h);
    }
    return section;
  }
}
