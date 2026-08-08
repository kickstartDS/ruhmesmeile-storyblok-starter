import type { Meta, StoryObj } from "@storybook/react-vite";
import manifest from "virtual:trial";

import { Code, Note, Page, Section } from "./ui";

function OutputPage() {
  const entries = Object.entries(manifest.outputs);

  return (
    <Page
      title="Toolchain output"
      subtitle="Raw output from the in-sandbox validation step."
    >
      {entries.length === 0 ? (
        <Note tone="warn">This trial captured no toolchain output.</Note>
      ) : (
        entries.map(([name, contents]) => (
          <Section heading={name} key={name}>
            <Code>{contents}</Code>
          </Section>
        ))
      )}
    </Page>
  );
}

const meta: Meta = {
  title: "Report/Output",
  parameters: { layout: "fullscreen" },
};

export default meta;

export const Output: StoryObj = { render: () => <OutputPage /> };
