export type Identifier = string;

export type AmountUnit = 'IRR' | 'TOMAN';

export type WorkspaceKey =
  | 'home'
  | 'accounting'
  | 'treasury'
  | 'inventory'
  | 'purchases'
  | 'sales'
  | 'production'
  | 'service'
  | 'reports'
  | 'settings';

export interface AuthenticatedUser {
  id: Identifier;
  companyId: Identifier;
  fullName: string;
  username: string;
  roles: Array<{id: Identifier; name: string; code: string}>;
  permissions: string[];
  preferredAmountUnit: AmountUnit;
  preferredWorkspace: WorkspaceKey | null;
}

export interface CompanyProfile {
  id: Identifier;
  nameFa: string;
  nameEn: string | null;
  logoUrl: string | null;
  baseCurrency: 'IRR';
  defaultAmountUnit: AmountUnit;
  timezone: 'Asia/Tehran';
}

export interface BootstrapResponse {
  setupRequired: boolean;
  company: CompanyProfile | null;
  user: AuthenticatedUser | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface ApiSuccess<T> {
  data: T;
}
