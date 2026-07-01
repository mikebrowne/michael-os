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
