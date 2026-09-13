export type UserRole = "manager" | "admin" | "developer";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  full_name: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface ApiErrorBody {
  detail?: string | Array<{ msg?: string; loc?: unknown[] }>;
}

export interface ManagerStats {
  trainings_total: number;
  trainings_completed: number;
  average_overall_score: number | null;
  average_needs_score: number | null;
  average_presentation_score: number | null;
  average_objections_score: number | null;
  total_cost_rub: string;
  outcomes: Record<string, number>;
  manager_id?: string | null;
  manager_name?: string | null;
  manager_email?: string | null;
}

export interface TeamStats {
  trainings_total: number;
  trainings_completed: number;
  completion_rate: number;
  average_overall_score: number | null;
  total_cost_rub: string;
  outcomes: Record<string, number>;
  managers: ManagerStats[];
}

export interface StatsSeriesPoint {
  period: string;
  trainings_count: number;
  average_overall_score: number | null;
  total_cost_rub: string;
}

export interface BillingAccount {
  balance_rub: string;
  currency: string;
  updated_at: string | null;
  min_reserve_rub: string;
}

export interface BillingLedgerEntry {
  id: string;
  created_at: string;
  type: string;
  amount_rub: string;
  balance_after: string;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  provider: string | null;
  meta_json: Record<string, unknown> | null;
}

export interface PromptItem {
  id: string;
  name: string;
  system_prompt_text: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AISetting {
  id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

export interface TrainingListItem {
  id: string;
  user_id: string;
  manager_name: string | null;
  manager_email: string | null;
  difficulty: string;
  client_role: string;
  industry: string | null;
  status: string;
  outcome: string | null;
  overall_score: number | null;
  total_cost_rub: string;
  created_at: string;
  ended_at: string | null;
}
