import { Button, Headline, Text } from "@kickstartds/ds";
import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./notification-banner.scss";

export interface NotificationBannerProps {
  /** Short, prominent summary of the announcement. */
  headline: string;
  /** Body copy explaining the announcement. */
  message: string;
  /** Visual emphasis of the banner. */
  variant?: "info" | "success" | "warning" | "danger";
  /** Label of the optional call to action. */
  actionLabel?: string;
  /** Icon identifier rendered before the action label. */
  actionIcon?: string;
  /** Accessible label of the dismiss control. */
  dismissLabel?: string;
}

export const NotificationBannerContextDefault = forwardRef<
  HTMLDivElement,
  NotificationBannerProps & HTMLAttributes<HTMLDivElement>
>(
  (
    {
      headline,
      message,
      variant = "info",
      actionLabel,
      actionIcon,
      dismissLabel = "Dismiss notification",
      ...props
    },
    ref,
  ) => (
    <div
      {...props}
      ref={ref}
      className={`dsa-notification-banner dsa-notification-banner--${variant}`}
      role="status"
    >
      <div className="dsa-notification-banner__body">
        <Headline
          className="dsa-notification-banner__headline"
          text={headline}
          level="h2"
          spaceAfter="none"
        />
        <Text className="dsa-notification-banner__message" text={message} />
      </div>

      {actionLabel ? (
        <Button
          className="dsa-notification-banner__action"
          label={actionLabel}
          icon={actionIcon}
          variant="secondary"
          size="small"
        />
      ) : null}

      <Button
        className="dsa-notification-banner__dismiss"
        label={dismissLabel}
        icon="close"
        variant="tertiary"
        size="small"
      />
    </div>
  ),
);

NotificationBannerContextDefault.displayName = "NotificationBanner";

export const NotificationBannerContext = createContext(
  NotificationBannerContextDefault,
);

export const NotificationBanner = forwardRef<
  HTMLDivElement,
  NotificationBannerProps & HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const Component = useContext(NotificationBannerContext);
  return <Component {...props} ref={ref} />;
});

NotificationBanner.displayName = "NotificationBanner";
