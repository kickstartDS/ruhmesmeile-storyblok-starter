/**
 * Client behaviour for the FilterFlyout.
 *
 * Instantiate one per element; call `destroy()` when the surrounding view goes
 * away. Visibility is driven from `aria-expanded` in the stylesheet, so this
 * module only has to keep that attribute honest — and make sure the keyboard
 * can follow the panel in and back out again.
 */
export default class FilterFlyout {
  constructor(element) {
    this.element = element;
    this.trigger = element.querySelector(".dsa-filter-flyout__trigger");
    this.panel = element.querySelector(".dsa-filter-flyout__panel");

    this.handleClick = this.handleClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);

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

  handleKeydown(event) {
    if (event.key === "Escape") {
      this.close();
    }
  }

  open() {
    this.trigger.setAttribute("aria-expanded", "true");
    this.panel.focus();
    document.addEventListener("keydown", this.handleKeydown);
  }

  close() {
    this.trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", this.handleKeydown);
    this.trigger.focus();
  }

  destroy() {
    this.trigger.removeEventListener("click", this.handleClick);
    document.removeEventListener("keydown", this.handleKeydown);
  }
}
