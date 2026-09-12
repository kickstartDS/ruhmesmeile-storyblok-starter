import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./callout.scss";

export interface CalloutProps {
  /** Short lead-in shown above the body copy. */
  heading: string;
  /** The body of the callout. */
  body: string;
  /** Visual weight. `strong` is used for the one callout that matters on a page. */
  emphasis?: "regular" | "strong";
}

export const CalloutContextDefault = forwardRef<
  HTMLElement,
  CalloutProps & HTMLAttributes<HTMLElement>
>(({ heading, body, emphasis = "regular", ...props }, ref) => (
  <aside
    {...props}
    ref={ref}
    className={`dsa-callout dsa-callout--${emphasis}`}
  >
    <p className="dsa-callout__heading">{heading}</p>
    <p className="dsa-callout__body">{body}</p>
  </aside>
));

CalloutContextDefault.displayName = "Callout";

export const CalloutContext = createContext(CalloutContextDefault);

export const Callout = forwardRef<
  HTMLElement,
  CalloutProps & HTMLAttributes<HTMLElement>
>((props, ref) => {
  const Component = useContext(CalloutContext);
  return <Component {...props} ref={ref} />;
});

Callout.displayName = "Callout";
