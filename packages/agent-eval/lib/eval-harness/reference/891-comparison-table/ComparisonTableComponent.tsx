import { Button, Icon } from "@kickstartds/ds";
import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./comparison-table.scss";

export interface ComparisonTableValue {
  /** The value itself. Combine with an `icon` to label the icon. */
  text?: string;
  /** An icon instead of text, e.g. `check` or `close`. */
  icon?: string;
}

export interface ComparisonTablePlan {
  /** Name of the plan. */
  name?: string;
  /** Price of the plan. */
  price?: string;
  /** The period the price refers to. */
  pricePeriod?: string;
  /** Optional badge above the plan name. */
  badge?: string;
  /** Present this plan as the recommended one. */
  highlight?: boolean;
  /** The button that starts this plan. */
  cta?: {
    label?: string;
    url?: string;
    variant?: "primary" | "secondary" | "tertiary";
  };
}

export interface ComparisonTableFeatureRow {
  /** Name of the feature this row compares. */
  label?: string;
  /** One entry per plan, in the same order as `plans`. */
  value?: ComparisonTableValue[];
}

export interface ComparisonTableProps {
  /** The plans that are compared, one per column. */
  plans?: ComparisonTablePlan[];
  /** The features that are compared, one per row. */
  featureRow?: ComparisonTableFeatureRow[];
}

export const ComparisonTableContextDefault = forwardRef<
  HTMLDivElement,
  ComparisonTableProps & Omit<HTMLAttributes<HTMLDivElement>, "style">
>(({ plans = [], featureRow = [], ...rest }, ref) => {
  const hasCtaRow = plans.some((plan) => plan.cta?.label);

  return (
    <div {...rest} ref={ref} className="dsa-comparison-table">
      <table className="dsa-comparison-table__table">
        <thead>
          <tr className="dsa-comparison-table__row">
            <td className="dsa-comparison-table__corner" />
            {plans.map(
              ({ name, price, pricePeriod, badge, highlight }, index) => (
                <th
                  key={index}
                  scope="col"
                  className={`dsa-comparison-table__plan${
                    highlight ? " dsa-comparison-table__plan--highlight" : ""
                  }`}
                  ks-inverted={highlight ? "true" : undefined}
                >
                  {badge ? (
                    <span className="dsa-comparison-table__badge">{badge}</span>
                  ) : null}
                  {name ? (
                    <span className="dsa-comparison-table__name">{name}</span>
                  ) : null}
                  {price ? (
                    <span className="dsa-comparison-table__price">{price}</span>
                  ) : null}
                  {pricePeriod ? (
                    <span className="dsa-comparison-table__period">
                      {pricePeriod}
                    </span>
                  ) : null}
                </th>
              ),
            )}
          </tr>
        </thead>

        <tbody>
          {featureRow.map(({ label, value }, rowIndex) => (
            <tr key={rowIndex} className="dsa-comparison-table__row">
              <th scope="row" className="dsa-comparison-table__label">
                {label}
              </th>
              {plans.map((plan, index) => {
                const cell = value?.[index];
                const highlighted = plan.highlight;

                return (
                  <td
                    key={index}
                    className={`dsa-comparison-table__value${
                      highlighted
                        ? " dsa-comparison-table__value--highlight"
                        : ""
                    }${
                      highlighted &&
                      !hasCtaRow &&
                      rowIndex === featureRow.length - 1
                        ? " dsa-comparison-table__value--highlight-end"
                        : ""
                    }`}
                    ks-inverted={highlighted ? "true" : undefined}
                  >
                    {cell?.icon ? (
                      <Icon
                        className="dsa-comparison-table__value-icon"
                        icon={cell.icon}
                      />
                    ) : null}
                    {cell?.text ? (
                      cell.icon ? (
                        // The icon carries the meaning here, so the label is
                        // read out instead of shown.
                        <span className="dsa-comparison-table__sr">
                          {cell.text}
                        </span>
                      ) : (
                        <span className="dsa-comparison-table__value-text">
                          {cell.text}
                        </span>
                      )
                    ) : null}
                    {cell?.icon || cell?.text ? null : (
                      <span className="dsa-comparison-table__empty" aria-hidden>
                        &ndash;
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

        {hasCtaRow ? (
          <tfoot>
            <tr className="dsa-comparison-table__row">
              <td className="dsa-comparison-table__corner" />
              {plans.map(({ cta, highlight }, index) => (
                <td
                  key={index}
                  className={`dsa-comparison-table__value dsa-comparison-table__value--cta${
                    highlight ? " dsa-comparison-table__value--highlight" : ""
                  }${
                    highlight ? " dsa-comparison-table__value--highlight-end" : ""
                  }`}
                  ks-inverted={highlight ? "true" : undefined}
                >
                  {cta?.label ? (
                    <Button
                      className="dsa-comparison-table__cta"
                      url={cta.url}
                      label={cta.label}
                      variant={cta.variant ?? (highlight ? "primary" : "tertiary")}
                    />
                  ) : null}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
});

ComparisonTableContextDefault.displayName = "ComparisonTable";

export const ComparisonTableContext = createContext(ComparisonTableContextDefault);

export const ComparisonTable = forwardRef<
  HTMLDivElement,
  ComparisonTableProps & Omit<HTMLAttributes<HTMLDivElement>, "style">
>((props, ref) => {
  const Component = useContext(ComparisonTableContext);
  return <Component {...props} ref={ref} />;
});

ComparisonTable.displayName = "ComparisonTable";
