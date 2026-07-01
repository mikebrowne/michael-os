/** Artifact form recommendation from the authoring-policy skill. */
export type AuthoringForm = "skill" | "tool" | "workflow" | "agent";

/** Categories routed through the single activation approval seam. */
export type ActivationCategory = AuthoringForm | "proposal";

export type AuthoringProposalInput = {
  title: string;
  userStory: string;
  technicalDetail: string;
  nonTechnicalDetail: string;
  recommendedForm: AuthoringForm;
  rationale: string;
  labels?: string[];
};

export type AuthoringProposalResult = {
  issueNumber?: number;
  title: string;
  body: string;
  urlHint: string;
};
