/**
 * Mastra's validateSkillMetadata is not publicly exported from @mastra/core.
 * This module mirrors the Agent Skills spec rules from SKILL_LIMITS (see ADR 0009).
 */
export const SKILL_LIMITS = {
  MAX_NAME_LENGTH: 64,
  MAX_DESCRIPTION_LENGTH: 1024,
  MAX_COMPATIBILITY_LENGTH: 500,
} as const;

export type SkillValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateSkillMetadata(
  metadata: {
    name?: string;
    description?: string;
    license?: string;
    compatibility?: unknown;
    "user-invocable"?: boolean;
    metadata?: Record<string, unknown>;
  },
  dirName?: string,
): SkillValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = metadata.name;
  if (!name || typeof name !== "string") {
    errors.push("Skill name is required");
  } else {
    if (name.length > SKILL_LIMITS.MAX_NAME_LENGTH) {
      errors.push(
        `Skill name must be at most ${SKILL_LIMITS.MAX_NAME_LENGTH} characters`,
      );
    }
    if (!NAME_PATTERN.test(name)) {
      errors.push(
        "Skill name must be lowercase letters, numbers, and hyphens only",
      );
    }
    if (dirName && name !== dirName) {
      errors.push(`Skill name "${name}" must match directory name "${dirName}"`);
    }
  }

  const description = metadata.description;
  if (!description || typeof description !== "string") {
    errors.push("Skill description is required");
  } else if (description.length > SKILL_LIMITS.MAX_DESCRIPTION_LENGTH) {
    errors.push(
      `Description must be at most ${SKILL_LIMITS.MAX_DESCRIPTION_LENGTH} characters`,
    );
  } else if (description.length === 0) {
    errors.push("Skill description cannot be empty");
  }

  if (
    metadata.compatibility != null &&
    typeof metadata.compatibility === "string" &&
    metadata.compatibility.length > SKILL_LIMITS.MAX_COMPATIBILITY_LENGTH
  ) {
    warnings.push(
      `Compatibility field exceeds recommended ${SKILL_LIMITS.MAX_COMPATIBILITY_LENGTH} characters`,
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}
