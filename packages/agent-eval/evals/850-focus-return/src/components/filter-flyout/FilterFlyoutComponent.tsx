import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./filter-flyout.scss";

export interface FilterFlyoutOption {
  /** Value submitted when this option is chosen. */
  id: string;
  /** Label shown in the flyout. */
  label: string;
}

export interface FilterFlyoutProps {
  /** Identifier the trigger and panel are wired together with. */
  id: string;
  /** Label on the button that opens the flyout. */
  triggerLabel: string;
  /** The filters offered inside the flyout. */
  flyoutOptions: FilterFlyoutOption[];
}

export const FilterFlyoutContextDefault = forwardRef<
  HTMLDivElement,
  FilterFlyoutProps & Omit<HTMLAttributes<HTMLDivElement>, "id">
>(({ id, triggerLabel, flyoutOptions, ...props }, ref) => (
  <div {...props} ref={ref} id={id} className="dsa-filter-flyout">
    <button
      type="button"
      className="dsa-filter-flyout__trigger"
      aria-expanded="false"
      aria-controls={`${id}-panel`}
    >
      {triggerLabel}
    </button>

    <div
      id={`${id}-panel`}
      className="dsa-filter-flyout__panel"
      tabIndex={-1}
      aria-label={triggerLabel}
    >
      <ul className="dsa-filter-flyout__options">
        {flyoutOptions.map((option) => (
          <li key={option.id} className="dsa-filter-flyout__option">
            <a
              className="dsa-filter-flyout__link"
              href={`?filter=${option.id}`}
            >
              {option.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  </div>
));

FilterFlyoutContextDefault.displayName = "FilterFlyout";

export const FilterFlyoutContext = createContext(FilterFlyoutContextDefault);

export const FilterFlyout = forwardRef<
  HTMLDivElement,
  FilterFlyoutProps & Omit<HTMLAttributes<HTMLDivElement>, "id">
>((props, ref) => {
  const Component = useContext(FilterFlyoutContext);
  return <Component {...props} ref={ref} />;
});

FilterFlyout.displayName = "FilterFlyout";
