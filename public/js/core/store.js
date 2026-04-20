/**
 * Tiny pub-sub store. Pages subscribe on render(), unsubscribe on
 * destroy(). No frameworks, no immer, no reactivity magic — a
 * shallow-equal patch check dedupes redundant notifications.
 *
 * Usage:
 *   const store = createStore({ count: 0 });
 *   const unsub = store.subscribe((s) => console.log(s.count));
 *   store.set({ count: 1 });
 *   unsub();
 */

/**
 * @template T
 * @typedef {(state: T) => void} Subscriber
 */

/**
 * @template T
 * @param {T} initial
 */
export function createStore(initial) {
  /** @type {T} */
  let state = initial;
  /** @type {Set<Subscriber<T>>} */
  const subscribers = new Set();

  return {
    /** @returns {T} */
    get() {
      return state;
    },

    /** @param {Partial<T>} patch */
    set(patch) {
      if (!patch || typeof patch !== 'object') return;
      const next = { ...state, ...patch };
      if (shallowEqual(state, next)) return;
      state = next;
      for (const fn of subscribers) fn(state);
    },

    /**
     * @param {Subscriber<T>} fn
     * @returns {() => void} unsubscribe
     */
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

/** @param {object} a @param {object} b */
function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (/** @type {any} */ (a)[k] !== /** @type {any} */ (b)[k]) return false;
  }
  return true;
}
