import { HTMLAttributes, forwardRef, createContext, useContext } from "react";

import "./quote.scss";

export interface QuoteProps {
  /** The quoted passage. */
  text: string;
  /** Who said it. */
  attribution?: string;
  /** Where they said it — a publication, talk or role. */
  source?: string;
}

export const QuoteContextDefault = forwardRef<
  HTMLQuoteElement,
  QuoteProps & HTMLAttributes<HTMLQuoteElement>
>(({ text, attribution, source, ...props }, ref) => (
  <blockquote {...props} ref={ref} className="dsa-quote">
    <p className="dsa-quote__text">{text}</p>
    {attribution ? (
      <footer className="dsa-quote__attribution">
        <span className="dsa-quote__author">{attribution}</span>
        {source ? <cite className="dsa-quote__source">{source}</cite> : null}
      </footer>
    ) : null}
  </blockquote>
));

export const QuoteContext = createContext(QuoteContextDefault);

export const Quote = forwardRef<
  HTMLQuoteElement,
  QuoteProps & HTMLAttributes<HTMLQuoteElement>
>((props, ref) => {
  const Component = useContext(QuoteContext);
  return <Component {...props} ref={ref} />;
});

Quote.displayName = "Quote";
