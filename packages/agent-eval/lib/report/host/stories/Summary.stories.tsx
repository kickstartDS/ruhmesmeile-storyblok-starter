import type { Meta, StoryObj } from "@storybook/react-vite";
import manifest from "virtual:trial";

import { Badge, Code, Page, Section, Stat, num, seconds, usd } from "./ui";

function SummaryPage() {
  const { outcome } = manifest;
  const { quality, efficiency, mcp, cost } = outcome;

  return (
    <Page
      title={`${manifest.evalName} — run ${manifest.run}`}
      subtitle={
        <>
          {manifest.variant} · {manifest.model ?? "unknown model"} ·{" "}
          {manifest.timestamp}
        </>
      }
    >
      <Section heading="Outcome">
        <div className="rp-grid">
          <Stat
            label="Harness verdict"
            value={
              <Badge tone={outcome.harnessPassed ? "pass" : "fail"}>
                {outcome.harnessPassed ? "passed" : "failed"}
              </Badge>
            }
          />
          <Stat label="Quality" value={quality.score.toFixed(2)} />
          <Stat label="Cost" value={usd(cost.total)} />
          <Stat label="Duration" value={seconds(outcome.durationSeconds)} />
          <Stat label="Turns" value={num(efficiency.turns)} />
          <Stat label="MCP calls" value={num(mcp.totalCalls)} />
        </div>
        {outcome.failureReason ? (
          <p className="rp-note rp-note--warn" style={{ marginTop: 12 }}>
            {outcome.failureClass}: {outcome.failureReason}
          </p>
        ) : null}
      </Section>

      <Section heading="Quality by dimension">
        <table className="rp-table">
          <thead>
            <tr>
              <th>Dimension</th>
              <th className="rp-num">Score</th>
              <th className="rp-num">Weight</th>
              <th>Graders</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(quality.dimensions).map(([name, dimension]) => (
              <tr key={name}>
                <td>{name}</td>
                <td className="rp-num">{dimension.score.toFixed(2)}</td>
                <td className="rp-num">{dimension.weight.toFixed(2)}</td>
                <td>{dimension.graders.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {quality.missing.length ? (
          <p className="rp-subtitle" style={{ marginTop: 8 }}>
            No applicable grader for: {quality.missing.join(", ")} — weight
            redistributed.
          </p>
        ) : null}
      </Section>

      <Section heading="Effort">
        <div className="rp-grid">
          <Stat label="Tool calls" value={num(efficiency.toolCalls)} />
          <Stat label="Files written" value={num(efficiency.fileWrites)} />
          <Stat label="Rework writes" value={num(efficiency.rework)} />
          <Stat label="Output tokens" value={num(efficiency.tokens.output)} />
          <Stat label="Input tokens" value={num(efficiency.tokens.input)} />
          <Stat
            label="MCP result tokens"
            value={num(efficiency.mcpResultTokens)}
          />
        </div>
      </Section>

      {mcp.totalCalls > 0 ? (
        <Section heading="MCP tools called">
          <table className="rp-table">
            <thead>
              <tr>
                <th>Tool</th>
                <th className="rp-num">Calls</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(mcp.byTool)
                .sort((a, b) => b[1] - a[1])
                .map(([tool, calls]) => (
                  <tr key={tool}>
                    <td>{tool}</td>
                    <td className="rp-num">{calls}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {mcp.firstCall ? (
            <p className="rp-subtitle" style={{ marginTop: 8 }}>
              First call: {mcp.firstCall}
            </p>
          ) : null}
        </Section>
      ) : null}

      <Section heading="Task as given to the agent">
        <Code>{manifest.prompt ?? "(no PROMPT.md captured)"}</Code>
      </Section>
    </Page>
  );
}

const meta: Meta = {
  title: "Report/Summary",
  parameters: { layout: "fullscreen" },
};

export default meta;

export const Summary: StoryObj = { render: () => <SummaryPage /> };
