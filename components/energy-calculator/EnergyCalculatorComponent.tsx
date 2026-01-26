import { FC, forwardRef } from "react";
import classNames from "classnames";
import { useKsComponent } from "@kickstartds/core/lib/react";
import EnergyCalculatorDefaults from "./EnergyCalculatorDefaults";
import { identifier } from "./js/EnergyCalculator.client";

export interface EnergyCalculatorProps {
  component?: "energy-calculator";
  energyType?: "electricity" | "gas";
  postalCode?: string;
  householdSize?: number;
  annualConsumption?: number;
  submitLabel?: string;
  headlineText?: string;
  electricityLabel?: string;
  gasLabel?: string;
  postalCodeLabel?: string;
  householdSizeLabel?: string;
  consumptionLabel?: string;
  descriptionHeadline?: string;
  descriptionItems?: Array<{ number: number; text: string }>;
  onSubmit?: string;
  className?: string;
}

export const EnergyCalculator: FC<EnergyCalculatorProps> = forwardRef<
  HTMLDivElement,
  EnergyCalculatorProps
>(({ className, ...props }, ref) => {
  const mergedProps = { ...EnergyCalculatorDefaults, ...props };
  const {
    energyType,
    postalCode,
    householdSize,
    annualConsumption,
    submitLabel,
    headlineText,
    electricityLabel,
    gasLabel,
    postalCodeLabel,
    householdSizeLabel,
    consumptionLabel,
    descriptionHeadline,
    descriptionItems,
    onSubmit,
  } = mergedProps;

  const componentProps = useKsComponent(identifier, ref);

  return (
    <div
      {...componentProps}
      ref={ref}
      className={classNames("dsa-energy-calculator", className)}
      data-energy-type={energyType}
      data-on-submit={onSubmit}
    >
      <div className="dsa-energy-calculator__container">
        <div className="dsa-energy-calculator__form-section">
          <form className="dsa-energy-calculator__form">
            <h2 className="dsa-energy-calculator__headline">{headlineText}</h2>

            <div className="dsa-energy-calculator__energy-type">
              <button
                type="button"
                data-type="electricity"
                className={classNames("dsa-energy-calculator__type-button", {
                  "dsa-energy-calculator__type-button--active":
                    energyType === "electricity",
                })}
              >
                <svg
                  className="dsa-energy-calculator__icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
                </svg>
                {electricityLabel}
              </button>
              <button
                type="button"
                data-type="gas"
                className={classNames("dsa-energy-calculator__type-button", {
                  "dsa-energy-calculator__type-button--active":
                    energyType === "gas",
                })}
              >
                <svg
                  className="dsa-energy-calculator__icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 1.74.6 3.34 1.61 4.62L12 22l5.39-8.38C18.4 12.34 19 10.74 19 9c0-3.87-3.13-7-7-7z" />
                </svg>
                {gasLabel}
              </button>
            </div>

            <div className="dsa-energy-calculator__fields">
              <div className="dsa-energy-calculator__field">
                <label
                  className="dsa-energy-calculator__label"
                  htmlFor="postalCode"
                >
                  {postalCodeLabel}
                </label>
                <input
                  type="text"
                  id="postalCode"
                  className="dsa-energy-calculator__input"
                  defaultValue={postalCode}
                  placeholder="Postleitzahl"
                />
              </div>

              <div className="dsa-energy-calculator__field">
                <label
                  className="dsa-energy-calculator__label"
                  htmlFor="householdSize"
                >
                  {householdSizeLabel}
                </label>
                <div className="dsa-energy-calculator__slider">
                  <input
                    type="range"
                    id="householdSize"
                    className="dsa-energy-calculator__range"
                    min="1"
                    max="5"
                    step="1"
                    defaultValue={householdSize}
                  />
                  <div className="dsa-energy-calculator__slider-labels">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4+</span>
                  </div>
                </div>
              </div>

              <div className="dsa-energy-calculator__field">
                <label
                  className="dsa-energy-calculator__label"
                  htmlFor="annualConsumption"
                >
                  {consumptionLabel}
                </label>
                <input
                  type="number"
                  id="annualConsumption"
                  className="dsa-energy-calculator__input"
                  defaultValue={annualConsumption}
                />
              </div>
            </div>

            <button type="submit" className="dsa-energy-calculator__submit">
              {submitLabel}
            </button>
          </form>
        </div>

        <div className="dsa-energy-calculator__description">
          <h3 className="dsa-energy-calculator__description-headline">
            {descriptionHeadline}
          </h3>
          <ul className="dsa-energy-calculator__steps">
            {descriptionItems?.map((item) => (
              <li key={item.number} className="dsa-energy-calculator__step">
                <span className="dsa-energy-calculator__step-number">
                  {item.number}
                </span>
                <span className="dsa-energy-calculator__step-text">
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
});

EnergyCalculator.displayName = "EnergyCalculator";
