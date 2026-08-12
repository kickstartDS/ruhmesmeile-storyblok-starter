import { Meta, StoryObj } from "@storybook/react-vite";
import { JSONSchema7 } from "json-schema";
import { pack, getArgsShared } from "@kickstartds/core/lib/storybook";

import { PriceTag } from "./PriceTagComponent";
import schema from "./price-tag.schema.dereffed.json";
import customProperties from "./price-tag-tokens.json";

const meta: Meta<typeof PriceTag> = {
  title: "Components/PriceTag",
  component: PriceTag,
  parameters: {
    jsonschema: { schema },
    cssprops: { customProperties },
  },
  ...getArgsShared(schema as JSONSchema7),
};

export default meta;

type Story = StoryObj<typeof PriceTag>;

export const Default: Story = {
  args: pack({
    amount: "€49",
    period: "month",
    variant: "regular",
    note: {
      text: "Billed annually",
    },
  }),
};

export const Highlighted: Story = {
  args: pack({
    amount: "€89",
    period: "month",
    variant: "highlight",
    note: {
      text: "Most popular",
      emphasis: true,
    },
  }),
};
