import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnergyCalculator } from "./EnergyCalculatorComponent";

const meta: Meta<typeof EnergyCalculator> = {
  title: "Components/Energy Calculator",
  component: EnergyCalculator,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof EnergyCalculator>;

export const Default: Story = {
  args: {},
};

export const WithGasSelected: Story = {
  args: {
    energyType: "gas",
  },
};

export const WithPrefilledData: Story = {
  args: {
    postalCode: "12345",
    householdSize: 3,
    annualConsumption: 2500,
  },
};

export const CustomLabels: Story = {
  args: {
    headlineText: "Which energy type are you interested in?",
    electricityLabel: "GREEN POWER",
    gasLabel: "NATURAL GAS",
    submitLabel: "Get Quote Now",
    descriptionHeadline: "Switch to sustainable energy in just 4 minutes!",
    descriptionItems: [
      { number: 1, text: "Select energy type" },
      { number: 2, text: "Enter postal code" },
      { number: 3, text: "Provide annual consumption" },
      { number: 4, text: "Get your quote" },
      { number: 5, text: "Choose your plan" },
    ],
  },
};
