import { Meta, StoryObj } from "@storybook/react-vite";
import { JSONSchema7 } from "json-schema";
import { pack, getArgsShared } from "@kickstartds/core/lib/storybook";

import { PricingPlans } from "./PricingPlansComponent";
import schema from "./pricing-plans.schema.dereffed.json";
import customProperties from "./pricing-plans-tokens.json";

const meta: Meta<typeof PricingPlans> = {
  title: "Components/PricingPlans",
  component: PricingPlans,
  parameters: {
    jsonschema: { schema },
    cssprops: { customProperties },
  },
  ...getArgsShared(schema as JSONSchema7),
};

export default meta;

type Story = StoryObj<typeof PricingPlans>;

export const ThreePlans: Story = {
  parameters: {
    viewport: {
      width: 1440,
      height: 900,
    },
  },
  args: pack({
    layout: "equal",
    plan: [
      {
        name: "Basic",
        price: "$99",
        description:
          "Best for small business owners and startups who need a landing page for their business.",
        cta: { url: "#", label: "Get Started" },
        featureListTitle: "What's included:",
        featureList: [
          { text: "130+ coded blocks" },
          { text: "Best for developers, freelancers" },
          { text: "Made with TailwindCSS" },
        ],
      },
      {
        name: "Premium",
        price: "$199",
        description:
          "Best for medium business owners and startups who need a landing page for their business.",
        highlight: true,
        cta: { url: "#", label: "Get Started" },
        featureListTitle: "What's included:",
        featureList: [
          { text: "130+ coded blocks" },
          { text: "Best for developers, freelancers" },
          { text: "Made with TailwindCSS" },
          { text: "Premium support" },
          { text: "Future updates" },
        ],
      },
      {
        name: "Enterprise",
        price: "$399",
        description:
          "Best for large companies and business owners who need a landing page for their business.",
        cta: { url: "#", label: "Get Started" },
        featureListTitle: "What's included:",
        featureList: [
          { text: "130+ coded blocks" },
          { text: "Best for developers, freelancers" },
          { text: "Made with TailwindCSS" },
          { text: "Premium support" },
        ],
      },
    ],
  }),
};

export const WithBadgeAndPeriod: Story = {
  parameters: {
    viewport: {
      width: 1440,
      height: 900,
    },
  },
  args: pack({
    layout: "equal",
    plan: [
      {
        name: "Starter",
        price: "€0",
        pricePeriod: "per month",
        description: "For trying the design system out on a side project.",
        cta: { url: "#", label: "Start for free" },
        featureListTitle: "Included:",
        featureList: [
          { text: "All 74 components", icon: "check" },
          { text: "Design tokens", icon: "check" },
          { text: "Community support", icon: "check" },
        ],
      },
      {
        name: "Growth",
        price: "€490",
        pricePeriod: "per month",
        description: "For teams shipping several sites on one design system.",
        badge: "Most popular",
        highlight: true,
        cta: { url: "#", label: "Book a meeting" },
        featureListTitle: "Included:",
        featureList: [
          { text: "Everything in Starter", icon: "check" },
          { text: "Theme development", icon: "check" },
          { text: "Component contracts", icon: "check" },
          { text: "Priority support", icon: "check" },
        ],
      },
      {
        name: "Enterprise",
        price: "On request",
        description: "For organisations with several brands and teams.",
        cta: { url: "#", label: "Talk to us" },
        featureListTitle: "Included:",
        featureList: [
          { text: "Everything in Growth", icon: "check" },
          { text: "Multi-brand theming", icon: "check" },
          { text: "Onboarding workshops", icon: "check" },
          { text: "SLA", icon: "check" },
        ],
      },
    ],
  }),
};

export const TwoPlansAuto: Story = {
  parameters: {
    viewport: {
      width: 1440,
      height: 760,
    },
  },
  args: pack({
    layout: "auto",
    plan: [
      {
        name: "Single site",
        price: "$99",
        pricePeriod: "one-time",
        description: "One site, one brand, everything included.",
        cta: { url: "#", label: "Get Started" },
        featureListTitle: "What's included:",
        featureList: [
          { text: "130+ coded blocks" },
          { text: "Design tokens" },
          { text: "Storybook documentation" },
        ],
      },
      {
        name: "Unlimited sites",
        price: "$399",
        pricePeriod: "one-time",
        description: "As many sites and brands as you like, with support.",
        cta: { url: "#", label: "Get Started" },
        featureListTitle: "What's included:",
        featureList: [
          { text: "130+ coded blocks" },
          { text: "Design tokens" },
          { text: "Storybook documentation" },
          { text: "Premium support" },
        ],
      },
    ],
  }),
};
