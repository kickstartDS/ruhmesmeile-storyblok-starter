/**
 * Base class for a component's client-side behaviour.
 *
 * One instance per matching element. The constructor is where listeners are
 * wired; anything that has to be undone is registered with `onDisconnect` so
 * the instance can be torn down when its element leaves the DOM.
 */
export class Component {
  constructor(element) {
    this.element = element;
    this._teardown = [];
  }

  /** Register a cleanup callback. Run once, when the element disconnects. */
  onDisconnect(callback) {
    this._teardown.push(callback);
  }

  /** Run every registered cleanup callback and forget them. */
  disconnect() {
    for (const callback of this._teardown.splice(0)) callback();
  }
}
