/**
 * Minimal base class for DOM components. Enforces a render/destroy
 * contract and gives subclasses an AbortController-backed listener
 * helper so we never leak event handlers across remounts.
 *
 * Subclass pattern:
 *
 *   class MyWidget extends Component {
 *     constructor(root, props) { super(root, props); }
 *     render() {
 *       this.root.innerHTML = template(this.props);
 *       this.on(this.root, 'click', this.handleClick);
 *     }
 *     handleClick = () => { ... };
 *   }
 */
export class Component {
  /**
   * @param {HTMLElement} root
   * @param {Record<string, unknown>} props
   */
  constructor(root, props = {}) {
    if (!(root instanceof HTMLElement)) {
      throw new TypeError('Component requires an HTMLElement root');
    }
    this.root = root;
    this.props = props;
    this.controller = new AbortController();
  }

  /** Subclasses override. */
  render() {}

  /** Subclasses may override; must call super.destroy() first. */
  destroy() {
    this.controller.abort();
    this.controller = new AbortController();
    this.root.innerHTML = '';
  }

  /**
   * AbortController-scoped addEventListener. Auto-removed by destroy().
   * @param {EventTarget} target
   * @param {string} type
   * @param {EventListenerOrEventListenerObject} handler
   * @param {AddEventListenerOptions=} options
   */
  on(target, type, handler, options) {
    target.addEventListener(type, handler, {
      ...(options ?? {}),
      signal: this.controller.signal,
    });
  }

  /**
   * Utility: create an element tree from a template string.
   * @param {string} html
   * @returns {HTMLElement}
   */
  static parse(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    const node = tpl.content.firstElementChild;
    if (!(node instanceof HTMLElement)) {
      throw new Error('Component template produced no element');
    }
    return node;
  }
}
