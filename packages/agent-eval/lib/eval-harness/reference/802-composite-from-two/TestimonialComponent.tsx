import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import { Portrait } from "../portrait/PortraitComponent";
import { RatingStars } from "../rating-stars/RatingStarsComponent";

import "./testimonial.scss";

export interface TestimonialProps {
  /** What the customer said. */
  quote: string;
  /** Who said it. */
  authorName: string;
  /** The author's role and company. */
  authorRole?: string;
  /** Image source for the author's picture. */
  portraitSrc: string;
  /** The score the author gave, out of five. */
  rating: number;
  /** Accessible description of the score. */
  ratingLabel: string;
}

export const TestimonialContextDefault = forwardRef<
  HTMLElement,
  TestimonialProps & HTMLAttributes<HTMLElement>
>(
  (
    { quote, authorName, authorRole, portraitSrc, rating, ratingLabel },
    ref,
  ) => (
    <figure ref={ref} className="dsa-testimonial">
      <RatingStars
        className="dsa-testimonial__rating"
        value={rating}
        label={ratingLabel}
      />

      <blockquote className="dsa-testimonial__quote">{quote}</blockquote>

      <figcaption className="dsa-testimonial__author">
        <Portrait
          className="dsa-testimonial__portrait"
          src={portraitSrc}
          alt={authorName}
          size="small"
        />

        <span className="dsa-testimonial__attribution">
          <span className="dsa-testimonial__name">{authorName}</span>
          {authorRole ? (
            <span className="dsa-testimonial__role">{authorRole}</span>
          ) : null}
        </span>
      </figcaption>
    </figure>
  ),
);

TestimonialContextDefault.displayName = "Testimonial";

export const TestimonialContext = createContext(TestimonialContextDefault);

export const Testimonial = forwardRef<
  HTMLElement,
  TestimonialProps & HTMLAttributes<HTMLElement>
>((props, ref) => {
  const Component = useContext(TestimonialContext);
  return <Component {...props} ref={ref} />;
});

Testimonial.displayName = "Testimonial";
