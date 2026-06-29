import { RequestContext } from "@mastra/core/request-context";

export const SKILL_TEST_MODE_KEY = "testMode";

export function isSkillTestMode(requestContext?: RequestContext): boolean {
  return requestContext?.get(SKILL_TEST_MODE_KEY) === true;
}

export function createSkillEvalRequestContext(): RequestContext {
  const ctx = new RequestContext();
  ctx.set(SKILL_TEST_MODE_KEY, true);
  return ctx;
}

export function enableSkillTestMode(ctx: RequestContext): void {
  ctx.set(SKILL_TEST_MODE_KEY, true);
}
