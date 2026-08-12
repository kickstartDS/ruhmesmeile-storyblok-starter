import { HTMLAttributes, forwardRef, createContext, useContext } from "react";

import "./rating.scss";

export interface RatingProps {
  /** What is being rated. Used as the accessible name. */
  label: string;
  /** Score, from `0` to `max`. Fractions are allowed. */
  value: number;
  /** Highest possible score. */
  max?: number;
  /** Visual treatment of the unfilled remainder. */
  kind?: "solid" | "outline";
}

export const RatingContextDefault = forwardRef<
  HTMLDivElement,
  RatingProps & HTMLAttributes<HTMLDivElement>
>(({ label, value, max = 5, kind = "solid", ...props }, ref) => (
  <div
    {...props}
    ref={ref}
    role="img"
    aria-label={`${label}: ${value} out of ${max}`}
    className={`dsa-rating dsa-rating--${kind}`}
  >
    {Array.from({ length: max }, (_, index) => (
      <span
        key={index}
        aria-hidden="true"
        className={`dsa-rating__star dsa-rating__star--${
          index < Math.floor(value) ? "full" : "empty"
        }`}
      >
        ★
      </span>
    ))}
    <span className="dsa-rating__label">{label}</span>
  </div>
));

export const RatingContext = createContext(RatingContextDefault);

export const Rating = forwardRef<
  HTMLDivElement,
  RatingProps & HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const Component = useContext(RatingContext);
  return <Component {...props} ref={ref} />;
});

Rating.displayName = "Rating";
