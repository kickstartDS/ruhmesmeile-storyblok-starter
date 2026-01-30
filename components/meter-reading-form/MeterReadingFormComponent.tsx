import { createContext, forwardRef, HTMLAttributes, useContext } from "react";
import { TextField } from "@kickstartds/form/lib/text-field";
import { TextArea } from "@kickstartds/form/lib/text-area";
import { Checkbox } from "@kickstartds/form/lib/checkbox";
import { Radio } from "@kickstartds/form/lib/radio";
import { SelectField } from "@kickstartds/form/lib/select-field";
import { Button } from "@kickstartds/base/lib/button";
import { MeterReadingFormProps } from "./MeterReadingFormProps";
import { deepMergeDefaults } from "../helpers";

export const defaults: MeterReadingFormProps = {
  title: "Formular Zählerstandsmeldung Strom und Wasser",
  billingTypeLabel: "Ablesung",
  customerNumberLabel: "Kundennummer (falls bekannt)",
  salutationLabel: "Anrede",
  firstNameLabel: "Vorname",
  lastNameLabel: "Name",
  streetLabel: "Straße, Nummer",
  cityLabel: "PLZ, Ort",
  emailLabel: "E-Mail",
  phoneLabel: "Telefonnummer für Rückfragen",
  electricityHeading: "Strom",
  electricityMeterNumberLabel: "Zählernummer",
  electricityMeterTypeLabel: "Zählerart",
  electricityReadingLabel: "Zählerstand Eintarifzähler (kWh) OBIS 1.8.0",
  electricityFeedInLabel: "mit Einspeisung",
  electricitySecondMeterLabel: "Zweiten Stromzähler angeben",
  electricityThirdMeterLabel: "Dritten Stromzähler angeben",
  electricityFourthMeterLabel: "Vierten Stromzähler angeben",
  waterHeading: "Wasser",
  waterMeterNumberLabel: "Zählernummer Wasser",
  waterReadingLabel: "Zählerstand (m³)",
  uploadLabel:
    "Sie haben hier die Möglichkeit Bilder Ihrer Zählerstände hochzuladen (*.jpg/*.jpeg Format)",
  uploadButtonLabel: "Hochladen",
  consentLabel:
    "Ich willige ein, dass meine im Einwilligungsformular nach den in der Ein­willigung­serklärung genannten Bedingungen ver­arbeitet werden. Ich habe die Datenschutz­erklärung gelesen. Ich kann diese Einwilligungs­erklärung, auch Teile davon, jederzeit widerrufen.",
  submitButtonLabel: "Absenden",
};

export const MeterReadingFormContextDefault = forwardRef<
  HTMLFormElement,
  MeterReadingFormProps & HTMLAttributes<HTMLFormElement>
>(({ title, ...props }, ref) => {
  const mergedProps = deepMergeDefaults(defaults, props);

  return (
    <form className="meter-reading-form" {...props} ref={ref}>
      <h2 className="meter-reading-form__title">{title}</h2>

      {/* Billing Type Section */}
      <div className="meter-reading-form__section">
        <fieldset className="meter-reading-form__fieldset">
          <legend className="meter-reading-form__legend">
            {mergedProps.billingTypeLabel}*
          </legend>
          <div className="meter-reading-form__radio-group">
            <Radio
              name="billingType"
              value="annual"
              label="Jahresablesung"
              required
            />
            <Radio
              name="billingType"
              value="interim"
              label="Zwischenablesung"
            />
          </div>
        </fieldset>
      </div>

      {/* Consumption Point Section */}
      <div className="meter-reading-form__section">
        <h3 className="meter-reading-form__section-heading">
          Verbrauchsstelle
        </h3>
        <p className="meter-reading-form__section-description">
          (aus Versorgungsvertrag bzw. Jahresabrechnung)
        </p>

        <div className="meter-reading-form__field">
          <TextField
            name="customerNumber"
            label={mergedProps.customerNumberLabel}
            hideLabel={false}
          />
        </div>

        <div className="meter-reading-form__field">
          <SelectField
            name="salutation"
            label={mergedProps.salutationLabel}
            hideLabel={false}
            required
            options={[
              { label: "Bitte auswählen", value: "", disabled: true },
              { label: "Herr", value: "mr" },
              { label: "Frau", value: "mrs" },
              { label: "Divers", value: "other" },
            ]}
          />
        </div>

        <div className="meter-reading-form__field-group">
          <div className="meter-reading-form__field">
            <TextField
              name="firstName"
              label={mergedProps.firstNameLabel}
              hideLabel={false}
              required
            />
          </div>
          <div className="meter-reading-form__field">
            <TextField
              name="lastName"
              label={mergedProps.lastNameLabel}
              hideLabel={false}
              required
            />
          </div>
        </div>

        <div className="meter-reading-form__field-group">
          <div className="meter-reading-form__field">
            <TextField
              name="street"
              label={mergedProps.streetLabel}
              hideLabel={false}
              required
            />
          </div>
          <div className="meter-reading-form__field">
            <TextField
              name="city"
              label={mergedProps.cityLabel}
              hideLabel={false}
              required
            />
          </div>
        </div>

        <div className="meter-reading-form__field-group">
          <div className="meter-reading-form__field">
            <TextField
              name="email"
              type="email"
              label={mergedProps.emailLabel}
              hideLabel={false}
              required
            />
          </div>
          <div className="meter-reading-form__field">
            <TextField
              name="phone"
              type="tel"
              label={mergedProps.phoneLabel}
              hideLabel={false}
            />
          </div>
        </div>
      </div>

      {/* Electricity Section */}
      <div className="meter-reading-form__section">
        <h3 className="meter-reading-form__section-heading">
          {mergedProps.electricityHeading}
        </h3>

        <div className="meter-reading-form__field">
          <TextField
            name="electricityMeterNumber"
            label={mergedProps.electricityMeterNumberLabel}
            hideLabel={false}
          />
        </div>

        <fieldset className="meter-reading-form__fieldset">
          <legend className="meter-reading-form__legend">
            {mergedProps.electricityMeterTypeLabel}
          </legend>
          <div className="meter-reading-form__radio-group">
            <Radio
              name="electricityMeterType"
              value="single"
              label="Eintarifzähler"
              defaultChecked
            />
            <Radio
              name="electricityMeterType"
              value="dual"
              label="Zweitarifzähler"
            />
          </div>
        </fieldset>

        <div className="meter-reading-form__field">
          <TextField
            name="electricityReading"
            label={mergedProps.electricityReadingLabel}
            hideLabel={false}
          />
        </div>

        <div className="meter-reading-form__checkbox">
          <Checkbox
            name="electricityFeedIn"
            label={mergedProps.electricityFeedInLabel}
          />
        </div>

        <div className="meter-reading-form__divider" />

        <div className="meter-reading-form__checkbox">
          <Checkbox
            name="secondMeter"
            label={mergedProps.electricitySecondMeterLabel}
          />
        </div>

        <div className="meter-reading-form__divider" />

        <div className="meter-reading-form__checkbox">
          <Checkbox
            name="thirdMeter"
            label={mergedProps.electricityThirdMeterLabel}
          />
        </div>

        <div className="meter-reading-form__divider" />

        <div className="meter-reading-form__checkbox">
          <Checkbox
            name="fourthMeter"
            label={mergedProps.electricityFourthMeterLabel}
          />
        </div>
      </div>

      {/* Water Section */}
      <div className="meter-reading-form__section">
        <h3 className="meter-reading-form__section-heading">
          {mergedProps.waterHeading}
        </h3>

        <div className="meter-reading-form__field">
          <TextField
            name="waterMeterNumber"
            label={mergedProps.waterMeterNumberLabel}
            hideLabel={false}
          />
        </div>

        <div className="meter-reading-form__field">
          <TextField
            name="waterReading"
            label={mergedProps.waterReadingLabel}
            hideLabel={false}
          />
        </div>
      </div>

      {/* Upload Section */}
      <div className="meter-reading-form__section">
        <p className="meter-reading-form__upload-label">
          {mergedProps.uploadLabel}
        </p>
        <Button label={mergedProps.uploadButtonLabel} variant="secondary" />
        <p className="meter-reading-form__upload-note">
          max. Bildupload insgesamt 15MB
        </p>
      </div>

      {/* Consent Section */}
      <div className="meter-reading-form__section">
        <fieldset className="meter-reading-form__fieldset">
          <legend className="meter-reading-form__legend">
            Einwilligungserklärung*
          </legend>
          <div className="meter-reading-form__checkbox">
            <Checkbox
              name="consent"
              required
              label={
                <span
                  dangerouslySetInnerHTML={{
                    __html: mergedProps.consentLabel || "",
                  }}
                />
              }
            />
          </div>
        </fieldset>
      </div>

      {/* Submit Button */}
      <div className="meter-reading-form__submit">
        <Button label={mergedProps.submitButtonLabel} variant="primary" />
      </div>
    </form>
  );
});
MeterReadingFormContextDefault.displayName =
  "Meter Reading Form Context Default";

export const MeterReadingFormContext = createContext(
  MeterReadingFormContextDefault
);

export const MeterReadingForm = forwardRef<
  HTMLFormElement,
  MeterReadingFormProps & HTMLAttributes<HTMLFormElement>
>((props, ref) => {
  const Component = useContext(MeterReadingFormContext);
  return <Component {...deepMergeDefaults(defaults, props)} ref={ref} />;
});
MeterReadingForm.displayName = "Meter Reading Form";
