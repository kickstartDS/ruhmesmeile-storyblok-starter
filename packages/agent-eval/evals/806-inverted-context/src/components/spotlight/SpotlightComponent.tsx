import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./spotlight.scss";

export interface SpotlightProps {
  /** The headline of the highlighted passage. */
  heading: string;
  /** The passage itself. */
  body: string;
  /** Optional attribution or aside, shown last. */
  footnote?: string;
}

export const SpotlightContextDefault = forwardRef<
  HTMLElement,
  SpotlightProps & HTMLAttributes<HTMLElement>
>(({ heading, body, footnote, ...props }, ref) => (
  <section {...props} ref={ref} className="dsa-spotlight">
    <h2 className="dsa-spotlight__heading">{heading}</h2>
    <p className="dsa-spotlight__body">{body}</p>
    {footnote ? <p className="dsa-spotlight__footnote">{footnote}</p> : null}
  </section>
));

SpotlightContextDefault.displayName = "Spotlight";

export const SpotlightContext = createContext(SpotlightContextDefault);

export const Spotlight = forwardRef<
  HTMLElement,
  SpotlightProps & HTMLAttributes<HTMLElement>
>((props, ref) => {
  const Component = useContext(SpotlightContext);
  return <Component {...props} ref={ref} />;
});

Spotlight.displayName = "Spotlight";
