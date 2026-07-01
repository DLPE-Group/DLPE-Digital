/* ============================================================
   Shared DTO contracts between server and frontend.
   ============================================================ */

export interface CardDTO {
  id: string;
  companyId: string | null;
  track: string; // operational track key (bare, e.g. 'sales' or a custom 'insurance')
  type: string;
  customer: string;
  value: number | null;
  vehicle: string | null;
  sub: string;
  stageId: string;
  stageName: string;
  days: number;
  daysLabel: string | null;
  owner: string;
  status: string; // red | amber | green
  cta: string;
  sources: string[];
  awaitingSign: boolean;
  meta?: unknown;
  createdById: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReportSpec {
  title: string;
  prompt: string;
  period: string;
  format: string;
  scope: string[]; // lowercase track keys
}

export interface ReportProse {
  headline: string;
  tracks: Record<string, string>;
}

export interface ReportDTO {
  id: string;
  spec: ReportSpec;
  prose: ReportProse;
  when: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  scopeType: string;
  scopeNodeId: string | null;
  secondaryScopes: { roleId: string; scopeType: string; scopeNodeId: string | null }[];
}

export interface CascadeLine {
  track: string;
  text: string;
}
