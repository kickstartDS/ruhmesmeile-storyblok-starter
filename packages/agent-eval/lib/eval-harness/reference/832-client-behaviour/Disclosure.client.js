/**
 * Toggle behaviour for the Disclosure.
 *
 * The stylesheet reveals the panel off `aria-expanded`, so this module only has
 * to keep that attribute honest — there is no second piece of state to drift.
 */
export default class Disclosure {
  constructor(element) {
    this.element = element;
    this.trigger = element.querySelector(".dsa-disclosure__trigger");

    this.handleClick = this.handleClick.bind(this);
    this.trigger.addEventListener("click", this.handleClick);
  }

  get isOpen() {
    return this.trigger.getAttribute("aria-expanded") === "true";
  }

  handleClick() {
    this.trigger.setAttribute("aria-expanded", this.isOpen ? "false" : "true");
  }

  destroy() {
    this.trigger.removeEventListener("click", this.handleClick);
  }
}
