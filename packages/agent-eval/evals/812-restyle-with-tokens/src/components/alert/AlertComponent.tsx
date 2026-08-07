import { forwardRef } from "react";

import "./alert.scss";

export interface AlertProps {
  /** Body copy of the alert. */
  message: string;
  /** Optional bold heading above the message. */
  title?: string;
  /** Severity of the alert. */
  variant?: "info" | "success" | "warning" | "danger";
  /** Reduces padding for dense layouts. */
  compact?: boolean;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ message, title, variant = "info", compact = false }, ref) => (
    <div
      ref={ref}
      className={[
        "dsa-alert",
        `dsa-alert--${variant}`,
        compact ? "dsa-alert--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role={variant === "danger" ? "alert" : "status"}
    >
      {title ? <p className="dsa-alert__title">{title}</p> : null}
      <p className="dsa-alert__message">{message}</p>
    </div>
  ),
);

Alert.displayName = "Alert";
