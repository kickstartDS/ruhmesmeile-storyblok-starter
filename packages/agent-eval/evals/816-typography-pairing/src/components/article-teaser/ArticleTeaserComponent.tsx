import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./article-teaser.scss";

export interface ArticleTeaserProps {
  /** Small label above the title, e.g. the article's section. */
  kicker: string;
  /** The article's title. */
  title: string;
  /** A sentence or two from the top of the article. */
  excerpt: string;
  /** Estimated reading time, e.g. "6 min read". */
  readingTime?: string;
}

export const ArticleTeaserContextDefault = forwardRef<
  HTMLElement,
  ArticleTeaserProps & HTMLAttributes<HTMLElement>
>(({ kicker, title, excerpt, readingTime, ...props }, ref) => (
  <article {...props} ref={ref} className="dsa-article-teaser">
    <p className="dsa-article-teaser__kicker">{kicker}</p>
    <h3 className="dsa-article-teaser__title">{title}</h3>
    <p className="dsa-article-teaser__excerpt">{excerpt}</p>

    {readingTime ? (
      <p className="dsa-article-teaser__reading-time">{readingTime}</p>
    ) : null}
  </article>
));

ArticleTeaserContextDefault.displayName = "ArticleTeaser";

export const ArticleTeaserContext = createContext(ArticleTeaserContextDefault);

export const ArticleTeaser = forwardRef<
  HTMLElement,
  ArticleTeaserProps & HTMLAttributes<HTMLElement>
>((props, ref) => {
  const Component = useContext(ArticleTeaserContext);
  return <Component {...props} ref={ref} />;
});

ArticleTeaser.displayName = "ArticleTeaser";
