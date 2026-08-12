/**
 * Client behaviour for the FilterFlyout.
 *
 * Instantiate one per element; call `destroy()` when the surrounding view goes
 * away. Visibility is driven from `aria-expanded` in the stylesheet, so this
 * module only has to keep that attribute honest.
 */
export default class FilterFlyout {
  constructor(element) {
    this.element = element;
    this.trigger = element.querySelector(".dsa-filter-flyout__trigger");
    this.panel = element.querySelector(".dsa-filter-flyout__panel");

    this.handleClick = this.handleClick.bind(this);

    this.trigger.addEventListener("click", this.handleClick);
  }

  get isOpen() {
    return this.trigger.getAttribute("aria-expanded") === "true";
  }

  handleClick() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.trigger.setAttribute("aria-expanded", "true");
  }

  close() {
    this.trigger.setAttribute("aria-expanded", "false");
  }

  destroy() {
    this.trigger.removeEventListener("click", this.handleClick);
  }
}
