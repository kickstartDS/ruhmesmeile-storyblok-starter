import type { Preview } from "@storybook/react-vite";

import "./report.css";

/**
 * Story order, from PRD §8.2.
 *
 * The produced component sits directly after the summary rather than at the
 * end: the first question a reviewer asks is "what did it build", and every
 * page after it is evidence for that answer.
 *
 * The array is inlined because Storybook reads `storySort` by statically
 * parsing this file — a `const` reference parses as "unsupported" and fails
 * the build.
 */
const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    options: {
      storySort: {
        order: [
          "Report",
          [
            "Summary",
            "Component",
            "Conversation",
            "Graders",
            "Output",
            "Source",
          ],
        ],
      },
    },
    docs: { toc: true },
  },
};

export default preview;
