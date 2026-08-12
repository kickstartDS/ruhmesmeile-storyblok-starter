/**
 * Client behaviour for the Dismissible banner.
 *
 * Instantiate one per element; call `destroy()` when the surrounding view goes
 * away. Emits a bubbling `dismissed` event when the banner is closed.
 */
export default class Dismissible {
  constructor(element) {
    this.element = element;
    this.dismissed = false;
    this.button = element.querySelector(".dsa-dismissible__close");

    this.handleClick = this.handleClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);

    this.button.addEventListener("click", this.handleClick);
    document.addEventListener("keydown", this.handleKeydown);
  }

  handleClick() {
    this.dismiss();
  }

  handleKeydown(event) {
    if (event.key === "Escape") {
      this.dismiss();
    }
  }

  dismiss() {
    if (this.dismissed) return;
    this.dismissed = true;
    this.element.hidden = true;
    this.element.dispatchEvent(new CustomEvent("dismissed", { bubbles: true }));
  }

  destroy() {
    this.button.removeEventListener("click", this.handleClick);
    document.removeEventListener("keydown", this.handleKeydown);
  }
}
