import {
  HTMLAttributes,
  FC,
  PropsWithChildren,
  forwardRef,
  createContext,
  useContext,
} from "react";
import classnames from "classnames";
import {
  TeaserBoxContextDefault,
  TeaserBoxContext,
} from "@kickstartds/base/lib/teaser-box";
import { TeaserCardProps } from "./TeaserCardProps";
import "./teaser-card.scss";
import { Container } from "@kickstartds/core/lib/container";
import { compiler } from "markdown-to-jsx";
import { deepMergeDefaults } from "../helpers";
import defaults from "./TeaserCardDefaults";

export type { TeaserCardProps };

export const TeaserCardContextDefault = forwardRef<
  HTMLDivElement,
  TeaserCardProps & HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  // `newTab` is resolved at story-processing time from Storyblok's multilink
  // target-blank toggle and isn't part of the generated schema type. The
  // base Teaser's client-side "js-linked" whole-card click behavior reads
  // the rendered anchor's `target` attribute, so forwarding `newTab` to the
  // Button here makes both the visible link and the card-wide click respect it.
  const { newTab, ...typedProps } = props as TeaserCardProps &
    HTMLAttributes<HTMLDivElement> & { newTab?: boolean };
  const {
    headline,
    text,
    button,
    url,
    image,
    imageRatio = "wide",
    imageAlt,
    imageHoverEffect = true,
    label,
    layout = "stack",
    centered = false,
    ...rest
  } = typedProps;

  const hasLink = Boolean(url?.trim()) && url !== "#";

  return (
    <Container name="teaser-card">
      <div
        ks-inverted={layout === "compact" && "true"}
        className={classnames(
          `dsa-teaser-card`,
          `dsa-teaser-card--${layout}`,
          `dsa-teaser-card--${imageRatio}`,
          label && `dsa-teaser-card--with-label`,
          centered && `dsa-teaser-card--centered`,
          !image && "dsa-teaser-card--no-image",
          !imageHoverEffect && "dsa-teaser-card--no-image-hover",
          !hasLink && "dsa-teaser-card--no-link",
        )}
      >
        {label && layout !== "compact" && (
          <span className="dsa-teaser-card__label">{label}</span>
        )}
        <TeaserBoxContextDefault
          {...rest}
          topic={headline}
          text={text}
          // @ts-expect-error
          renderTopic={() => (
            <>
              {label && layout === "compact" && (
                <span className="dsa-teaser-card__label">{label}</span>
              )}
              {compiler(headline)}
            </>
          )}
          link={{
            hidden: button?.hidden || !hasLink,
            label: button.label,
            variant: "primary",
            url: url,
            icon: button?.chevron ? "chevron-right" : undefined,
            // `newTab` isn't part of the base package's generated `link` type
            // resolved here, but the underlying Button primitive supports it.
            ...({ newTab } as any),
          }}
          image={image}
          alt={imageAlt}
          ref={ref}
        />
      </div>
    </Container>
  );
});

export const TeaserCardContext = createContext(TeaserCardContextDefault);
export const TeaserCard = forwardRef<
  HTMLDivElement,
  TeaserCardProps & HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const Component = useContext(TeaserCardContext);
  return <Component {...deepMergeDefaults(defaults, props)} ref={ref} />;
});
TeaserCard.displayName = "TeaserCard";

export const TeaserBoxProvider: FC<PropsWithChildren> = (props) => (
  <TeaserBoxContext.Provider {...props} value={TeaserCard} />
);
