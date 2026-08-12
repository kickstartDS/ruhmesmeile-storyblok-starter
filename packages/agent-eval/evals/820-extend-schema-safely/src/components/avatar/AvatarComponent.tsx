import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./avatar.scss";

export interface AvatarProps {
  /** The person's name, used for the label and the fallback initials. */
  name: string;
  /** Portrait to show instead of the initials. */
  imageSrc?: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export const AvatarContextDefault = forwardRef<
  HTMLSpanElement,
  AvatarProps & HTMLAttributes<HTMLSpanElement>
>(({ name, imageSrc, ...props }, ref) => (
  <span {...props} ref={ref} className="dsa-avatar">
    {imageSrc ? (
      <img className="dsa-avatar__image" src={imageSrc} alt="" />
    ) : (
      <span className="dsa-avatar__initials" aria-hidden="true">
        {initials(name)}
      </span>
    )}
    <span className="dsa-avatar__name">{name}</span>
  </span>
));

AvatarContextDefault.displayName = "Avatar";

export const AvatarContext = createContext(AvatarContextDefault);

export const Avatar = forwardRef<
  HTMLSpanElement,
  AvatarProps & HTMLAttributes<HTMLSpanElement>
>((props, ref) => {
  const Component = useContext(AvatarContext);
  return <Component {...props} ref={ref} />;
});

Avatar.displayName = "Avatar";
