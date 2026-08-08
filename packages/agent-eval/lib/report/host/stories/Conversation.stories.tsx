import type { Meta, StoryObj } from "@storybook/react-vite";
import manifest from "virtual:trial";

import { Badge, Note, Page, Section, num } from "./ui";
import type {
  ManifestToolCall,
  ManifestToolResult,
  ManifestTurn,
} from "../../manifest";

function ToolCall({ call }: { call: ManifestToolCall }) {
  const classes = ["rp-tool", call.server ? "rp-tool--mcp" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <details className={classes}>
      <summary className="rp-tool__summary">
        {call.server ? `mcp · ${call.server} · ` : ""}
        {call.name}
      </summary>
      <div className="rp-tool__body">
        <pre className="rp-code">{call.input}</pre>
      </div>
    </details>
  );
}

function ToolResult({ result }: { result: ManifestToolResult }) {
  const classes = ["rp-tool", result.isError ? "rp-tool--error" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <details className={classes}>
      <summary className="rp-tool__summary">
        {result.isError ? "error" : "result"}
      </summary>
      <div className="rp-tool__body">
        <pre className="rp-code">{result.output}</pre>
      </div>
    </details>
  );
}

function Turn({ turn }: { turn: ManifestTurn }) {
  return (
    <article className="rp-turn">
      <header className="rp-turn__head">
        <span className="rp-turn__role">{turn.role}</span>
        <span>#{turn.index}</span>
        {turn.timestamp ? <span>{turn.timestamp}</span> : null}
        {turn.toolCalls.some((call) => call.server) ? (
          <Badge tone="muted">mcp</Badge>
        ) : null}
      </header>

      {turn.text ? <div className="rp-turn__body">{turn.text}</div> : null}

      {turn.toolCalls.map((call, index) => (
        <ToolCall key={`${call.id}-${index}`} call={call} />
      ))}
      {turn.toolResults.map((result, index) => (
        <ToolResult key={`${result.id}-${index}`} result={result} />
      ))}
    </article>
  );
}

function ConversationPage() {
  const { conversation } = manifest;
  const toolCalls = conversation.reduce(
    (total, turn) => total + turn.toolCalls.length,
    0,
  );
  const mcpCalls = conversation
    .flatMap((turn) => turn.toolCalls)
    .filter((call) => call.server).length;

  return (
    <Page
      title="Conversation"
      subtitle={`${num(conversation.length)} turns · ${num(toolCalls)} tool calls · ${num(mcpCalls)} MCP calls`}
    >
      {conversation.length === 0 ? (
        <Note tone="warn">
          No transcript was captured for this trial. Cost, efficiency and MCP
          usage are all derived from it, so those figures will be missing too.
        </Note>
      ) : (
        <Section heading="Turns">
          {conversation.map((turn) => (
            <Turn key={turn.index} turn={turn} />
          ))}
        </Section>
      )}
    </Page>
  );
}

const meta: Meta = {
  title: "Report/Conversation",
  parameters: { layout: "fullscreen" },
};

export default meta;

export const Conversation: StoryObj = { render: () => <ConversationPage /> };
