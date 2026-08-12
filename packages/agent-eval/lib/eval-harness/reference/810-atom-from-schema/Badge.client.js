/**
 * Dismiss behaviour for the Badge.
 *
 * React renders the badge and stops there; removing it is a runtime concern, so
 * it lives here as plain DOM code with no framework state involved.
 */
export default class Badge {
  constructor(element) {
    this.element = element;
    this.dismiss = element.querySelector(".dsa-badge__dismiss");

    this.handleDismiss = this.handleDismiss.bind(this);

    if (this.dismiss) {
      this.dismiss.addEventListener("click", this.handleDismiss);
    }
  }

  handleDismiss() {
    this.element.remove();
  }

  destroy() {
    if (this.dismiss) {
      this.dismiss.removeEventListener("click", this.handleDismiss);
    }
  }
}
