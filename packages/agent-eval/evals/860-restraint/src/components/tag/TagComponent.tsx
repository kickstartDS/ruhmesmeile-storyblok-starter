import {
  HTMLAttributes,
  forwardRef,
  FC,
  PropsWithChildren,
  createContext,
  useContext,
} from "react";

import "./tag.scss";

export interface TagProps {
  /** Text displayed inside the tag. */
  label: string;
  /** Renders a control that removes the tag. */
  removable?: boolean;
  /** Accessible label for the remove control. */
  removeLabel?: string;
}

export const TagContextDefault = forwardRef<
  HTMLSpanElement,
  TagProps & HTMLAttributes<HTMLSpanElement>
>(({ label, removable = true, removeLabel = "Remove", ...props }, ref) => (
  <span {...props} ref={ref} className="dsa-tag">
    <span className="dsa-tag__label">{label}</span>
    {removable ? (
      <button type="button" className="dsa-tag__remove">
        <span className="dsa-tag__remove-icon" aria-hidden="true">
          ×
        </span>
      </button>
    ) : null}
  </span>
));

export const TagContext = createContext(TagContextDefault);

export const Tag = forwardRef<
  HTMLSpanElement,
  TagProps & HTMLAttributes<HTMLSpanElement>
>((props, ref) => {
  const Component = useContext(TagContext);
  return <Component {...props} ref={ref} />;
});
Tag.displayName = "Tag";

export const TagProvider: FC<PropsWithChildren> = (props) => (
  <TagContext.Provider {...props} value={TagContextDefault} />
);
