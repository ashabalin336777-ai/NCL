export type UserRole = "manager" | "admin";

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
