import { Component } from './component.js';

/**
 * Skeleton placeholder with a shimmer pulse. Variant via props.variant:
 * 'line' (default), 'line-full', 'circle', 'card'.
 *
 * Optional `width` and `height` override inline.
 */
export class Skeleton extends Component {
  render() {
    const variant = /** @type {string} */ (this.props.variant ?? 'line');
    const node = Component.parse(`<span class="skeleton skeleton--${variant}"></span>`);
    if (this.props.width) node.style.width = /** @type {string} */ (this.props.width);
    if (this.props.height) node.style.height = /** @type {string} */ (this.props.height);
    this.root.replaceChildren(node);
  }
}
