import { readFileSync } from "node:fs";

export type SkillDefinition = {
  name: string;
  description: string;
  body: string;
  disableModelInvocation?: boolean;
};

function parseFrontmatter(raw: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: raw.trim() };
  }

  const frontmatter: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body: match[2]!.trim() };
}

export function parseSkillMarkdown(raw: string): SkillDefinition {
  const { frontmatter, body } = parseFrontmatter(raw);
  const name = frontmatter.name;
  if (!name) {
    throw new Error("SKILL.md is missing required frontmatter field: name");
  }

  return {
    name,
    description: frontmatter.description ?? "",
    body,
    disableModelInvocation: frontmatter["disable-model-invocation"] === "true",
  };
}

export function loadSkillFile(path: string): SkillDefinition {
  return parseSkillMarkdown(readFileSync(path, "utf-8"));
}
