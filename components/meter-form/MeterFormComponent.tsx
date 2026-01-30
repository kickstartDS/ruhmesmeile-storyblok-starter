import { createContext, forwardRef, HTMLAttributes, useContext } from "react";
import { MeterFormProps } from "./MeterFormProps";
import { deepMergeDefaults } from "../helpers";
import defaults from "./MeterFormDefaults";
import { TextFieldComponent } from "@kickstartds/ds-agency-premium/text-field";
import { SelectFieldComponent } from "@kickstartds/ds-agency-premium/select-field";
import { CheckboxComponent } from "@kickstartds/ds-agency-premium/checkbox";
import { RadioComponent } from "@kickstartds/ds-agency-premium/radio";
import { Button } from "@kickstartds/ds-agency-premium/button";

export const MeterFormContextDefault = forwardRef<
  HTMLFormElement,
  MeterFormProps & HTMLAttributes<HTMLFormElement>
>(
  (
    {
      title,
      readingTypeAnnual,
      readingTypeInterim,
      customerNumber,
      salutation,
      firstName,
      lastName,
      street,
      postalCode,
      email,
      phone,
      electricityMeterNumber,
      electricityMeterType,
      electricityReading,
      electricityWithFeedIn,
      electricitySecondMeter,
      electricityThirdMeter,
      electricityFourthMeter,
      waterMeterNumber,
      waterReading,
      uploadInfo,
      privacyText,
      privacyLink,
      privacyConsent,
      submitButtonText,
      ...props
    },
    ref
  ) => {
    return (
      <form {...props} ref={ref} className="dsa-meter-form">
        {title && <h2 className="dsa-meter-form__title">{title}</h2>}

        <div className="dsa-meter-form__section">
          <h3 className="dsa-meter-form__section-title">Ablesung*</h3>
          <div className="dsa-meter-form__checkbox-group">
            <CheckboxComponent
              label="Jahresablesung"
              className="dsa-meter-form__checkbox"
            />
            <CheckboxComponent
              label="Zwischenablesung"
              className="dsa-meter-form__checkbox"
            />
          </div>
        </div>

        <div className="dsa-meter-form__section">
          <h3 className="dsa-meter-form__section-title">Verbrauchsstelle</h3>
          <p className="dsa-meter-form__subtitle">
            (aus Versorgungsvertrag bzw. Jahresabrechnung)
          </p>
          <TextFieldComponent
            label="Kundennummer (falls bekannt)"
            type="text"
            className="dsa-meter-form__field"
          />
        </div>

        <div className="dsa-meter-form__section">
          <div className="dsa-meter-form__row">
            <div className="dsa-meter-form__col">
              <SelectFieldComponent
                label="Anrede"
                options={[
                  { label: "Bitte auswählen", value: "" },
                  { label: "Herr", value: "mr" },
                  { label: "Frau", value: "mrs" },
                  { label: "Divers", value: "diverse" },
                ]}
                className="dsa-meter-form__field"
              />
            </div>
          </div>
          <div className="dsa-meter-form__row">
            <div className="dsa-meter-form__col dsa-meter-form__col--half">
              <TextFieldComponent
                label="Vorname"
                type="text"
                className="dsa-meter-form__field"
              />
            </div>
            <div className="dsa-meter-form__col dsa-meter-form__col--half">
              <TextFieldComponent
                label="Name"
                type="text"
                className="dsa-meter-form__field"
              />
            </div>
          </div>
          <div className="dsa-meter-form__row">
            <div className="dsa-meter-form__col dsa-meter-form__col--half">
              <TextFieldComponent
                label="Straße, Nummer"
                type="text"
                className="dsa-meter-form__field"
              />
            </div>
            <div className="dsa-meter-form__col dsa-meter-form__col--half">
              <TextFieldComponent
                label="PLZ, Ort"
                type="text"
                className="dsa-meter-form__field"
              />
            </div>
          </div>
          <div className="dsa-meter-form__row">
            <div className="dsa-meter-form__col dsa-meter-form__col--half">
              <TextFieldComponent
                label="E-Mail"
                type="email"
                className="dsa-meter-form__field"
              />
            </div>
            <div className="dsa-meter-form__col dsa-meter-form__col--half">
              <TextFieldComponent
                label="Telefonnummer für Rückfragen"
                type="tel"
                className="dsa-meter-form__field"
              />
            </div>
          </div>
        </div>

        <div className="dsa-meter-form__section dsa-meter-form__section--highlight">
          <h3 className="dsa-meter-form__section-title">Strom</h3>
          <TextFieldComponent
            label="Zählernummer"
            type="text"
            className="dsa-meter-form__field"
          />

          <div className="dsa-meter-form__radio-group">
            <label className="dsa-meter-form__label">Zählerart</label>
            <RadioComponent
              label="Eintarifzähler"
              className="dsa-meter-form__radio"
            />
            <RadioComponent
              label="Zweitarifzähler"
              className="dsa-meter-form__radio"
            />
          </div>

          <TextFieldComponent
            label="Zählerstand Eintarifzähler (kWh) OBIS 1.8.0"
            type="text"
            className="dsa-meter-form__field"
          />

          <CheckboxComponent label="Ja" className="dsa-meter-form__checkbox" />
          <p className="dsa-meter-form__checkbox-label">mit Einspeisung</p>

          <div className="dsa-meter-form__divider"></div>

          <CheckboxComponent label="Ja" className="dsa-meter-form__checkbox" />
          <p className="dsa-meter-form__checkbox-label">
            Zweiten Stromzähler angeben
          </p>

          <div className="dsa-meter-form__divider"></div>

          <CheckboxComponent label="Ja" className="dsa-meter-form__checkbox" />
          <p className="dsa-meter-form__checkbox-label">
            Dritten Stromzähler angeben
          </p>

          <div className="dsa-meter-form__divider"></div>

          <CheckboxComponent label="Ja" className="dsa-meter-form__checkbox" />
          <p className="dsa-meter-form__checkbox-label">
            Vierten Stromzähler angeben
          </p>
        </div>

        <div className="dsa-meter-form__section dsa-meter-form__section--highlight">
          <h3 className="dsa-meter-form__section-title">Wasser</h3>
          <TextFieldComponent
            label="Zählernummer Wasser"
            type="text"
            className="dsa-meter-form__field"
          />
          <TextFieldComponent
            label="Zählerstand (m³)"
            type="text"
            className="dsa-meter-form__field"
          />
        </div>

        {uploadInfo && (
          <div className="dsa-meter-form__section">
            <p className="dsa-meter-form__upload-info">{uploadInfo}</p>
            <Button
              label="Hochladen"
              variant="secondary"
              icon="upload"
              className="dsa-meter-form__upload-button"
            />
            <p className="dsa-meter-form__upload-limit">
              max. Bildupload insgesamt 15MB
            </p>
          </div>
        )}

        <div className="dsa-meter-form__section">
          <div className="dsa-meter-form__privacy">
            <CheckboxComponent
              label=""
              className="dsa-meter-form__privacy-checkbox"
            />
            <p className="dsa-meter-form__privacy-text">
              {privacyText}{" "}
              <a href="#" className="dsa-meter-form__privacy-link">
                {privacyLink}
              </a>{" "}
              genannten Bedingungen verarbeitet werden. Ich habe die
              Datenschutzerklärung gelesen. Ich kann diese
              Einwilligungserklärung, auch Teile davon, jederzeit widerrufen.
            </p>
          </div>
        </div>

        <div className="dsa-meter-form__actions">
          <Button
            label={submitButtonText || "Absenden"}
            variant="primary"
            type="submit"
            className="dsa-meter-form__submit"
          />
        </div>
      </form>
    );
  }
);
MeterFormContextDefault.displayName = "Meter Form Context Default";

export const MeterFormContext = createContext(MeterFormContextDefault);
export const MeterForm = forwardRef<
  HTMLFormElement,
  MeterFormProps & HTMLAttributes<HTMLFormElement>
>((props, ref) => {
  const Component = useContext(MeterFormContext);
  return <Component {...deepMergeDefaults(defaults, props)} ref={ref} />;
});
MeterForm.displayName = "Meter Form";
