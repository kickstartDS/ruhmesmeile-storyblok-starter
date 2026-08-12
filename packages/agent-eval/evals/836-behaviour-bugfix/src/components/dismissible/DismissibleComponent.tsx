import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./dismissible.scss";

export interface DismissibleProps {
  /** The text shown in the banner. */
  message: string;
  /** Accessible name for the close control. */
  closeLabel?: string;
}

export const DismissibleContextDefault = forwardRef<
  HTMLDivElement,
  DismissibleProps & HTMLAttributes<HTMLDivElement>
>(({ message, closeLabel = "Dismiss", ...props }, ref) => (
  <div {...props} ref={ref} className="dsa-dismissible" role="status">
    <p className="dsa-dismissible__message">{message}</p>
    <button
      className="dsa-dismissible__close"
      type="button"
      aria-label={closeLabel}
    >
      <span aria-hidden="true">&times;</span>
    </button>
  </div>
));

DismissibleContextDefault.displayName = "Dismissible";

export const DismissibleContext = createContext(DismissibleContextDefault);

export const Dismissible = forwardRef<
  HTMLDivElement,
  DismissibleProps & HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const Component = useContext(DismissibleContext);
  return <Component {...props} ref={ref} />;
});

Dismissible.displayName = "Dismissible";
