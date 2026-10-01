import type { Meta, StoryObj } from "@storybook/react-vite";
import manifest from "virtual:trial";

import { Badge, Code, Note, Page, Section, Stat, num, seconds, usd } from "./ui";

function SummaryPage() {
  const { outcome } = manifest;
  const { quality, efficiency, mcp, cost } = outcome;
  // Reports built before `gate` was recorded still exist on disk (the manifest
  // is per-trial and only rebuilds when it moves). Read it defensively: an old
  // manifest must render, minus the reason.
  const gate = outcome.gate ?? { passed: outcome.harnessPassed, summary: null, failures: [] };

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
            label="Task gate"
            value={
              <>
                <Badge tone={outcome.harnessPassed ? "pass" : "fail"}>
                  {outcome.harnessPassed ? "passed" : "failed"}
                </Badge>
                {gate.summary ? (
                  <span className="rp-subtitle"> {gate.summary}</span>
                ) : null}
              </>
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

      {gate.failures.length ? (
        <Section
          heading={`Task gate — ${gate.failures.length} failing assertion${
            gate.failures.length === 1 ? "" : "s"
          }`}
        >
          {gate.failures.map((failure, index) => (
            <div
              key={`${failure.test}-${index}`}
              className="rp-note rp-note--warn"
              style={{ marginBottom: 8 }}
            >
              <strong>{failure.test}</strong>
              {failure.message ? (
                <div style={{ marginTop: 4 }}>{failure.message}</div>
              ) : null}
              {failure.expected !== null || failure.received !== null ? (
                <div className="rp-subtitle" style={{ marginTop: 4 }}>
                  expected <code>{failure.expected ?? "—"}</code> · received{" "}
                  <code>{failure.received ?? "—"}</code>
                </div>
              ) : null}
              {failure.location ? (
                <div className="rp-subtitle">{failure.location}</div>
              ) : null}
            </div>
          ))}
          {quality.score >= 0.8 ? (
            <Note tone="warn">
              The graders scored {quality.score.toFixed(2)} — their rules do not
              cover the assertion above, so a high quality score here does not
              mean the task was met. Read <strong>pass@1</strong> for this task,
              not the mean quality.
            </Note>
          ) : null}
        </Section>
      ) : null}

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
