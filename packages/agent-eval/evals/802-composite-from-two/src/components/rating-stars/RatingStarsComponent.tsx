import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./rating-stars.scss";

export interface RatingStarsProps {
  /** How many stars are filled, from zero to `max`. */
  value: number;
  /** How many stars are shown in total. */
  max?: number;
  /** Accessible description of the score, e.g. "Rated 4 out of 5". */
  label: string;
}

const Star = ({ filled }: { filled: boolean }) => (
  <svg
    className={`dsa-rating-stars__star dsa-rating-stars__star--${
      filled ? "filled" : "empty"
    }`}
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L1.5 7.7l5.9-.9z" />
  </svg>
);

export const RatingStarsContextDefault = forwardRef<
  HTMLElement,
  RatingStarsProps & HTMLAttributes<HTMLElement>
>(({ value, max = 5, label, ...props }, ref) => (
  <span
    {...props}
    ref={ref}
    className="dsa-rating-stars"
    role="img"
    aria-label={label}
  >
    {Array.from({ length: max }, (_, index) => (
      <Star key={index} filled={index < Math.round(value)} />
    ))}
  </span>
));

RatingStarsContextDefault.displayName = "RatingStars";

export const RatingStarsContext = createContext(RatingStarsContextDefault);

export const RatingStars = forwardRef<
  HTMLElement,
  RatingStarsProps & HTMLAttributes<HTMLElement>
>((props, ref) => {
  const Component = useContext(RatingStarsContext);
  return <Component {...props} ref={ref} />;
});

RatingStars.displayName = "RatingStars";
