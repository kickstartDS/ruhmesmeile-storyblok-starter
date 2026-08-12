import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./media-card.scss";

export interface MediaCardProps {
  /** Card heading. */
  title: string;
  /** One or two lines of supporting copy. */
  summary: string;
  /** Source of the card's illustration. */
  imageSrc: string;
  /** Short topic labels shown under the copy. */
  tags?: string[];
}

export const MediaCardContextDefault = forwardRef<
  HTMLElement,
  MediaCardProps & HTMLAttributes<HTMLElement>
>(({ title, summary, imageSrc, tags = [], ...props }, ref) => (
  <article {...props} ref={ref} className="dsa-media-card">
    <img className="dsa-media-card__image" src={imageSrc} alt="" />

    <div className="dsa-media-card__body">
      <h3 className="dsa-media-card__title">{title}</h3>
      <p className="dsa-media-card__summary">{summary}</p>

      {tags.length > 0 ? (
        <ul className="dsa-media-card__tags">
          {tags.map((tag) => (
            <li className="dsa-media-card__tag" key={tag}>
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
    </div>

    <button className="dsa-media-card__save" type="button" aria-label="Save this card">
      <svg
        className="dsa-media-card__save-icon"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <path d="M4 2h8v12l-4-3-4 3z" />
      </svg>
    </button>
  </article>
));

MediaCardContextDefault.displayName = "MediaCard";

export const MediaCardContext = createContext(MediaCardContextDefault);

export const MediaCard = forwardRef<
  HTMLElement,
  MediaCardProps & HTMLAttributes<HTMLElement>
>((props, ref) => {
  const Component = useContext(MediaCardContext);
  return <Component {...props} ref={ref} />;
});

MediaCard.displayName = "MediaCard";
