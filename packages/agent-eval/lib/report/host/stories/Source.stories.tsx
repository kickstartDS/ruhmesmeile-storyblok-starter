import type { Meta, StoryObj } from "@storybook/react-vite";
import manifest from "virtual:trial";

import { Badge, Code, Page, grammarFor } from "./ui";

/** Files the agent authored are what a reviewer reads first. */
const PRODUCED = new Set(
  [
    manifest.component.componentPath,
    manifest.component.stylePath,
    manifest.component.tokenPath,
    manifest.component.schemaPath,
    manifest.component.defaultsPath,
    ...manifest.component.clientPaths,
    ...manifest.component.storyPaths,
  ].filter((path): path is string => Boolean(path)),
);

function SourcePage() {
  const sorted = [...manifest.sources].sort((a, b) => {
    const rank = Number(PRODUCED.has(b.path)) - Number(PRODUCED.has(a.path));
    return rank || a.path.localeCompare(b.path);
  });

  return (
    <Page
      title="Source"
      subtitle={`${sorted.length} files from the trial workspace`}
    >
      {sorted.map((file) => (
        <div className="rp-file" key={file.path}>
          <div className="rp-file__name">
            {file.path}{" "}
            {PRODUCED.has(file.path) ? (
              <Badge tone="muted">component</Badge>
            ) : null}
          </div>
          <Code language={grammarFor(file.path)}>{file.contents}</Code>
        </div>
      ))}
    </Page>
  );
}

const meta: Meta = {
  title: "Report/Source",
  parameters: { layout: "fullscreen" },
};

export default meta;

export const Source: StoryObj = { render: () => <SourcePage /> };
