import type { Meta, StoryObj } from "@storybook/react-vite";
import manifest from "virtual:trial";

import { Badge, Page, Section } from "./ui";
import type { Check, GraderResult } from "../../../graders/types";

function mark(check: Check): { glyph: string; tone: string } {
  if (check.passed) return { glyph: "✔", tone: "pass" };
  if (check.score > 0) return { glyph: "◐", tone: "partial" };
  return { glyph: "✘", tone: "fail" };
}

function Grader({ grader }: { grader: GraderResult }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        <strong style={{ fontSize: 14 }}>{grader.id}</strong>
        <Badge
          tone={grader.applicable ? (grader.passed ? "pass" : "fail") : "muted"}
        >
          {grader.applicable ? grader.score.toFixed(2) : "n/a"}
        </Badge>
        <span className="rp-check__detail">{grader.dimension}</span>
      </div>

      {grader.checks.map((check) => {
        const { glyph, tone } = mark(check);
        return (
          <div className="rp-check" key={check.id}>
            <span className={`rp-check__mark rp-check__mark--${tone}`}>
              {glyph}
            </span>
            <span>
              {check.label}
              {check.details ? (
                <>
                  {" "}
                  <span className="rp-check__detail">— {check.details}</span>
                </>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GradersPage() {
  const { graders, diagnostics, quality } = manifest.outcome;

  return (
    <Page
      title="Graders"
      subtitle={`quality ${quality.score.toFixed(2)} · weights ${quality.weightsVersion}`}
    >
      <Section heading="Quality graders">
        {graders.map((grader) => (
          <Grader key={grader.id} grader={grader} />
        ))}
      </Section>

      {diagnostics.length ? (
        <Section heading="Diagnostics (not scored)">
          {diagnostics.map((grader) => (
            <Grader key={grader.id} grader={grader} />
          ))}
        </Section>
      ) : null}
    </Page>
  );
}

const meta: Meta = {
  title: "Report/Graders",
  parameters: { layout: "fullscreen" },
};

export default meta;

export const Graders: StoryObj = { render: () => <GradersPage /> };
