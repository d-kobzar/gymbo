import { Page } from './page.base.js';
import { EmptyState } from '../components/empty-state.js';

/**
 * Temporary stub shown for routes that haven't been rewritten yet.
 * Each tab that the nav points to must resolve to something visible —
 * Phase 6 fills these in page-by-page.
 */
export class PlaceholderPage extends Page {
  render() {
    const title = /** @type {string} */ (this.props.title ?? 'Coming soon');
    const description = /** @type {string} */ (
      this.props.description ?? "This screen hasn't been rebuilt yet."
    );

    const shell = Page.el('div', { className: 'page-shell' });
    const header = Page.el('header', { className: 'page-header' });
    header.append(
      Page.el('h1', { className: 'page-header__title', text: title }),
    );
    shell.append(header);

    const emptyHost = Page.el('div');
    shell.append(emptyHost);

    const emptyState = new EmptyState(emptyHost, {
      icon:
        '<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 6v36M6 24h36"/></svg>',
      heading: 'In construction',
      description,
    });
    emptyState.render();

    this.root.append(shell);
  }
}
