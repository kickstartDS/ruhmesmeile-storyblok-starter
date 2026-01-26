import { Component, define } from "@kickstartds/core/lib/component";

export const identifier = "dsa.energy-calculator";

class EnergyCalculator extends Component {
  constructor(element) {
    super(element);

    // Cache DOM references
    const $ = element.querySelector.bind(element);
    this.elements = {
      form: $(".dsa-energy-calculator__form"),
      electricityButton: $(
        '.dsa-energy-calculator__type-button[data-type="electricity"]'
      ),
      gasButton: $('.dsa-energy-calculator__type-button[data-type="gas"]'),
      postalCodeInput: $("#postalCode"),
      householdSizeInput: $("#householdSize"),
      annualConsumptionInput: $("#annualConsumption"),
    };

    // Get initial values from data attributes
    this.state = {
      energyType:
        element.dataset.energyType ||
        this.elements.electricityButton?.classList.contains(
          "dsa-energy-calculator__type-button--active"
        )
          ? "electricity"
          : "gas",
      postalCode: this.elements.postalCodeInput?.value || "",
      householdSize: parseInt(this.elements.householdSizeInput?.value || "1"),
      annualConsumption: parseInt(
        this.elements.annualConsumptionInput?.value || "1000"
      ),
    };

    // Define event handlers
    const handleTypeButtonClick = (event) => {
      const button = event.currentTarget;
      const type = button.dataset.type;

      if (type && type !== this.state.energyType) {
        this.state.energyType = type;

        // Update button states
        this.elements.electricityButton?.classList.toggle(
          "dsa-energy-calculator__type-button--active",
          type === "electricity"
        );
        this.elements.gasButton?.classList.toggle(
          "dsa-energy-calculator__type-button--active",
          type === "gas"
        );

        // Emit event for other components to listen
        window._ks.radio.emit("dsa.energy-calculator.type-changed", type);
      }
    };

    const handlePostalCodeChange = (event) => {
      this.state.postalCode = event.target.value;
    };

    const handleHouseholdSizeChange = (event) => {
      this.state.householdSize = parseInt(event.target.value);
    };

    const handleAnnualConsumptionChange = (event) => {
      this.state.annualConsumption = parseInt(event.target.value) || 0;
    };

    const handleFormSubmit = (event) => {
      event.preventDefault();

      const formData = {
        energyType: this.state.energyType,
        postalCode: this.state.postalCode,
        householdSize: this.state.householdSize,
        annualConsumption: this.state.annualConsumption,
      };

      // Log to console
      console.log("Energy Calculator submitted:", formData);

      // Emit event for other components
      window._ks.radio.emit("dsa.energy-calculator.submit", formData);

      // If onSubmit callback is defined in data attribute
      const onSubmitCallback = element.dataset.onSubmit;
      if (onSubmitCallback && typeof window[onSubmitCallback] === "function") {
        window[onSubmitCallback](formData);
      }
    };

    // Set up event listeners
    if (this.elements.electricityButton) {
      this.elements.electricityButton.addEventListener(
        "click",
        handleTypeButtonClick
      );
    }
    if (this.elements.gasButton) {
      this.elements.gasButton.addEventListener("click", handleTypeButtonClick);
    }
    if (this.elements.postalCodeInput) {
      this.elements.postalCodeInput.addEventListener(
        "input",
        handlePostalCodeChange
      );
    }
    if (this.elements.householdSizeInput) {
      this.elements.householdSizeInput.addEventListener(
        "input",
        handleHouseholdSizeChange
      );
    }
    if (this.elements.annualConsumptionInput) {
      this.elements.annualConsumptionInput.addEventListener(
        "input",
        handleAnnualConsumptionChange
      );
    }
    if (this.elements.form) {
      this.elements.form.addEventListener("submit", handleFormSubmit);
    }

    // Cleanup on disconnect (IMPORTANT for memory management)
    this.onDisconnect(() => {
      if (this.elements.electricityButton) {
        this.elements.electricityButton.removeEventListener(
          "click",
          handleTypeButtonClick
        );
      }
      if (this.elements.gasButton) {
        this.elements.gasButton.removeEventListener(
          "click",
          handleTypeButtonClick
        );
      }
      if (this.elements.postalCodeInput) {
        this.elements.postalCodeInput.removeEventListener(
          "input",
          handlePostalCodeChange
        );
      }
      if (this.elements.householdSizeInput) {
        this.elements.householdSizeInput.removeEventListener(
          "input",
          handleHouseholdSizeChange
        );
      }
      if (this.elements.annualConsumptionInput) {
        this.elements.annualConsumptionInput.removeEventListener(
          "input",
          handleAnnualConsumptionChange
        );
      }
      if (this.elements.form) {
        this.elements.form.removeEventListener("submit", handleFormSubmit);
      }
    });
  }
}

define(identifier, EnergyCalculator);
