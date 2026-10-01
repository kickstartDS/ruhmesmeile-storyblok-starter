import { Meta, StoryObj } from "@storybook/react-vite";
import { JSONSchema7 } from "json-schema";
import { pack, getArgsShared } from "@kickstartds/core/lib/storybook";

import { ComparisonTable } from "./ComparisonTableComponent";
import schema from "./comparison-table.schema.dereffed.json";
import customProperties from "./comparison-table-tokens.json";

const meta: Meta<typeof ComparisonTable> = {
  title: "Components/ComparisonTable",
  component: ComparisonTable,
  parameters: {
    jsonschema: { schema },
    cssprops: { customProperties },
  },
  ...getArgsShared(schema as JSONSchema7),
};

export default meta;

type Story = StoryObj<typeof ComparisonTable>;

export const ThreePlans: Story = {
  parameters: {
    viewport: {
      width: 1440,
      height: 900,
    },
  },
  args: pack({
    plans: [
      {
        name: "Basic",
        price: "$99",
        pricePeriod: "Per month",
        cta: { url: "#", label: "Get Started" },
      },
      {
        name: "Premium",
        price: "$199",
        pricePeriod: "Per month",
        badge: "Popular",
        highlight: true,
        cta: { url: "#", label: "Get Started" },
      },
      {
        name: "Enterprise",
        price: "$399",
        pricePeriod: "Per month",
        cta: { url: "#", label: "Get Started" },
      },
    ],
    featureRow: [
      {
        label: "Number of projects",
        value: [{ text: "01" }, { text: "10" }, { text: "50" }],
      },
      {
        label: "Storage",
        value: [{ text: "1 GB" }, { text: "100 GB" }, { text: "Unlimited" }],
      },
      {
        label: "Custom domain",
        value: [
          { icon: "close", text: "Not included" },
          { icon: "check", text: "Included" },
          { icon: "check", text: "Included" },
        ],
      },
      {
        label: "Component contracts",
        value: [
          {},
          { icon: "check", text: "Included" },
          { icon: "check", text: "Included" },
        ],
      },
      {
        label: "Priority support",
        value: [{}, {}, { icon: "check", text: "Included" }],
      },
      {
        label: "Server speed",
        value: [{ text: "1x" }, { text: "2x" }, { text: "4x" }],
      },
    ],
  }),
};

export const IconValues: Story = {
  parameters: {
    viewport: {
      width: 1440,
      height: 760,
    },
  },
  args: pack({
    plans: [
      {
        name: "Starter",
        price: "€0",
        pricePeriod: "Per month",
        cta: { url: "#", label: "Start for free" },
      },
      {
        name: "Growth",
        price: "€490",
        pricePeriod: "Per month",
        badge: "Most popular",
        highlight: true,
        cta: { url: "#", label: "Book a meeting" },
      },
    ],
    featureRow: [
      {
        label: "All 74 components",
        value: [
          { icon: "check", text: "Included" },
          { icon: "check", text: "Included" },
        ],
      },
      {
        label: "Design tokens",
        value: [
          { icon: "check", text: "Included" },
          { icon: "check", text: "Included" },
        ],
      },
      {
        label: "Theme development",
        value: [
          { icon: "close", text: "Not included" },
          { icon: "check", text: "Included" },
        ],
      },
      {
        label: "Onboarding workshops",
        value: [
          { icon: "close", text: "Not included" },
          { icon: "check", text: "Included" },
        ],
      },
    ],
  }),
};

export const FourPlans: Story = {
  parameters: {
    viewport: {
      width: 1440,
      height: 820,
    },
  },
  args: pack({
    plans: [
      {
        name: "Free",
        price: "$0",
        pricePeriod: "Per month",
        cta: { url: "#", label: "Get Started" },
      },
      {
        name: "Basic",
        price: "$99",
        pricePeriod: "Per month",
        cta: { url: "#", label: "Get Started" },
      },
      {
        name: "Premium",
        price: "$199",
        pricePeriod: "Per month",
        badge: "Popular",
        highlight: true,
        cta: { url: "#", label: "Get Started" },
      },
      {
        name: "Enterprise",
        price: "On request",
        cta: { url: "#", label: "Talk to us" },
      },
    ],
    featureRow: [
      {
        label: "Number of projects",
        value: [
          { text: "01" },
          { text: "05" },
          { text: "20" },
          { text: "Unlimited" },
        ],
      },
      {
        label: "Team members",
        value: [
          { text: "1" },
          { text: "5" },
          { text: "25" },
          { text: "Unlimited" },
        ],
      },
      {
        label: "Component contracts",
        value: [
          {},
          {},
          { icon: "check", text: "Included" },
          { icon: "check", text: "Included" },
        ],
      },
      {
        label: "Priority support",
        value: [{}, {}, {}, { icon: "check", text: "Included" }],
      },
    ],
  }),
};
