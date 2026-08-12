/**
 * Dismiss behaviour for the NotificationBanner.
 *
 * The dismiss control is a real button rendered by the design system's Button,
 * so keyboard operation, focus and Enter/Space activation are already handled;
 * all that is left here is removing the banner on click.
 */
export default class NotificationBanner {
  constructor(element) {
    this.element = element;
    this.dismiss = element.querySelector(".dsa-notification-banner__dismiss");

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
