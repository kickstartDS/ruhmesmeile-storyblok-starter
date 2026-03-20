import path from "path";
import { useEffect } from "react";
import type { NextPage } from "next";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { JsonLd } from "react-schemaorg";
import { BreadcrumbList } from "schema-dts";

import DsaProviders from "@kickstartds/design-system/providers";
import { Header } from "@kickstartds/design-system/header";
import { Footer } from "@kickstartds/design-system/footer";
import { Breadcrumb } from "@kickstartds/design-system/breadcrumb";
import {
  initStoryblok,
  storyProcessing,
  resolvableRelations,
} from "@/helpers/storyblok";
import { unflatten } from "@/helpers/unflatten";
import Meta from "@/components/Meta";
import "lazysizes/plugins/attrchange/ls.attrchange";

import ComponentProviders from "@/components/ComponentProviders";
import ImageSizeProviders from "@/components/ImageSizeProviders";
import ImageRatioProviders from "@/components/ImageRatioProviders";

import palette from "@kickstartds/design-system/global.client.js";
import "@kickstartds/design-system/global.css";
import "@/index.scss";
import "@/components/prompter/prompter.scss";
import { BlurHashProvider } from "@/components/BlurHashContext";
import { LanguageProvider } from "@/components/LanguageContext";
import { Section } from "@kickstartds/design-system/components/section/index.js";
import { StoryblokComponent, useStoryblokState } from "@storyblok/react";

initStoryblok(process.env.NEXT_STORYBLOK_API_TOKEN);
if (typeof window !== "undefined") {
  console.log(palette);
}

const handleRouteChange = (url: string) => {
  // close mobile nav
  window._ks.radio.emit("location.change", url);
  // https://github.com/vercel/next.js/issues/33060
  document.activeElement instanceof HTMLElement &&
    document.activeElement.blur();
};

const setActiveNavItem = (navItems: any[] = [], currentRoute: string) => {
  const route = currentRoute.replace(/^\/|\/$/g, "");
  for (const navItem of navItems) {
    const href = navItem.url.replace(/^\/|\/$/g, "");
    navItem.active = href === route;

    if (navItem.items && Array.isArray(navItem.items)) {
      for (const item of navItem.items) {
        const itemHref = item.url.replace(/^\/|\/$/g, "");
        item.active = itemHref === route;
        navItem.active ||= item.active;
      }
    }
  }
};

export default function App({
  Component,
  pageProps,
}: AppProps & {
  Component: NextPage;
}) {
  const router = useRouter();
  const isPreview = router.pathname.startsWith("/_preview");

  // In preview mode, get live story updates from the Storyblok Visual Editor bridge.
  // This ensures hero extraction below always operates on the latest data,
  // preventing a stale hero from appearing above the breadcrumb while
  // the page component renders the updated hero again below it.
  const liveStory = useStoryblokState(pageProps.story ?? null, {
    resolveRelations: resolvableRelations.join(","),
  });
  const story = liveStory || pageProps.story;

  if (isPreview && story?.content) {
    storyProcessing(story.content, true);
  }

  const { settings, blurHashes, language } = pageProps;
  const headerProps = settings?.header ? unflatten(settings?.header) : {};
  const footerProps = settings?.footer ? unflatten(settings?.footer) : {};
  const storyProps = story?.content ? unflatten(story?.content) : {};

  // Theme CSS: page-level theme overrides global theme
  const themeCss = storyProps?.themeCss || settings?.themeCss || "";
  // Manual token overrides layer on top of the selected theme
  const tokenOverrides = storyProps?.token || settings?.token || "";
  // Combined token string: theme CSS + manual overrides
  const token = [themeCss, tokenOverrides].filter(Boolean).join("\n");

  const invertHeader = storyProps?.header?.inverted
    ? !headerProps?.inverted
    : headerProps?.inverted;
  const floatHeader = storyProps?.header?.floating
    ? !headerProps?.floating
    : headerProps?.floating;
  const invertFooter = storyProps?.footer?.inverted
    ? !footerProps?.inverted
    : footerProps?.inverted;
  const hideBreadcrumbs =
    settings?.hideBreadcrumbs || storyProps?.hidePageBreadcrumbs || false;

  setActiveNavItem(headerProps?.navItems, router.asPath);
  setActiveNavItem(footerProps?.navItems, router.asPath);

  useEffect(() => {
    router.events.on("routeChangeStart", handleRouteChange);
    return () => router.events.off("routeChangeStart", handleRouteChange);
  }, [router.events]);

  const url = new URL(router.asPath, "http://dummy-base");
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const breadcrumbItems = pathSegments.map((segment) => ({
    label: segment.charAt(0).toUpperCase() + segment.slice(1),
    url: path.join(
      "/",
      ...pathSegments.slice(0, pathSegments.indexOf(segment) + 1),
    ),
  }));
  if (
    breadcrumbItems.length > 0 &&
    breadcrumbItems[0]?.label.toLowerCase() === "_preview"
  ) {
    breadcrumbItems.shift();
  }
  if (breadcrumbItems[0]?.label !== "Home") {
    breadcrumbItems.unshift({ label: "Home", url: "/" });
  }

  let heroSection;
  let newPageProps =
    story !== pageProps.story ? { ...pageProps, story } : pageProps;
  const heroSectionFirst =
    story?.content?.section?.[0]?.components?.[0]?.component === "hero";
  if (heroSectionFirst) {
    const [firstSection, ...restSections] = story?.content?.section;

    heroSection = firstSection;

    newPageProps = {
      ...pageProps,
      story: {
        ...story,
        content: {
          ...story?.content,
          section: restSections,
        },
      },
    };
  }

  return (
    <LanguageProvider language={language}>
      <BlurHashProvider blurHashes={blurHashes}>
        <DsaProviders>
          <ComponentProviders>
            <ImageSizeProviders>
              <ImageRatioProviders>
                <Meta
                  globalSeo={settings?.seo}
                  pageSeo={story?.content.seo}
                  fallbackName={story?.name}
                />
                {token && (
                  <style
                    data-tokens
                    dangerouslySetInnerHTML={{ __html: token }}
                  ></style>
                )}
                {headerProps && (
                  <Header
                    {...headerProps}
                    inverted={invertHeader}
                    floating={floatHeader}
                    logo={{
                      ...headerProps?.logo,
                      src: storyProps?.header?.logo || headerProps?.logo?.src,
                    }}
                  />
                )}
                {heroSection && <StoryblokComponent blok={heroSection} />}
                {!hideBreadcrumbs &&
                  breadcrumbItems &&
                  breadcrumbItems.length > 1 && (
                    <Section width="wide" spaceAfter="none" spaceBefore="none">
                      <Breadcrumb pages={breadcrumbItems} />
                      <JsonLd<BreadcrumbList>
                        item={{
                          "@context": "https://schema.org",
                          "@type": "BreadcrumbList",
                          name: "Breadcrumbs",
                          itemListElement: breadcrumbItems.map(
                            (item, index) => ({
                              "@type": "ListItem",
                              position: index + 1,
                              name: item.label,
                              item: `${process.env.NEXT_PUBLIC_SITE_URL || ""}${
                                item.url
                              }`,
                            }),
                          ),
                        }}
                      />
                    </Section>
                  )}
                <Component {...newPageProps} />
                {footerProps && (
                  <Footer
                    {...footerProps}
                    inverted={invertFooter || false}
                    logo={{
                      ...footerProps?.logo,
                      src: storyProps?.footer?.logo || footerProps?.logo?.src,
                    }}
                  />
                )}
              </ImageRatioProviders>
            </ImageSizeProviders>
          </ComponentProviders>
        </DsaProviders>
      </BlurHashProvider>
    </LanguageProvider>
  );
}
