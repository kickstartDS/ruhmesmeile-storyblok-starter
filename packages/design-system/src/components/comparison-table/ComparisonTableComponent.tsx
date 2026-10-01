import {
  forwardRef,
  createContext,
  useContext,
  HTMLAttributes,
  FC,
  PropsWithChildren,
} from "react";
import classnames from "classnames";
import { Icon } from "@kickstartds/base/lib/icon";
import Markdown from "markdown-to-jsx";
import { ComparisonTableProps } from "./ComparisonTableProps";
import type { FeatureRow, Plan } from "./ComparisonTableProps";
import "./comparison-table.scss";
import { Button } from "../button/ButtonComponent";
import { deepMergeDefaults } from "../helpers";
import defaults from "./ComparisonTableDefaults";

export type { ComparisonTableProps };

export const ComparisonTableContextDefault = forwardRef<
  HTMLDivElement,
  ComparisonTableProps & Omit<HTMLAttributes<HTMLDivElement>, "style">
>(({ plans = [], featureRow = [], ...rest }, ref) => {
  // The schema generates a union of tuples, which TypeScript will not let us
  // iterate; widening to the element type keeps the render readable.
  const planList: Plan[] = plans;
  const rowList: FeatureRow[] = featureRow;
  const hasCtaRow = planList.some((plan) => plan.cta?.label);

  return (
    <div {...rest} ref={ref} className="dsa-comparison-table">
      <table className="dsa-comparison-table__table">
        <thead>
          <tr className="dsa-comparison-table__row">
            <td className="dsa-comparison-table__corner" />
            {planList.map(
              (
                { name, price, pricePeriod, badge, highlight, ...planRest },
                index,
              ) => (
                <th
                  {...planRest}
                  key={index}
                  scope="col"
                  className={classnames(
                    "dsa-comparison-table__plan",
                    highlight && "dsa-comparison-table__plan--highlight",
                  )}
                  ks-inverted={highlight ? "true" : undefined}
                >
                  {badge ? (
                    <span className="dsa-comparison-table__badge">{badge}</span>
                  ) : (
                    ""
                  )}
                  {name ? (
                    <span className="dsa-comparison-table__name">{name}</span>
                  ) : (
                    ""
                  )}
                  {price ? (
                    <span className="dsa-comparison-table__price">{price}</span>
                  ) : (
                    ""
                  )}
                  {pricePeriod ? (
                    <span className="dsa-comparison-table__period">
                      {pricePeriod}
                    </span>
                  ) : (
                    ""
                  )}
                </th>
              ),
            )}
          </tr>
        </thead>

        <tbody>
          {rowList.map(({ label, value, ...rowRest }, rowIndex) => (
            <tr
              {...rowRest}
              key={rowIndex}
              className="dsa-comparison-table__row"
            >
              <th scope="row" className="dsa-comparison-table__label">
                {label}
              </th>
              {planList.map((plan, index) => {
                const cell = value?.[index];
                const highlighted = plan.highlight;

                return (
                  <td
                    key={index}
                    className={classnames(
                      "dsa-comparison-table__value",
                      highlighted && "dsa-comparison-table__value--highlight",
                      highlighted &&
                        !hasCtaRow &&
                        rowIndex === rowList.length - 1 &&
                        "dsa-comparison-table__value--highlight-end",
                    )}
                    ks-inverted={highlighted ? "true" : undefined}
                  >
                    {cell?.icon ? (
                      <Icon
                        className="dsa-comparison-table__value-icon"
                        icon={cell.icon}
                        role="presentation"
                        aria-hidden
                        focusable={false}
                      />
                    ) : (
                      ""
                    )}
                    {cell?.text ? (
                      cell.icon ? (
                        // An icon that carries meaning gets its label read out
                        // instead of shown, so `icon` and `text` can be combined.
                        <span className="sr-only">{cell.text}</span>
                      ) : (
                        <Markdown className="dsa-comparison-table__value-text">
                          {cell.text}
                        </Markdown>
                      )
                    ) : (
                      ""
                    )}
                    {cell?.icon || cell?.text ? (
                      ""
                    ) : (
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

        {planList.some((plan) => plan.cta?.label) ? (
          <tfoot>
            <tr className="dsa-comparison-table__row">
              <td className="dsa-comparison-table__corner" />
              {planList.map(({ cta, highlight }, index) => (
                <td
                  key={index}
                  className={classnames(
                    "dsa-comparison-table__value dsa-comparison-table__value--cta",
                    highlight && "dsa-comparison-table__value--highlight",
                    highlight && "dsa-comparison-table__value--highlight-end",
                  )}
                  ks-inverted={highlight ? "true" : undefined}
                >
                  {cta?.label ? (
                    <Button
                      className="dsa-comparison-table__cta"
                      url={cta.url}
                      label={cta.label}
                      variant={
                        cta.variant || (highlight ? "primary" : "tertiary")
                      }
                    />
                  ) : (
                    ""
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : (
          ""
        )}
      </table>
    </div>
  );
});

export const ComparisonTableContext = createContext(
  ComparisonTableContextDefault,
);
export const ComparisonTable = forwardRef<
  HTMLDivElement,
  ComparisonTableProps & Omit<HTMLAttributes<HTMLDivElement>, "style">
>((props, ref) => {
  const Component = useContext(ComparisonTableContext);
  return <Component {...deepMergeDefaults(defaults, props)} ref={ref} />;
});
ComparisonTable.displayName = "ComparisonTable";

export const ComparisonTableProvider: FC<PropsWithChildren> = (props) => (
  <ComparisonTableContext.Provider
    {...props}
    value={ComparisonTableContextDefault}
  />
);
