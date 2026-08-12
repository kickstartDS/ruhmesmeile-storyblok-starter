import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import "./disclosure.scss";

export interface DisclosureProps {
  /** Always-visible label that toggles the panel. */
  summary: string;
  /** Body copy revealed when the disclosure is open. */
  content: string;
  /** Whether the panel starts expanded on first paint. */
  defaultOpen?: boolean;
  /** Identifier used to associate the trigger with its panel. */
  id?: string;
}

export const DisclosureContextDefault = forwardRef<
  HTMLDivElement,
  DisclosureProps & Omit<HTMLAttributes<HTMLDivElement>, "id" | "content">
>(({ summary, content, defaultOpen = false, id, ...props }, ref) => {
  const panelId = id ? `${id}-panel` : undefined;

  return (
    <div {...props} ref={ref} id={id} className="dsa-disclosure">
      <button
        type="button"
        className="dsa-disclosure__trigger"
        // Rendered, not hydrated: a panel that opens on load flashes shut on
        // first paint for every default-open disclosure on the page.
        aria-expanded={defaultOpen ? "true" : "false"}
        aria-controls={panelId}
      >
        {summary}
      </button>

      <div id={panelId} className="dsa-disclosure__panel">
        <p className="dsa-disclosure__content">{content}</p>
      </div>
    </div>
  );
});

DisclosureContextDefault.displayName = "Disclosure";

export const DisclosureContext = createContext(DisclosureContextDefault);

export const Disclosure = forwardRef<
  HTMLDivElement,
  DisclosureProps & Omit<HTMLAttributes<HTMLDivElement>, "id" | "content">
>((props, ref) => {
  const Component = useContext(DisclosureContext);
  return <Component {...props} ref={ref} />;
});

Disclosure.displayName = "Disclosure";
