import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./badge.scss";

export interface BadgeProps {
  /** Text displayed inside the badge. */
  label: string;
  /** Visual emphasis of the badge. */
  variant?: "neutral" | "informative" | "positive" | "notice" | "negative";
  /** Rendered size of the badge. */
  size?: "small" | "medium";
  /** Optional icon identifier rendered before the label. */
  icon?: string;
  /** Renders a dismiss control that removes the badge. */
  dismissible?: boolean;
}

export const BadgeContextDefault = forwardRef<
  HTMLSpanElement,
  BadgeProps & HTMLAttributes<HTMLSpanElement>
>(
  (
    {
      label,
      variant = "neutral",
      size = "medium",
      icon,
      dismissible = false,
      ...props
    },
    ref,
  ) => (
    <span
      {...props}
      ref={ref}
      className={`dsa-badge dsa-badge--${variant} dsa-badge--${size}`}
    >
      {icon ? (
        <span className="dsa-badge__icon" data-icon={icon} aria-hidden="true" />
      ) : null}

      <span className="dsa-badge__label">{label}</span>

      {dismissible ? (
        <button
          type="button"
          className="dsa-badge__dismiss"
          aria-label={`Dismiss ${label}`}
        >
          <span className="dsa-badge__dismiss-icon" aria-hidden="true">
            &times;
          </span>
        </button>
      ) : null}
    </span>
  ),
);

BadgeContextDefault.displayName = "Badge";

export const BadgeContext = createContext(BadgeContextDefault);

export const Badge = forwardRef<
  HTMLSpanElement,
  BadgeProps & HTMLAttributes<HTMLSpanElement>
>((props, ref) => {
  const Component = useContext(BadgeContext);
  return <Component {...props} ref={ref} />;
});

Badge.displayName = "Badge";
