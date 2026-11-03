export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  score: number;
  status: string;
  experienceYears?: number;
  hoursPerWeek?: number;
  source?: string;
  duplicateOf?: string | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: string;
  // leads.lead_activity.detail is JSONB, so the API returns an object.
  detail: string | Record<string, unknown>;
  actor: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  participantId: string;
  campaignSlug: string;
  amountMinor: number;
  currency: string;
  feeMinor: number;
  status: string;
  createdAt: string;
  providerRef?: string;
}

export interface TemplateVariable {
  name: string;
  label: string;
  required: boolean;
  example: string;
}

export interface Template {
  key: string;
  name: string;
  audience: 'street-team' | 'solace-avenue';
  status: 'approved' | 'draft';
  subject: string;
  variables: TemplateVariable[];
}
