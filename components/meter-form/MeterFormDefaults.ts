import { MeterFormProps } from "./MeterFormProps";

const defaults: MeterFormProps = {
  title: "Formular Zählerstandsmeldung Strom und Wasser",
  electricityMeterType: "single",
  uploadInfo:
    "Sie haben hier die Möglichkeit Bilder Ihrer Zählerstände hochzuladen (*.jpg/*.jpeg Format)",
  privacyText:
    "Ich willige ein, dass meine eingegebenen Daten nach den in der Einwilligungserklärung zum",
  privacyLink: "Datenschutz",
  submitButtonText: "Absenden",
  readingTypeAnnual: false,
  readingTypeInterim: false,
  electricityWithFeedIn: false,
  electricitySecondMeter: false,
  electricityThirdMeter: false,
  electricityFourthMeter: false,
  privacyConsent: false,
};

export default defaults;
