import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./price-tag.scss";

export interface PriceTagProps {
  /** The price itself, already formatted for display. */
  amount: string;
  /** Billing period the price applies to. */
  period?: string;
  /** Visual weight of the tag. */
  variant?: "regular" | "highlight";
  /** A short qualifier shown beneath the price. */
  note?: {
    /** The qualifier's text. */
    text: string;
    /** Whether the qualifier is called out. */
    emphasis?: boolean;
  };
}

export const PriceTagContextDefault = forwardRef<
  HTMLDivElement,
  PriceTagProps & HTMLAttributes<HTMLDivElement>
>(({ amount, period, variant = "regular", note, ...props }, ref) => (
  <div
    {...props}
    ref={ref}
    className={`dsa-price-tag dsa-price-tag--${variant}`}
  >
    <p className="dsa-price-tag__amount">
      {amount}
      {period ? (
        <span className="dsa-price-tag__period">{` / ${period}`}</span>
      ) : null}
    </p>

    {note ? (
      <p
        className={`dsa-price-tag__note${
          note.emphasis ? " dsa-price-tag__note--emphasis" : ""
        }`}
      >
        {note.text}
      </p>
    ) : null}
  </div>
));

PriceTagContextDefault.displayName = "PriceTag";

export const PriceTagContext = createContext(PriceTagContextDefault);

export const PriceTag = forwardRef<
  HTMLDivElement,
  PriceTagProps & HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const Component = useContext(PriceTagContext);
  return <Component {...props} ref={ref} />;
});

PriceTag.displayName = "PriceTag";
