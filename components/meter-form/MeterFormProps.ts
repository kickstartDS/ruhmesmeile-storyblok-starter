export interface MeterFormProps {
  title?: string;
  readingTypeAnnual?: boolean;
  readingTypeInterim?: boolean;
  customerNumber?: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  street?: string;
  postalCode?: string;
  email?: string;
  phone?: string;
  electricityMeterNumber?: string;
  electricityMeterType?: "single" | "dual";
  electricityReading?: string;
  electricityWithFeedIn?: boolean;
  electricitySecondMeter?: boolean;
  electricityThirdMeter?: boolean;
  electricityFourthMeter?: boolean;
  waterMeterNumber?: string;
  waterReading?: string;
  uploadInfo?: string;
  privacyText?: string;
  privacyLink?: string;
  privacyConsent?: boolean;
  submitButtonText?: string;
}
