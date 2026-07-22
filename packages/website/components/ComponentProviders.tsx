/*  eslint react/display-name: 0 */
import {
  AnchorHTMLAttributes,
  FC,
  HTMLAttributes,
  ImgHTMLAttributes,
  PropsWithChildren,
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  ComponentProps,
} from "react";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { blurhashToCssGradientString } from "@unpic/placeholder";
import { Image } from "@unpic/react/nextjs";
import { StoryblokComponent } from "@storyblok/react";

import {
  PictureContext,
  PictureContextDefault,
} from "@kickstartds/base/lib/picture";
import { LinkContext, LinkProps } from "@kickstartds/base/lib/link";
import { PictureProps } from "@kickstartds/base/lib/picture/typing";
import {
  StorytellingContext,
  StorytellingContextDefault,
} from "@kickstartds/content/lib/storytelling";
import { StorytellingProps } from "@kickstartds/content/lib/storytelling/typing";

import {
  NavMainContext,
  NavMainContextDefault,
} from "@kickstartds/design-system/nav-main";
import { NavToggle } from "@kickstartds/design-system/nav-toggle";
import { NavTopbar } from "@kickstartds/design-system/nav-topbar";
import { NavFlyout } from "@kickstartds/design-system/nav-flyout";
import { NavMainProps } from "@kickstartds/design-system/nav-main";
import { BlogTeaserContext } from "@kickstartds/design-system/blog-teaser";
import { BlogAsideContext } from "@kickstartds/design-system/blog-aside";
import { BlogAuthorContext } from "@kickstartds/design-system/blog-author";
import { BlogHeadContext } from "@kickstartds/design-system/blog-head";
import { CtaContext } from "@kickstartds/design-system/cta";
import { FeatureContext } from "@kickstartds/design-system/feature";
import { StatContext } from "@kickstartds/design-system/stat";
import {
  SplitEvenContext,
  SplitEvenContextDefault,
} from "@kickstartds/design-system/split-even";
import {
  SplitWeightedContext,
  SplitWeightedContextDefault,
} from "@kickstartds/design-system/split-weighted";
import { TestimonialContext } from "@kickstartds/design-system/testimonial";
import {
  HeroContextDefault,
  HeroContext,
} from "@kickstartds/design-system/hero";

import { StoryblokSubComponent } from "./StoryblokSubComponent";
import { IconProvider } from "./icon/IconProvider";
import { DownloadsProvider } from "./downloads/DownloadsProvider";

import { useHeaderButton } from "./HeaderButtonContext";
import { useLanguage, useAlternates } from "./LanguageContext";
import { useBlurHashes } from "./BlurHashContext";
import { useImagePriority } from "./ImagePriorityContext";
import { useImageSize } from "./ImageSizeContext";
import { useImageRatio } from "./ImageRatioContext";
import { unflatten } from "@/helpers/unflatten";

const Link = forwardRef<
  HTMLAnchorElement,
  LinkProps & AnchorHTMLAttributes<HTMLAnchorElement>
>(({ href, ...props }, ref) => (
  <NextLink ref={ref} href={href || "#"} {...props} />
));

const LinkProvider: FC<PropsWithChildren> = (props) => (
  <LinkContext.Provider value={Link} {...props} />
);

const resetBackgroundBlurHash = (image: HTMLImageElement) => {
  requestAnimationFrame(() => {
    image.style.background = "";
  });
};

// Add a quality filter to a Storyblok asset URL, merging it into an existing
// `filters:...` segment (e.g. `filters:focal(...)`) instead of appending a
// second, separate `filters:` segment - which produces an invalid Storyblok
// image service URL and breaks unpic's URL parsing (and, with it, any
// focal-point/hotspot cropping already applied to the image).
const addQualityFilter = (url: string) => {
  if (!url) return url;
  // Already has a filters: segment at the end - merge the quality filter in
  if (/filters:[^/]+$/.test(url)) {
    return url.replace(/filters:([^/]+)$/, "filters:$1:quality(50)");
  }
  // Has /m/ but no filters segment yet - append one
  if (/\/m\//.test(url)) {
    return `${url}/filters:quality(50)`;
  }
  // No /m/ at all - append the full modifier path
  return `${url}/m/filters:quality(50)`;
};

const Picture = forwardRef<
  HTMLImageElement,
  PictureProps & ImgHTMLAttributes<HTMLImageElement> & { autoSize?: boolean }
>(({ src, lazy, autoSize, ...props }, ref) => {
  const internalRef = useRef<HTMLImageElement>(null);

  const blurHashes = useBlurHashes();
  const priority = useImagePriority();
  const size = useImageSize();
  const ratio = useImageRatio();

  useImperativeHandle<HTMLImageElement | null, HTMLImageElement | null>(
    ref,
    () => internalRef.current,
  );

  useEffect(() => {
    if (internalRef.current) resetBackgroundBlurHash(internalRef.current);
  }, []);

  if (!src || typeof src !== "string") return;
  const fileUrl = !src.startsWith("http") ? `https:${src}` : src;
  const [width, height] = fileUrl.match(/\/(\d+)x(\d+)\//)?.slice(1) || [];
  const maxWidth = parseInt(width) > size ? Math.floor(size) : parseInt(width);
  const maxHeight =
    parseInt(width) > size
      ? Math.floor((parseInt(height) * size) / parseInt(width))
      : parseInt(height);

  // Don't optimize SVG images - https://github.com/kickstartDS/storyblok-starter/issues/19
  return fileUrl.endsWith(".svg") ? (
    <PictureContextDefault
      ref={internalRef}
      {...props}
      src={fileUrl}
      width={maxWidth}
      height={maxHeight}
      alt={props.alt || ""}
      lazy={priority ? false : lazy}
      fetchPriority="high"
      loading={priority ? "eager" : "lazy"}
    />
  ) : (
    <Image
      ref={internalRef}
      {...props}
      alt={props.alt || ""}
      src={priority ? addQualityFilter(fileUrl) : fileUrl}
      layout={autoSize ? "fullWidth" : "constrained"}
      aspectRatio={ratio > 0 ? ratio : undefined}
      width={maxWidth}
      height={autoSize || ratio > 0 ? undefined : maxHeight}
      priority={lazy === false || priority}
      onLoad={(event) => {
        if (event.target instanceof HTMLImageElement) {
          resetBackgroundBlurHash(event.target);
        }
      }}
      background={
        blurHashes[fileUrl]
          ? blurhashToCssGradientString(blurHashes[fileUrl])
          : undefined
      }
      objectFit={undefined}
    />
  );
});

const PictureProvider: FC<PropsWithChildren> = (props) => (
  <PictureContext.Provider {...props} value={Picture} />
);

// Derive a CSS `object-position` value (e.g. "62.3% 41.7%") from a Storyblok
// asset URL that carries both the original image dimensions (baked into the
// asset path, e.g. /f/12345/1200x800/hash/name.jpg) and a focal point filter
// (`filters:focal(x1xy1:x2xy2)`, in original-image pixel coordinates).
// This lets the browser always frame the editor-chosen hotspot correctly via
// CSS, regardless of the actual rendered box size/aspect ratio - independent
// of whatever crop dimensions were requested from Storyblok's image service.
// Scoped to Hero only; does not touch the shared Picture/unpic pipeline.
const getFocusObjectPosition = (url?: string): string | undefined => {
  if (!url) return undefined;

  const dimensions = url.match(/\/(\d+)x(\d+)\//);
  const focal = url.match(/filters:focal\((\d+)x(\d+):(\d+)x(\d+)\)/);
  if (!dimensions || !focal) return undefined;

  const width = parseInt(dimensions[1], 10);
  const height = parseInt(dimensions[2], 10);
  if (!width || !height) return undefined;

  const [x1, y1, x2, y2] = focal.slice(1).map((value) => parseInt(value, 10));
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  const left = Math.min(100, Math.max(0, (centerX / width) * 100));
  const top = Math.min(100, Math.max(0, (centerY / height) * 100));

  return `${left.toFixed(1)}% ${top.toFixed(1)}%`;
};

// Extract the original (pre-crop) pixel width baked into a Storyblok asset
// URL (e.g. /f/12345/1260x840/hash/name.jpg -> 1260). Used to avoid
// requesting crops wider than the source image, which would force Storyblok
// to upscale the delivered image and produce a blurry, over-zoomed result.
const getOriginalWidth = (url?: string): number | undefined => {
  if (!url) return undefined;
  const match = url.match(/\/(\d+)x(\d+)\//);
  return match ? parseInt(match[1], 10) : undefined;
};

const Hero = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof HeroContextDefault> & HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const { image, className, ...rest } = props;

  const addOrReplaceFilter = (url: string, newFilter: string) => {
    if (!url) return url;
    // Replace dimension pattern but preserve any filter parameters that follow
    if (/\/m\/\d+x\d+/.test(url)) {
      return url.replace(/\/m\/\d+x\d+/, `/${newFilter}`);
    }
    // URL has /m/ but no dimensions (e.g. /m/filters:...) — insert dimensions after /m/
    if (/\/m\//.test(url)) {
      return url.replace(/\/m\//, `/${newFilter}/`);
    }
    // No /m/ at all — append
    return `${url}/${newFilter}`;
  };

  // Request width-scaled, aspect-preserving images only (height=0 disables
  // Storyblok's server-side crop decision entirely). Previously a fixed
  // crop height (sourced from the base/mobile min-height design token) was
  // requested at every breakpoint width, e.g. 1600x288 on desktop - a ~5.6:1
  // aspect ratio for an image that might natively be closer to 1.5:1. That
  // forced Storyblok to slice out a tiny sliver of the original image, which
  // the browser then had to stretch further to fill the actual (much taller)
  // rendered Hero box on wide viewports, compounding into a heavily
  // over-zoomed/blurry result. CSS `object-fit: cover` plus the
  // `--dsa-hero-focus-position` custom property (see hero.scss) now fully
  // own the visual framing/cropping, so no fixed-height crop request is
  // needed - this also unifies default/small/fullImage/fullScreen onto a
  // single strategy.
  const capWidth = (url: string, width: number) => {
    const originalWidth = getOriginalWidth(url);
    return originalWidth ? Math.min(width, originalWidth) : width;
  };

  const src =
    (image &&
      (image.src
        ? addOrReplaceFilter(image.src, `m/${capWidth(image.src, 600)}x0`)
        : image.src)) ||
    undefined;
  const srcMobile =
    (image &&
      (image.srcMobile
        ? addOrReplaceFilter(
            image.srcMobile,
            `m/${capWidth(image.srcMobile, 600)}x0`,
          )
        : image.srcMobile)) ||
    src ||
    "";
  const srcTablet =
    (image &&
      (image.srcTablet
        ? addOrReplaceFilter(
            image.srcTablet,
            `m/${capWidth(image.srcTablet, 950)}x0`,
          )
        : image.srcTablet)) ||
    undefined;
  const srcDesktop =
    (image &&
      (image.srcDesktop
        ? addOrReplaceFilter(
            image.srcDesktop,
            `m/${capWidth(image.srcDesktop, 1600)}x0`,
          )
        : image.srcDesktop)) ||
    undefined;

  // Each breakpoint image can carry its own independently-set Storyblok
  // focal point. Layer them to match the same fallback chain the picture
  // markup itself uses (desktop -> tablet -> mobile), and expose all three
  // tiers as responsive overrides of the same custom property at the exact
  // `(min-width: 640px)` / `(min-width: 960px)` breakpoints used by the
  // <source> media queries in @kickstartds/content's Visual component - so
  // the object-position always matches whichever image is actually being
  // displayed at a given viewport width, instead of a single global value.
  const mobileUrl = image?.srcMobile || image?.src;
  const tabletUrl = image?.srcTablet || mobileUrl;
  const desktopUrl = image?.srcDesktop || tabletUrl;

  const mobileFocus = getFocusObjectPosition(mobileUrl) || "50% 50%";
  const tabletFocus = getFocusObjectPosition(tabletUrl) || "50% 50%";
  const desktopFocus = getFocusObjectPosition(desktopUrl) || "50% 50%";

  const focusId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const focusClassName = mobileUrl ? `dsa-hero-focus-${focusId}` : undefined;

  return (
    <>
      {focusClassName && (
        <style>{`.${focusClassName}{--dsa-hero-focus-position:${mobileFocus}}
@media (min-width: 640px){.${focusClassName}{--dsa-hero-focus-position:${tabletFocus}}}
@media (min-width: 960px){.${focusClassName}{--dsa-hero-focus-position:${desktopFocus}}}`}</style>
      )}
      <HeroContextDefault
        {...rest}
        className={[className, focusClassName].filter(Boolean).join(" ")}
        image={{
          ...image,
          srcMobile,
          srcTablet,
          srcDesktop,
          src,
        }}
        ref={ref}
      />
    </>
  );
});

const HeroProvider: FC<PropsWithChildren> = (props) => (
  <HeroContext.Provider {...props} value={Hero} />
);

const SplitEven = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof SplitEvenContextDefault> &
    HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const { firstComponents, secondComponents, ...rest } = props;

  return (
    <SplitEvenContextDefault
      {...rest}
      firstComponents={
        Array.isArray(firstComponents) &&
        firstComponents.length > 0 && (
          <>
            {firstComponents.map((component: any) => (
              <StoryblokComponent
                key={component._uid}
                blok={unflatten(component)}
              ></StoryblokComponent>
            ))}
          </>
        )
      }
      secondComponents={
        Array.isArray(secondComponents) &&
        secondComponents.length > 0 && (
          <>
            {secondComponents.map((component: any) => (
              <StoryblokComponent
                key={component._uid}
                blok={unflatten(component)}
              ></StoryblokComponent>
            ))}
          </>
        )
      }
      ref={ref}
    />
  );
});

const SplitEvenProvider: FC<PropsWithChildren> = (props) => (
  <SplitEvenContext.Provider {...props} value={SplitEven} />
);

const SplitWeighted = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof SplitWeightedContextDefault> &
    HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const { mainComponents, asideComponents, ...rest } = props;

  return (
    <SplitWeightedContextDefault
      {...rest}
      main={
        Array.isArray(mainComponents) &&
        mainComponents.length > 0 && (
          <>
            {mainComponents.map((component: any) => (
              <StoryblokComponent
                key={component._uid}
                blok={unflatten(component)}
              ></StoryblokComponent>
            ))}
          </>
        )
      }
      aside={
        Array.isArray(asideComponents) &&
        asideComponents.length > 0 && (
          <>
            {asideComponents.map((component: any) => (
              <StoryblokComponent
                key={component._uid}
                blok={unflatten(component)}
              ></StoryblokComponent>
            ))}
          </>
        )
      }
      ref={ref}
    />
  );
});

const SplitWeightedProvider: FC<PropsWithChildren> = (props) => (
  <SplitWeightedContext.Provider {...props} value={SplitWeighted} />
);

const Storytelling = forwardRef<
  HTMLDivElement,
  StorytellingProps & HTMLAttributes<HTMLDivElement>
>(({ backgroundImage, ...props }, ref) => {
  return (
    <StorytellingContextDefault
      {...props}
      backgroundImage={backgroundImage}
      ref={ref}
    />
  );
});

const StorytellingProvider: FC<PropsWithChildren> = (props) => (
  <StorytellingContext.Provider {...props} value={Storytelling} />
);

const SUPPORTED_LANGS = ["en", "de"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

function getAltPath(currentPath: string, altLang: SupportedLang): string {
  const segments = currentPath.split("/").filter(Boolean);
  if (SUPPORTED_LANGS.includes(segments[0] as SupportedLang)) {
    segments[0] = altLang;
    return "/" + segments.join("/");
  }
  return `/${altLang}/home`;
}

function getTranslatedPath(
  altLang: SupportedLang,
  alternates: Array<{ full_slug?: string }>,
  currentPath: string,
): string {
  const match = alternates.find((a) => a.full_slug?.startsWith(`${altLang}/`));
  if (match?.full_slug) return `/${match.full_slug}`;
  return getAltPath(currentPath, altLang);
}

const NavMainWithCta = forwardRef<
  HTMLDivElement,
  NavMainProps & HTMLAttributes<HTMLDivElement>
>(({ logo, items, flyoutInverted, dropdownInverted }, ref) => {
  const headerButton = useHeaderButton();
  const language = useLanguage();
  const alternates = useAlternates();
  const router = useRouter();
  const hasItems = items && items.length > 0;
  const hasButton = headerButton?.enabled && headerButton?.url;
  return (
    <div ref={ref} className="dsa-nav-main">
      {hasItems && <NavToggle />}
      {hasItems && <NavTopbar items={items} inverted={dropdownInverted} />}
      <div className="dsa-language-switcher">
        {SUPPORTED_LANGS.map((lang, idx) => (
          <>
            {idx > 0 && (
              <span
                className="dsa-language-switcher__separator"
                aria-hidden="true"
              >
                |
              </span>
            )}
            {lang === language ? (
              <span
                key={lang}
                className="dsa-language-switcher__item dsa-language-switcher__item--active"
              >
                {lang.toUpperCase()}
              </span>
            ) : (
              <a
                key={lang}
                href={getTranslatedPath(lang, alternates, router.asPath)}
                className="dsa-language-switcher__item dsa-language-switcher__item--link"
                lang={lang}
              >
                {lang.toUpperCase()}
              </a>
            )}
          </>
        ))}
      </div>
      {hasButton && (
        <a
          href={headerButton.url}
          className="dsa-button dsa-nav-main__header-cta"
        >
          {headerButton.label || "Contact Us"}
        </a>
      )}
      {hasItems && (
        <NavFlyout items={items} inverted={flyoutInverted} logo={logo} />
      )}
    </div>
  );
});

const NavMainProvider: FC<PropsWithChildren> = (props) => (
  <NavMainContext.Provider {...props} value={NavMainWithCta} />
);

const ComponentProviders = (props: PropsWithChildren) => (
  <NavMainProvider>
      <IconProvider>
        <DownloadsProvider>
          <StorytellingProvider>
            <PictureProvider>
              <SplitEvenProvider>
                <SplitWeightedProvider>
                  <HeroProvider>
                    <LinkProvider>
                      <CtaContext.Provider value={StoryblokSubComponent}>
                        <FeatureContext.Provider value={StoryblokSubComponent}>
                          <StatContext.Provider value={StoryblokSubComponent}>
                            <TestimonialContext.Provider
                              value={StoryblokSubComponent}
                            >
                              <BlogHeadContext.Provider
                                value={StoryblokSubComponent}
                              >
                                <BlogAsideContext.Provider
                                  value={StoryblokSubComponent}
                                >
                                  <BlogTeaserContext.Provider
                                    value={StoryblokSubComponent}
                                  >
                                    <BlogAuthorContext.Provider
                                      value={StoryblokSubComponent}
                                    >
                                      {props.children}
                                    </BlogAuthorContext.Provider>
                                  </BlogTeaserContext.Provider>
                                </BlogAsideContext.Provider>
                              </BlogHeadContext.Provider>
                            </TestimonialContext.Provider>
                          </StatContext.Provider>
                        </FeatureContext.Provider>
                      </CtaContext.Provider>
                    </LinkProvider>
                  </HeroProvider>
                </SplitWeightedProvider>
              </SplitEvenProvider>
            </PictureProvider>
          </StorytellingProvider>
        </DownloadsProvider>
      </IconProvider>
    </NavMainProvider>
);

export default ComponentProviders;
