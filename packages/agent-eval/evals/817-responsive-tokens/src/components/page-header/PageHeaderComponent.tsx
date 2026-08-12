import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./page-header.scss";

export interface PageHeaderProps {
  /** The page title. */
  title: string;
  /** One-line summary shown under the title. */
  summary?: string;
  /** Small label above the title, e.g. the section this page belongs to. */
  eyebrow?: string;
}

export const PageHeaderContextDefault = forwardRef<
  HTMLElement,
  PageHeaderProps & HTMLAttributes<HTMLElement>
>(({ title, summary, eyebrow, ...props }, ref) => (
  <header {...props} ref={ref} className="dsa-page-header">
    {eyebrow ? <p className="dsa-page-header__eyebrow">{eyebrow}</p> : null}
    <h1 className="dsa-page-header__title">{title}</h1>
    {summary ? <p className="dsa-page-header__summary">{summary}</p> : null}
  </header>
));

PageHeaderContextDefault.displayName = "PageHeader";

export const PageHeaderContext = createContext(PageHeaderContextDefault);

export const PageHeader = forwardRef<
  HTMLElement,
  PageHeaderProps & HTMLAttributes<HTMLElement>
>((props, ref) => {
  const Component = useContext(PageHeaderContext);
  return <Component {...props} ref={ref} />;
});

PageHeader.displayName = "PageHeader";
