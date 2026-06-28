export type AgentKind = "mastra-agent" | "external-executor" | "skill";

export type AgentAuthority = "management" | "employee";

export type AgentRegistration = {
  id: string;
  role: string;
  kind: AgentKind;
  authority: AgentAuthority;
  description: string;
  model?: string;
  directChat: boolean;
  standalone: boolean;
  skills?: string[];
  tools?: string[];
};

export const AGENT_REGISTRY: AgentRegistration[] = [
  {
    id: "engineering-lead",
    role: "Engineering Lead",
    kind: "mastra-agent",
    authority: "management",
    description:
      "Orchestrates the engineering loop: grill, PRD, tests, build, review, ship.",
    directChat: true,
    standalone: false,
    skills: [
      "grill-me-with-docs",
      "to-prd",
      "research-write-tests",
      "build-handoff",
      "ship",
      "code-review",
    ],
    tools: [
      "save-grill-notes",
      "save-prd",
      "save-test-artifacts",
      "github-create-issue",
      "github-update-issue",
      "list-in-progress",
      "resume-work-item",
      "run-build",
      "review-build",
      "verify-build",
      "ship-docs",
      "ship-implementation",
      "stage-implementation",
      "promote",
      "rollback",
    ],
  },
  {
    id: "software-engineer",
    role: "Software Engineer",
    kind: "external-executor",
    authority: "employee",
    description:
      "Writes implementation code via Cursor (runAgentBuild). Not a conversational agent.",
    directChat: false,
    standalone: false,
    tools: ["run-build"],
  },
  {
    id: "qa-engineer",
    role: "QA Engineer",
    kind: "mastra-agent",
    authority: "employee",
    description:
      "Runs verification gates on green builds against PRD and acceptance test. Composite verdict before promotion.",
    model: "reasoning-tier",
    directChat: false,
    standalone: true,
    skills: ["code-review", "security-review"],
    tools: ["review-build"],
  },
  {
    id: "spec-planning-test",
    role: "Spec / Planning / Test",
    kind: "skill",
    authority: "employee",
    description: "Judgment skills loaded on Engineering Lead.",
    directChat: false,
    standalone: false,
    skills: ["grill-me-with-docs", "to-prd", "research-write-tests"],
  },
];

export function listAgents(): AgentRegistration[] {
  return [...AGENT_REGISTRY];
}

export function getAgent(id: string): AgentRegistration | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}

export function listMastraAgents(): AgentRegistration[] {
  return AGENT_REGISTRY.filter((a) => a.kind === "mastra-agent");
}
