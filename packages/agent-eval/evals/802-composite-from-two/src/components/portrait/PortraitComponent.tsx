import {
  createContext,
  forwardRef,
  useContext,
  type ImgHTMLAttributes,
} from "react";

import "./portrait.scss";

export interface PortraitProps {
  /** Image source for the portrait. */
  src: string;
  /** Alternative text for the portrait. */
  alt: string;
  /** How large the portrait should be rendered. */
  size?: "small" | "medium" | "large";
}

export const PortraitContextDefault = forwardRef<
  HTMLImageElement,
  PortraitProps & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">
>(({ src, alt, size = "medium", ...props }, ref) => (
  <img
    {...props}
    ref={ref}
    src={src}
    alt={alt}
    className={`dsa-portrait dsa-portrait--${size}`}
  />
));

PortraitContextDefault.displayName = "Portrait";

export const PortraitContext = createContext(PortraitContextDefault);

export const Portrait = forwardRef<
  HTMLImageElement,
  PortraitProps & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">
>((props, ref) => {
  const Component = useContext(PortraitContext);
  return <Component {...props} ref={ref} />;
});

Portrait.displayName = "Portrait";
