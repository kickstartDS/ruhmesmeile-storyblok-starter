import fs from "node:fs";
import { readDefaults } from "./lib/static.mjs";
import { buildDeclared } from "./lib/declared.mjs";
import { defaultStoryId } from "./lib/genStories.mjs";

const ROOT = new URL("../..", import.meta.url).pathname;
const SPIKE = ["button", "section", "faq", "slider", "blog-aside"];

for (const id of SPIKE) {
  const schema = JSON.parse(
    fs.readFileSync(
      `${ROOT}/src/components/${id}/${id}.schema.dereffed.json`,
      "utf8",
    ),
  );
  const defaults = readDefaults(ROOT, id);
  const { config, sources, gaps } = buildDeclared(schema, defaults);
  console.log(`\n=== ${id} → ${defaultStoryId(id)}`);
  console.log("  config:", JSON.stringify(config).slice(0, 400));
  console.log("  sources:", JSON.stringify(sources));
  console.log("  gaps:", JSON.stringify(gaps));
}
