import { Button, Icon } from "@kickstartds/ds";
import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./pricing-plans.scss";

export interface PricingPlanIncludedFeature {
  /** What is included, one entry per line. */
  text?: string;
  /** Optional icon in front of the entry. */
  icon?: string;
}

export interface PricingPlanCallToAction {
  /** Text content to display inside the button. */
  label?: string;
  /** The URL to link to when the button is clicked. */
  url?: string;
  /** Variant of the button. */
  variant?: "primary" | "secondary" | "tertiary";
}

export interface PricingPlan {
  /** Name of the plan. */
  name?: string;
  /** Price of the plan. */
  price?: string;
  /** The period the price refers to. */
  pricePeriod?: string;
  /** Short description of what the plan is for. */
  description?: string;
  /** Optional badge above the plan name. */
  badge?: string;
  /** Present this plan as the recommended one. */
  highlight?: boolean;
  /** The button that starts this plan. */
  cta?: PricingPlanCallToAction;
  /** Heading above the list of what the plan includes. */
  featureListTitle?: string;
  /** What the plan includes. */
  featureList?: PricingPlanIncludedFeature[];
}

export interface PricingPlansProps {
  /** Whether the plans share the available width equally, or fill the row. */
  layout?: "equal" | "auto";
  /** The plans to present, in the order they should be read. */
  plan?: PricingPlan[];
}

export const PricingPlansContextDefault = forwardRef<
  HTMLDivElement,
  PricingPlansProps & Omit<HTMLAttributes<HTMLDivElement>, "style">
>(({ layout = "equal", plan = [], ...rest }, ref) => (
  <div
    {...rest}
    ref={ref}
    className={`dsa-pricing-plans dsa-pricing-plans--${layout}`}
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
        },
        index,
      ) => (
        <div
          key={index}
          className={`dsa-pricing-plan${
            highlight ? " dsa-pricing-plan--highlight" : ""
          }`}
          ks-inverted={highlight ? "true" : undefined}
        >
          {/*
            The surface lives on a child: a card that paints its own background
            paints over a `z-index: -1` child of its own, so the halo would end
            up on top of the card instead of behind it.
          */}
          <div className="dsa-pricing-plan__card">
            {badge ? (
              <span className="dsa-pricing-plan__badge">{badge}</span>
            ) : null}
            <div className="dsa-pricing-plan__header">
              {name ? <span className="dsa-pricing-plan__name">{name}</span> : null}
              {price ? (
                <p className="dsa-pricing-plan__price">
                  <span className="dsa-pricing-plan__amount">{price}</span>
                  {pricePeriod ? (
                    <span className="dsa-pricing-plan__period">
                      {pricePeriod}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            {description ? (
              <p className="dsa-pricing-plan__description">{description}</p>
            ) : null}

            <div className="dsa-pricing-plan__footer">
              {cta?.label ? (
                <Button
                  className="dsa-pricing-plan__cta"
                  url={cta.url}
                  label={cta.label}
                  variant={cta.variant ?? (highlight ? "primary" : "tertiary")}
                />
              ) : null}

              {featureList?.length ? (
                <div className="dsa-pricing-plan__features">
                  {featureListTitle ? (
                    <span className="dsa-pricing-plan__features-title">
                      {featureListTitle}
                    </span>
                  ) : null}
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
                          />
                        ) : null}
                        {text ? (
                          <span className="dsa-pricing-plan__feature-text">
                            {text}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ),
    )}
  </div>
));

PricingPlansContextDefault.displayName = "PricingPlans";

export const PricingPlansContext = createContext(PricingPlansContextDefault);

export const PricingPlans = forwardRef<
  HTMLDivElement,
  PricingPlansProps & Omit<HTMLAttributes<HTMLDivElement>, "style">
>((props, ref) => {
  const Component = useContext(PricingPlansContext);
  return <Component {...props} ref={ref} />;
});

PricingPlans.displayName = "PricingPlans";
