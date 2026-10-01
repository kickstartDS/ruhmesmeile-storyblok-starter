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
import { PricingPlansProps } from "./PricingPlansProps";
import "./pricing-plans.scss";
import { Button } from "../button/ButtonComponent";
import { deepMergeDefaults } from "../helpers";
import defaults from "./PricingPlansDefaults";

export type { PricingPlansProps };

export const PricingPlansContextDefault = forwardRef<
  HTMLDivElement,
  PricingPlansProps & Omit<HTMLAttributes<HTMLDivElement>, "style">
>(({ layout = "equal", plan = [], ...rest }, ref) => (
  <div
    {...rest}
    ref={ref}
    className={classnames("dsa-pricing-plans", `dsa-pricing-plans--${layout}`)}
  >
    {plan.map(
      (
        {
          name,
          price,
          pricePeriod,
          description,
          badge,
          highlight,
          cta,
          featureListTitle,
          featureList,
          ...planRest
        },
        index,
      ) => (
        <div
          {...planRest}
          key={index}
          className={classnames(
            "dsa-pricing-plan",
            highlight && "dsa-pricing-plan--highlight",
          )}
          ks-inverted={highlight ? "true" : undefined}
        >
          <div className="dsa-pricing-plan__card">
            {badge ? (
              <span className="dsa-pricing-plan__badge">{badge}</span>
            ) : (
              ""
            )}
            <div className="dsa-pricing-plan__header">
              {name ? (
                <span className="dsa-pricing-plan__name">{name}</span>
              ) : (
                ""
              )}
              {price ? (
                <p className="dsa-pricing-plan__price">
                  <span className="dsa-pricing-plan__amount">{price}</span>
                  {pricePeriod ? (
                    <span className="dsa-pricing-plan__period">
                      {pricePeriod}
                    </span>
                  ) : (
                    ""
                  )}
                </p>
              ) : (
                ""
              )}
            </div>
            {description ? (
              <Markdown className="dsa-pricing-plan__description">
                {description}
              </Markdown>
            ) : (
              ""
            )}

            <div className="dsa-pricing-plan__footer">
              {cta?.label ? (
                <Button
                  className="dsa-pricing-plan__cta"
                  url={cta.url}
                  label={cta.label}
                  variant={cta.variant || (highlight ? "primary" : "tertiary")}
                />
              ) : (
                ""
              )}

              {featureList?.length ? (
                <div className="dsa-pricing-plan__features">
                  {featureListTitle ? (
                    <span className="dsa-pricing-plan__features-title">
                      {featureListTitle}
                    </span>
                  ) : (
                    ""
                  )}
                  <ul className="dsa-pricing-plan__feature-list">
                    {featureList.map(({ text, icon }, featureIndex) => (
                      <li
                        className="dsa-pricing-plan__feature"
                        key={featureIndex}
                      >
                        {icon ? (
                          <Icon
                            className="dsa-pricing-plan__feature-icon"
                            icon={icon}
                            role="presentation"
                            aria-hidden
                            focusable={false}
                          />
                        ) : (
                          ""
                        )}
                        {text ? (
                          <Markdown className="dsa-pricing-plan__feature-text">
                            {text}
                          </Markdown>
                        ) : (
                          ""
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                ""
              )}
            </div>
          </div>
        </div>
      ),
    )}
  </div>
));

export const PricingPlansContext = createContext(PricingPlansContextDefault);
export const PricingPlans = forwardRef<
  HTMLDivElement,
  PricingPlansProps & Omit<HTMLAttributes<HTMLDivElement>, "style">
>((props, ref) => {
  const Component = useContext(PricingPlansContext);
  return <Component {...deepMergeDefaults(defaults, props)} ref={ref} />;
});
PricingPlans.displayName = "PricingPlans";

export const PricingPlansProvider: FC<PropsWithChildren> = (props) => (
  <PricingPlansContext.Provider {...props} value={PricingPlansContextDefault} />
);
