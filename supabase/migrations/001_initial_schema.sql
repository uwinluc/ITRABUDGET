-- ============================================================
-- ITRABUDGET - Schéma initial complet
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE org_level AS ENUM ('holding', 'country', 'subsidiary', 'direction', 'service');
CREATE TYPE org_type AS ENUM ('holding', 'country', 'headquarters', 'agency', 'extension', 'direction', 'service');
CREATE TYPE user_role AS ENUM (
  'admin',
  'dg_holding', 'dga_holding', 'consolidation_officer', 'legal_officer', 'audit_director',
  'dg_subsidiary', 'dga_subsidiary', 'director', 'service_chief',
  'copil_president', 'copil_member'
);
CREATE TYPE budget_status AS ENUM (
  'draft', 'submitted', 'under_review', 'approved', 'rejected',
  'locked', 'transmitted', 'consolidated', 'final'
);
CREATE TYPE budget_category AS ENUM ('operating', 'investment', 'revenue', 'project', 'other');
CREATE TYPE price_type AS ENUM ('htva', 'tvac');
CREATE TYPE transaction_type AS ENUM (
  'creation', 'submission', 'validation', 'rejection', 'adjustment',
  'locking', 'transmission', 'consolidation', 'amendment', 'transfer'
);
CREATE TYPE execution_status AS ENUM (
  'credit_open', 'engaged', 'liquidated', 'ordered', 'paid', 'cancelled'
);
CREATE TYPE notif_channel AS ENUM ('email', 'sms', 'in_app');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE fiscal_year_status AS ENUM ('preparation', 'active', 'closed', 'archived');
CREATE TYPE vote_decision AS ENUM ('approve', 'reject', 'abstain');
CREATE TYPE intercompany_status AS ENUM ('pending', 'validated_by_sender', 'validated_by_receiver', 'matched', 'eliminated', 'disputed');

-- ============================================================
-- ORGANISATIONS (hiérarchie 5 niveaux)
-- ============================================================

CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  level         org_level NOT NULL,
  type          org_type NOT NULL,
  parent_id     UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  country_code  CHAR(2),                    -- ISO 3166-1 alpha-2
  currency_code CHAR(3),                    -- ISO 4217
  has_copil     BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  logo_url      TEXT,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_level_type CHECK (
    (level = 'holding' AND type = 'holding') OR
    (level = 'country' AND type = 'country') OR
    (level = 'subsidiary' AND type IN ('headquarters','agency','extension')) OR
    (level = 'direction' AND type = 'direction') OR
    (level = 'service' AND type = 'service')
  )
);

-- ============================================================
-- UTILISATEURS (extension de auth.users Supabase)
-- ============================================================

CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  phone               TEXT,
  avatar_url          TEXT,
  preferred_language  CHAR(2) DEFAULT 'fr',
  is_active           BOOLEAN DEFAULT TRUE,
  two_factor_enabled  BOOLEAN DEFAULT FALSE,
  two_factor_secret   TEXT,                  -- TOTP secret (encrypted)
  last_login_at       TIMESTAMPTZ,
  notification_email  BOOLEAN DEFAULT TRUE,
  notification_sms    BOOLEAN DEFAULT FALSE,
  notification_in_app BOOLEAN DEFAULT TRUE,
  theme               TEXT DEFAULT 'system',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RÔLES ET ASSIGNATIONS
-- ============================================================

CREATE TABLE user_roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            user_role NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  granted_by      UUID REFERENCES profiles(id),
  valid_from      TIMESTAMPTZ DEFAULT NOW(),
  valid_until     TIMESTAMPTZ,               -- NULL = permanent
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role, organization_id)
);

-- Délégations temporaires
CREATE TABLE delegations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delegator_id    UUID NOT NULL REFERENCES profiles(id),
  delegate_id     UUID NOT NULL REFERENCES profiles(id),
  role            user_role NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  reason          TEXT NOT NULL,
  valid_from      TIMESTAMPTZ NOT NULL,
  valid_until     TIMESTAMPTZ NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_delegation_dates CHECK (valid_until > valid_from),
  CONSTRAINT chk_no_self_delegation CHECK (delegator_id != delegate_id)
);

-- ============================================================
-- DEVISES ET TAUX DE CHANGE
-- ============================================================

CREATE TABLE currencies (
  code        CHAR(3) PRIMARY KEY,           -- ISO 4217
  name_fr     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  name_pt     TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  is_reference BOOLEAN DEFAULT FALSE,        -- USD est la devise de référence
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exchange_rates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency   CHAR(3) NOT NULL REFERENCES currencies(code),
  to_currency     CHAR(3) NOT NULL REFERENCES currencies(code),
  rate            NUMERIC(18,6) NOT NULL CHECK (rate > 0),
  effective_date  DATE NOT NULL,
  fiscal_year_id  UUID,                      -- FK ajoutée après création fiscal_years
  set_by          UUID REFERENCES profiles(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_currency, to_currency, effective_date)
);

-- ============================================================
-- EXERCICES FISCAUX
-- ============================================================

CREATE TABLE fiscal_years (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code            TEXT NOT NULL,             -- ex: "2025", "2025-2026"
  name            TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          fiscal_year_status DEFAULT 'preparation',
  reference_currency CHAR(3) DEFAULT 'USD' REFERENCES currencies(code),
  budget_deadline DATE,                      -- Date limite de soumission des budgets
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_fy_dates CHECK (end_date > start_date),
  UNIQUE (organization_id, code)
);

-- Ajout FK manquante sur exchange_rates
ALTER TABLE exchange_rates ADD CONSTRAINT fk_exchange_rates_fy
  FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id);

-- ============================================================
-- RUBRIQUES ET CATÉGORIES BUDGÉTAIRES
-- ============================================================

CREATE TABLE budget_rubrics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),  -- NULL = global
  category        budget_category NOT NULL,
  code            TEXT NOT NULL,
  name_fr         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  name_pt         TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budget_units (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code      TEXT NOT NULL UNIQUE,
  name_fr   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  name_pt   TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- BUDGETS DE PRÉVISION
-- ============================================================

CREATE TABLE budgets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fiscal_year_id  UUID NOT NULL REFERENCES fiscal_years(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title           TEXT NOT NULL,
  status          budget_status DEFAULT 'draft',
  submitted_at    TIMESTAMPTZ,
  locked_at       TIMESTAMPTZ,
  transmitted_at  TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  updated_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budget_lines (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id         UUID NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
  rubric_id         UUID REFERENCES budget_rubrics(id),
  category          budget_category NOT NULL,
  paa               TEXT,                    -- Plan d'Action Annuel
  title             TEXT NOT NULL,
  description       TEXT,
  period_start      DATE,
  period_end        DATE,
  priority          priority_level DEFAULT 'medium',
  quantity          NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
  unit_id           UUID REFERENCES budget_units(id),
  unit_label        TEXT,                    -- Libellé libre si non référencé
  unit_price        NUMERIC(18,2) NOT NULL CHECK (unit_price >= 0),
  price_type        price_type DEFAULT 'htva',
  vat_rate          NUMERIC(5,2) DEFAULT 0 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  amount_htva       NUMERIC(18,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  amount_tvac       NUMERIC(18,2) GENERATED ALWAYS AS (quantity * unit_price * (1 + vat_rate/100)) STORED,
  currency_code     CHAR(3) NOT NULL REFERENCES currencies(code),
  amount_usd        NUMERIC(18,2),           -- Calculé via taux de change
  exchange_rate_id  UUID REFERENCES exchange_rates(id),
  justification_why TEXT NOT NULL,
  justification_consequence TEXT NOT NULL,
  is_recurring      BOOLEAN DEFAULT FALSE,
  parent_line_id    UUID REFERENCES budget_lines(id),  -- Pour amendments
  line_number       INTEGER,
  created_by        UUID NOT NULL REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PIÈCES JOINTES
-- ============================================================

CREATE TABLE attachments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type     TEXT NOT NULL,             -- 'budget_line', 'transaction', 'execution', etc.
  entity_id       UUID NOT NULL,
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL,             -- Supabase Storage path
  file_size       INTEGER NOT NULL,
  mime_type       TEXT NOT NULL,
  uploaded_by     UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSACTIONS (cœur immuable du système)
-- ============================================================

CREATE TABLE budget_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id       UUID NOT NULL REFERENCES budgets(id),
  budget_line_id  UUID REFERENCES budget_lines(id),
  type            transaction_type NOT NULL,
  from_status     budget_status,
  to_status       budget_status,
  amount          NUMERIC(18,2),
  currency_code   CHAR(3) REFERENCES currencies(code),
  exchange_rate   NUMERIC(18,6),
  amount_usd      NUMERIC(18,2),
  performed_by    UUID NOT NULL REFERENCES profiles(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  comment         TEXT,
  metadata        JSONB DEFAULT '{}',
  ip_address      INET,
  hash            TEXT,                      -- SHA-256 du contenu pour intégrité
  created_at      TIMESTAMPTZ DEFAULT NOW()
  -- Pas de updated_at : les transactions sont immuables
);

-- ============================================================
-- WORKFLOW DE VALIDATION
-- ============================================================

CREATE TABLE workflow_steps (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  step_order      INTEGER NOT NULL,
  role_required   user_role NOT NULL,
  step_name_fr    TEXT NOT NULL,
  step_name_en    TEXT NOT NULL,
  step_name_pt    TEXT NOT NULL,
  is_mandatory    BOOLEAN DEFAULT TRUE,
  deadline_days   INTEGER DEFAULT 3,         -- Jours ouvrables
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, step_order)
);

CREATE TABLE budget_approvals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id       UUID NOT NULL REFERENCES budgets(id),
  workflow_step_id UUID NOT NULL REFERENCES workflow_steps(id),
  approver_id     UUID REFERENCES profiles(id),
  decision        TEXT CHECK (decision IN ('approved', 'rejected', 'pending')),
  comment         TEXT,
  decided_at      TIMESTAMPTZ,
  deadline        TIMESTAMPTZ,
  escalated       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COPIL
-- ============================================================

CREATE TABLE copil_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id         UUID NOT NULL REFERENCES profiles(id),
  role            user_role NOT NULL CHECK (role IN ('copil_president', 'copil_member')),
  is_active       BOOLEAN DEFAULT TRUE,
  appointed_at    TIMESTAMPTZ DEFAULT NOW(),
  appointed_by    UUID REFERENCES profiles(id),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE copil_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  budget_id       UUID NOT NULL REFERENCES budgets(id),
  fiscal_year_id  UUID NOT NULL REFERENCES fiscal_years(id),
  convened_by     UUID NOT NULL REFERENCES profiles(id),
  session_date    TIMESTAMPTZ,
  quorum_met      BOOLEAN DEFAULT FALSE,
  final_decision  vote_decision,
  pv_url          TEXT,                      -- Procès-verbal PDF
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE copil_votes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES copil_sessions(id),
  member_id       UUID NOT NULL REFERENCES copil_members(id),
  decision        vote_decision NOT NULL,
  comment         TEXT,
  voted_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, member_id)
);

-- ============================================================
-- EXÉCUTION BUDGÉTAIRE
-- ============================================================

CREATE TABLE credit_openings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_line_id  UUID NOT NULL REFERENCES budget_lines(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  fiscal_year_id  UUID NOT NULL REFERENCES fiscal_years(id),
  amount          NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  amount_usd      NUMERIC(18,2),
  opened_by       UUID NOT NULL REFERENCES profiles(id),
  opened_at       TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT
);

CREATE TABLE engagements (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_opening_id UUID NOT NULL REFERENCES credit_openings(id),
  vendor_id         UUID,                    -- FK vers vendors (ajoutée après)
  reference         TEXT NOT NULL UNIQUE,    -- Numéro engagement unique
  description       TEXT NOT NULL,
  amount            NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency_code     CHAR(3) NOT NULL REFERENCES currencies(code),
  amount_usd        NUMERIC(18,2),
  status            execution_status DEFAULT 'engaged',
  engaged_by        UUID NOT NULL REFERENCES profiles(id),
  engaged_at        TIMESTAMPTZ DEFAULT NOW(),
  expected_date     DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE liquidations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES engagements(id),
  invoice_ref     TEXT NOT NULL,
  invoice_date    DATE NOT NULL,
  amount          NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  amount_usd      NUMERIC(18,2),
  service_done_at DATE,
  verified_by     UUID NOT NULL REFERENCES profiles(id),
  verified_at     TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ordonnances (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  liquidation_id  UUID NOT NULL REFERENCES liquidations(id),
  reference       TEXT NOT NULL UNIQUE,
  amount          NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  ordered_by      UUID NOT NULL REFERENCES profiles(id),
  ordered_at      TIMESTAMPTZ DEFAULT NOW(),
  payment_due     DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ordonnance_id   UUID NOT NULL REFERENCES ordonnances(id),
  reference       TEXT NOT NULL UNIQUE,
  amount          NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  amount_usd      NUMERIC(18,2),
  payment_date    DATE NOT NULL,
  payment_method  TEXT,                      -- virement, chèque, etc.
  paid_by         UUID NOT NULL REFERENCES profiles(id),
  bank_reference  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FOURNISSEURS
-- ============================================================

CREATE TABLE vendors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name            TEXT NOT NULL,
  code            TEXT NOT NULL,
  country_code    CHAR(2),
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  tax_number      TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

ALTER TABLE engagements ADD CONSTRAINT fk_engagements_vendor
  FOREIGN KEY (vendor_id) REFERENCES vendors(id);

-- ============================================================
-- TRANSACTIONS INTER-FILIALES
-- ============================================================

CREATE TABLE intercompany_transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference             TEXT NOT NULL UNIQUE,  -- Référence inter-company unique
  fiscal_year_id        UUID NOT NULL REFERENCES fiscal_years(id),
  sender_org_id         UUID NOT NULL REFERENCES organizations(id),
  receiver_org_id       UUID NOT NULL REFERENCES organizations(id),
  budget_line_id_sender UUID REFERENCES budget_lines(id),
  description           TEXT NOT NULL,
  amount                NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency_code         CHAR(3) NOT NULL REFERENCES currencies(code),
  amount_usd            NUMERIC(18,2),
  status                intercompany_status DEFAULT 'pending',
  created_by            UUID NOT NULL REFERENCES profiles(id),
  validated_by_sender   UUID REFERENCES profiles(id),
  validated_sender_at   TIMESTAMPTZ,
  validated_by_receiver UUID REFERENCES profiles(id),
  validated_receiver_at TIMESTAMPTZ,
  matched_at            TIMESTAMPTZ,
  eliminated_at         TIMESTAMPTZ,
  dispute_reason        TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_interco_orgs CHECK (sender_org_id != receiver_org_id)
);

-- ============================================================
-- CONSOLIDATIONS GROUPE
-- ============================================================

CREATE TABLE consolidations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fiscal_year_id  UUID NOT NULL REFERENCES fiscal_years(id),
  reference_currency CHAR(3) DEFAULT 'USD' REFERENCES currencies(code),
  total_budget_usd   NUMERIC(18,2),
  total_consumed_usd NUMERIC(18,2),
  interco_eliminated NUMERIC(18,2),
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  prepared_by     UUID NOT NULL REFERENCES profiles(id),
  validated_by    UUID REFERENCES profiles(id),
  prepared_at     TIMESTAMPTZ DEFAULT NOW(),
  validated_at    TIMESTAMPTZ,
  snapshot        JSONB,                     -- Snapshot complet de la consolidation
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id),
  channel         notif_channel NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  is_read         BOOLEAN DEFAULT FALSE,
  sent_at         TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOURNAL D'AUDIT (immuable)
-- ============================================================

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES profiles(id),
  organization_id UUID REFERENCES organizations(id),
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  before_value    JSONB,
  after_value     JSONB,
  ip_address      INET,
  user_agent      TEXT,
  fiscal_year_id  UUID REFERENCES fiscal_years(id),
  hash            TEXT NOT NULL,             -- SHA-256 pour intégrité
  created_at      TIMESTAMPTZ DEFAULT NOW()
  -- PAS de UPDATE possible : protégé par RLS + trigger
);

-- ============================================================
-- DONNÉES INITIALES : DEVISES
-- ============================================================

INSERT INTO currencies (code, name_fr, name_en, name_pt, symbol, is_reference) VALUES
  ('USD', 'Dollar américain', 'US Dollar', 'Dólar americano', '$', TRUE),
  ('EUR', 'Euro', 'Euro', 'Euro', '€', FALSE),
  ('TZS', 'Shilling tanzanien', 'Tanzanian Shilling', 'Xelim tanzaniano', 'TSh', FALSE),
  ('KES', 'Shilling kényan', 'Kenyan Shilling', 'Xelim queniano', 'KSh', FALSE),
  ('UGX', 'Shilling ougandais', 'Ugandan Shilling', 'Xelim ugandense', 'USh', FALSE),
  ('GBP', 'Livre sterling', 'British Pound', 'Libra esterlina', '£', FALSE),
  ('XAF', 'Franc CFA BEAC', 'CFA Franc BEAC', 'Franco CFA BEAC', 'FCFA', FALSE),
  ('XOF', 'Franc CFA BCEAO', 'CFA Franc BCEAO', 'Franco CFA BCEAO', 'CFA', FALSE),
  ('MZN', 'Metical mozambicain', 'Mozambican Metical', 'Metical moçambicano', 'MT', FALSE),
  ('AOA', 'Kwanza angolais', 'Angolan Kwanza', 'Kwanza angolano', 'Kz', FALSE),
  ('RWF', 'Franc rwandais', 'Rwandan Franc', 'Franco ruandês', 'RF', FALSE),
  ('BIF', 'Franc burundais', 'Burundian Franc', 'Franco burundiano', 'FBu', FALSE),
  ('CDF', 'Franc congolais', 'Congolese Franc', 'Franco congolês', 'FC', FALSE);

-- ============================================================
-- DONNÉES INITIALES : UNITÉS
-- ============================================================

INSERT INTO budget_units (code, name_fr, name_en, name_pt) VALUES
  ('piece', 'Pièce', 'Piece', 'Peça'),
  ('month', 'Mois', 'Month', 'Mês'),
  ('year', 'Année', 'Year', 'Ano'),
  ('day', 'Jour', 'Day', 'Dia'),
  ('hour', 'Heure', 'Hour', 'Hora'),
  ('week', 'Semaine', 'Week', 'Semana'),
  ('license', 'Licence', 'License', 'Licença'),
  ('session', 'Session', 'Session', 'Sessão'),
  ('unit', 'Unité', 'Unit', 'Unidade'),
  ('liter', 'Litre', 'Liter', 'Litro'),
  ('kg', 'Kilogramme', 'Kilogram', 'Quilograma'),
  ('m2', 'Mètre carré', 'Square meter', 'Metro quadrado'),
  ('m3', 'Mètre cube', 'Cubic meter', 'Metro cúbico'),
  ('km', 'Kilomètre', 'Kilometer', 'Quilômetro'),
  ('set', 'Lot / Ensemble', 'Set / Lot', 'Conjunto'),
  ('contract', 'Contrat', 'Contract', 'Contrato'),
  ('trip', 'Voyage', 'Trip', 'Viagem'),
  ('person', 'Personne', 'Person', 'Pessoa'),
  ('team', 'Équipe', 'Team', 'Equipe'),
  ('report', 'Rapport', 'Report', 'Relatório'),
  ('training', 'Formation', 'Training', 'Formação'),
  ('box', 'Boîte', 'Box', 'Caixa'),
  ('package', 'Paquet', 'Package', 'Pacote'),
  ('vehicle', 'Véhicule', 'Vehicle', 'Veículo'),
  ('equipment', 'Équipement', 'Equipment', 'Equipamento');

-- ============================================================
-- INDEXES POUR PERFORMANCE
-- ============================================================

CREATE INDEX idx_orgs_parent ON organizations(parent_id);
CREATE INDEX idx_orgs_level ON organizations(level);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_org ON user_roles(organization_id);
CREATE INDEX idx_budgets_org ON budgets(organization_id);
CREATE INDEX idx_budgets_fy ON budgets(fiscal_year_id);
CREATE INDEX idx_budgets_status ON budgets(status);
CREATE INDEX idx_budget_lines_budget ON budget_lines(budget_id);
CREATE INDEX idx_transactions_budget ON budget_transactions(budget_id);
CREATE INDEX idx_transactions_type ON budget_transactions(type);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_interco_fy ON intercompany_transactions(fiscal_year_id);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(from_currency, to_currency, effective_date DESC);

-- ============================================================
-- TRIGGERS : updated_at automatique
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_budget_lines_updated_at BEFORE UPDATE ON budget_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fiscal_years_updated_at BEFORE UPDATE ON fiscal_years FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_engagements_updated_at BEFORE UPDATE ON engagements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_intercompany_updated_at BEFORE UPDATE ON intercompany_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_copil_sessions_updated_at BEFORE UPDATE ON copil_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER : Hash SHA-256 sur audit_log (intégrité immuable)
-- ============================================================

CREATE OR REPLACE FUNCTION generate_audit_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hash = encode(
    digest(
      NEW.user_id::TEXT || NEW.action || NEW.entity_type ||
      COALESCE(NEW.entity_id::TEXT,'') || COALESCE(NEW.before_value::TEXT,'') ||
      COALESCE(NEW.after_value::TEXT,'') || NEW.created_at::TEXT,
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_hash BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION generate_audit_hash();

-- Bloquer UPDATE et DELETE sur audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'Le journal d''audit est immuable'; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ============================================================
-- TRIGGER : Profil auto créé à l'inscription
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Prénom'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nom')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
