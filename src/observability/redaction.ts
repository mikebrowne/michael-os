const OPENAI_KEY_PATTERN = /sk-[a-zA-Z0-9]{20,}/g;
const CURSOR_KEY_PATTERN = /key_[a-zA-Z0-9]{20,}/g;
const BEARER_PATTERN = /Bearer\s+[a-zA-Z0-9._-]+/gi;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const ENV_ASSIGNMENT_PATTERN =
  /(OPENAI_API_KEY|CURSOR_API_KEY|VAULT_PATH|GITHUB_TOKEN|GH_TOKEN)\s*=\s*[^\s\n]+/gi;

const REDACTED = "[REDACTED]";

export function redactString(value: string): string {
  return value
    .replace(OPENAI_KEY_PATTERN, REDACTED)
    .replace(CURSOR_KEY_PATTERN, REDACTED)
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(ENV_ASSIGNMENT_PATTERN, (_match, key: string) => `${key}=${REDACTED}`);
}

export function redactUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return redactString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (/key|secret|token|password|authorization/i.test(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = redactUnknown(nested);
      }
    }
    return out;
  }
  return String(value);
}

export function containsKnownSecret(value: string): boolean {
  const patterns = [
    OPENAI_KEY_PATTERN,
    CURSOR_KEY_PATTERN,
    /your-openai-api-key/i,
    /your-cursor-api-key/i,
  ];
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}
