CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name_fa VARCHAR(180) NOT NULL,
  name_en VARCHAR(180),
  registration_number VARCHAR(80),
  national_id VARCHAR(30),
  economic_code VARCHAR(30),
  tax_id VARCHAR(80),
  phone VARCHAR(30),
  address TEXT,
  postal_code VARCHAR(20),
  logo_path TEXT,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'IRR'
    CHECK (base_currency = 'IRR'),
  default_amount_unit VARCHAR(5) NOT NULL DEFAULT 'IRR'
    CHECK (default_amount_unit IN ('IRR', 'TOMAN')),
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Tehran'
    CHECK (timezone = 'Asia/Tehran'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(30),
  address TEXT,
  is_head_office BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE UNIQUE INDEX one_head_office_per_company
ON branches (company_id)
WHERE is_head_office = true AND is_active = true;

CREATE TRIGGER branches_updated_at
BEFORE UPDATE ON branches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  code VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  warehouse_type VARCHAR(30) NOT NULL DEFAULT 'general'
    CHECK (
      warehouse_type IN (
        'general',
        'raw_material',
        'work_in_progress',
        'finished_goods',
        'service',
        'quarantine'
      )
    ),
  allow_negative BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE INDEX warehouses_branch_idx ON warehouses (branch_id);

CREATE TRIGGER warehouses_updated_at
BEFORE UPDATE ON warehouses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  full_name VARCHAR(160) NOT NULL,
  username VARCHAR(80) NOT NULL,
  password_hash TEXT NOT NULL,
  preferred_amount_unit VARCHAR(5) NOT NULL DEFAULT 'IRR'
    CHECK (preferred_amount_unit IN ('IRR', 'TOMAN')),
  preferred_workspace VARCHAR(40),
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_company_username_unique
ON users (company_id, lower(username));

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TRIGGER roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE permissions (
  code VARCHAR(120) PRIMARY KEY,
  module VARCHAR(60) NOT NULL,
  title VARCHAR(180) NOT NULL
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_code VARCHAR(120) NOT NULL
    REFERENCES permissions(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  idle_expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at, idle_expires_at);

CREATE TABLE login_attempts (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  ip_address INET,
  was_successful BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_lookup_idx
ON login_attempts (lower(username), ip_address, attempted_at DESC);

CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  scope_type VARCHAR(20) NOT NULL
    CHECK (scope_type IN ('company', 'branch', 'user')),
  scope_id UUID NOT NULL,
  setting_key VARCHAR(120) NOT NULL,
  setting_value JSONB NOT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT false,
  row_version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, scope_type, scope_id, setting_key)
);

CREATE TRIGGER app_settings_updated_at
BEFORE UPDATE ON app_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  branch_id UUID REFERENCES branches(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(120) NOT NULL,
  entity_id VARCHAR(120),
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  request_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_company_time_idx
ON audit_logs (company_id, created_at DESC);

CREATE INDEX audit_entity_idx
ON audit_logs (company_id, entity_type, entity_id);

CREATE OR REPLACE FUNCTION block_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION block_audit_mutation();

CREATE TABLE document_sequences (
  company_id UUID NOT NULL REFERENCES companies(id),
  sequence_key VARCHAR(80) NOT NULL,
  sequence_scope VARCHAR(80) NOT NULL DEFAULT 'global',
  prefix VARCHAR(30) NOT NULL DEFAULT '',
  last_value BIGINT NOT NULL DEFAULT 0,
  padding SMALLINT NOT NULL DEFAULT 6 CHECK (padding BETWEEN 1 AND 18),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, sequence_key, sequence_scope)
);

CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(40) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(200),
  party_type VARCHAR(20) NOT NULL DEFAULT 'person'
    CHECK (party_type IN ('person', 'company')),
  is_customer BOOLEAN NOT NULL DEFAULT false,
  is_supplier BOOLEAN NOT NULL DEFAULT false,
  national_id VARCHAR(30),
  economic_code VARCHAR(30),
  registration_number VARCHAR(80),
  mobile VARCHAR(30),
  phone VARCHAR(30),
  email VARCHAR(180),
  address TEXT,
  postal_code VARCHAR(20),
  credit_limit_irr BIGINT NOT NULL DEFAULT 0 CHECK (credit_limit_irr >= 0),
  payment_terms_days INTEGER NOT NULL DEFAULT 0 CHECK (payment_terms_days >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (is_customer OR is_supplier),
  UNIQUE (company_id, code)
);

CREATE INDEX parties_name_idx
ON parties (company_id, display_name);

CREATE TRIGGER parties_updated_at
BEFORE UPDATE ON parties
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(30) NOT NULL,
  name VARCHAR(80) NOT NULL,
  decimal_places SMALLINT NOT NULL DEFAULT 0
    CHECK (decimal_places BETWEEN 0 AND 6),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(60) NOT NULL,
  name VARCHAR(200) NOT NULL,
  product_type VARCHAR(30) NOT NULL
    CHECK (
      product_type IN (
        'purchased',
        'component',
        'manufactured',
        'semi_finished',
        'consumable',
        'service'
      )
    ),
  tracking_type VARCHAR(20) NOT NULL DEFAULT 'none'
    CHECK (tracking_type IN ('none', 'serial', 'batch')),
  base_unit_id UUID NOT NULL REFERENCES units(id),
  barcode VARCHAR(120),
  description TEXT,
  minimum_stock NUMERIC(20, 6) NOT NULL DEFAULT 0,
  default_sale_price_irr BIGINT NOT NULL DEFAULT 0,
  default_purchase_price_irr BIGINT NOT NULL DEFAULT 0,
  tax_rate NUMERIC(7, 4) NOT NULL DEFAULT 0
    CHECK (tax_rate BETWEEN 0 AND 100),
  is_sellable BOOLEAN NOT NULL DEFAULT true,
  is_purchasable BOOLEAN NOT NULL DEFAULT true,
  is_producible BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE UNIQUE INDEX products_barcode_unique
ON products (company_id, barcode)
WHERE barcode IS NOT NULL;

CREATE INDEX products_name_idx ON products (company_id, name);

CREATE TRIGGER products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  uploaded_by UUID REFERENCES users(id),
  storage_path TEXT NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(160) NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  sha256 CHAR(64) NOT NULL,
  purpose VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX uploaded_files_company_idx
ON uploaded_files (company_id, created_at DESC);
