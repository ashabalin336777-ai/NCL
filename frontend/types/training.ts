export type Difficulty = "easy" | "medium" | "hard";
export type ClientRole =
  | "procurement_director"
  | "chief_engineer"
  | "supply_officer";
export type TrainingStatus = "created" | "in_progress" | "completed" | "aborted";
export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  tokens_used: number;
  cost_rub: string;
  created_at: string;
}

export interface Hint {
  id: string;
  response_text: string;
  tokens_used: number;
  cost_rub: string;
  created_at: string;
}

export interface Analysis {
  id: string;
  training_id: string;
  overall_score: number;
  needs_score: number;
  presentation_score: number;
  objections_score: number;
  summary_json: {
    text?: string;
    outcome?: string;
    criteria_comments?: Record<string, string>;
  };
  strengths_json: string[];
  improvements_json: string[];
  cost_rub: string;
  created_at: string;
}

export interface HiddenClientCard {
  company_name: string;
  contact_name: string;
  role_title: string;
  industry: string;
  product: string;
  hidden_pain: string;
  surface_request: string;
  previous_experience: string;
  initial_stance: string;
  trust_triggers: string[];
  planned_objections: string[];
  next_step_if_convinced: string;
  difficulty: Difficulty;
  role_code: ClientRole;
}

export interface RadarScores {
  needs_discovery: number;
  solution_presentation: number;
  objection_handling: number;
  closing_persistence: number;
  technical_expertise: number;
  risk_management: number;
}

export interface ClientBrief {
  company_name: string;
  contact_name: string;
  role_title: string;
  industry: string;
}

export interface Training {
  id: string;
  difficulty: Difficulty;
  client_role: ClientRole;
  status: TrainingStatus;
  outcome: string | null;
  total_cost_rub: string;
  prompt_name: string | null;
  prompt_version: number | null;
  created_at: string;
  ended_at: string | null;
  messages: Message[];
  hints: Hint[];
  client_brief?: ClientBrief | null;
  /** Ready-made chat label: "Имя, Компания" from generated card */
  client_label?: string | null;
  hidden_card: HiddenClientCard | null;
  analysis: Analysis | null;
  radar_scores?: RadarScores | null;
}

export interface TrainingCreateResponse extends Training {
  usage: {
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_rub: string;
  };
}

export interface TrainingCompleteResponse extends Training {
  analysis_usage: {
    model: string;
    total_tokens: number;
    cost_rub: string;
  } | null;
}
