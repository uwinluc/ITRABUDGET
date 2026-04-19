-- ============================================================
-- ITRABUDGET - Row Level Security (RLS) Policies
-- ============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE copil_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE copil_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE copil_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordonnances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE intercompany_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Fonctions helpers pour les policies
-- ============================================================

-- Vérifie si l'utilisateur courant est admin système
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
    AND ur.is_active = TRUE
    AND (ur.valid_until IS NULL OR ur.valid_until > NOW())
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Vérifie si l'utilisateur a un rôle au niveau Holding
CREATE OR REPLACE FUNCTION is_holding_level()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN organizations o ON o.id = ur.organization_id
    WHERE ur.user_id = auth.uid()
    AND o.level = 'holding'
    AND ur.is_active = TRUE
    AND (ur.valid_until IS NULL OR ur.valid_until > NOW())
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Vérifie si l'utilisateur est Directeur d'audit (accès lecture totale)
CREATE OR REPLACE FUNCTION is_audit_director()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'audit_director'
    AND ur.is_active = TRUE
    AND (ur.valid_until IS NULL OR ur.valid_until > NOW())
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Retourne les IDs des organisations accessibles à l'utilisateur courant
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(DISTINCT organization_id)
  FROM user_roles
  WHERE user_id = auth.uid()
  AND is_active = TRUE
  AND (valid_until IS NULL OR valid_until > NOW());
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- POLICIES : organizations
-- ============================================================

-- Tout utilisateur authentifié peut voir les organisations
CREATE POLICY "orgs_select" ON organizations
  FOR SELECT TO authenticated
  USING (TRUE);

-- Seuls admin et holding peuvent créer/modifier des organisations
CREATE POLICY "orgs_insert" ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_holding_level());

CREATE POLICY "orgs_update" ON organizations
  FOR UPDATE TO authenticated
  USING (is_admin() OR is_holding_level());

-- ============================================================
-- POLICIES : profiles
-- ============================================================

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin() OR is_holding_level() OR is_audit_director());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR is_admin());

-- ============================================================
-- POLICIES : user_roles
-- ============================================================

CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin() OR is_holding_level());

CREATE POLICY "user_roles_insert" ON user_roles
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_holding_level());

CREATE POLICY "user_roles_update" ON user_roles
  FOR UPDATE TO authenticated
  USING (is_admin() OR is_holding_level());

-- ============================================================
-- POLICIES : currencies / exchange_rates / budget_units (lecture tous)
-- ============================================================

CREATE POLICY "currencies_select" ON currencies FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "currencies_manage" ON currencies FOR ALL TO authenticated USING (is_admin() OR is_holding_level());

CREATE POLICY "exchange_rates_select" ON exchange_rates FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "exchange_rates_manage" ON exchange_rates FOR ALL TO authenticated
  USING (is_admin() OR is_holding_level());

CREATE POLICY "budget_units_select" ON budget_units FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "budget_units_manage" ON budget_units FOR ALL TO authenticated USING (is_admin() OR is_holding_level());

CREATE POLICY "budget_rubrics_select" ON budget_rubrics FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "budget_rubrics_manage" ON budget_rubrics FOR ALL TO authenticated
  USING (is_admin() OR is_holding_level());

-- ============================================================
-- POLICIES : fiscal_years
-- ============================================================

CREATE POLICY "fy_select" ON fiscal_years
  FOR SELECT TO authenticated
  USING (organization_id = ANY(get_user_org_ids()) OR is_holding_level() OR is_audit_director());

CREATE POLICY "fy_manage" ON fiscal_years
  FOR ALL TO authenticated
  USING (is_admin() OR is_holding_level());

-- ============================================================
-- POLICIES : budgets
-- ============================================================

CREATE POLICY "budgets_select" ON budgets
  FOR SELECT TO authenticated
  USING (
    organization_id = ANY(get_user_org_ids())
    OR is_holding_level()
    OR is_audit_director()
  );

CREATE POLICY "budgets_insert" ON budgets
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "budgets_update" ON budgets
  FOR UPDATE TO authenticated
  USING (
    organization_id = ANY(get_user_org_ids())
    OR is_holding_level()
  );

-- ============================================================
-- POLICIES : budget_lines
-- ============================================================

CREATE POLICY "budget_lines_select" ON budget_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budgets b
      WHERE b.id = budget_id
      AND (b.organization_id = ANY(get_user_org_ids()) OR is_holding_level() OR is_audit_director())
    )
  );

CREATE POLICY "budget_lines_insert" ON budget_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets b
      WHERE b.id = budget_id
      AND b.organization_id = ANY(get_user_org_ids())
      AND b.status IN ('draft', 'under_review')
    )
  );

-- ============================================================
-- POLICIES : budget_transactions (lecture seule pour non-admin)
-- ============================================================

CREATE POLICY "transactions_select" ON budget_transactions
  FOR SELECT TO authenticated
  USING (
    organization_id = ANY(get_user_org_ids())
    OR is_holding_level()
    OR is_audit_director()
  );

CREATE POLICY "transactions_insert" ON budget_transactions
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY(get_user_org_ids()) OR is_holding_level());

-- Bloquer UPDATE/DELETE sur transactions (immuable via RLS)
CREATE POLICY "transactions_no_update" ON budget_transactions
  FOR UPDATE TO authenticated
  USING (FALSE);

CREATE POLICY "transactions_no_delete" ON budget_transactions
  FOR DELETE TO authenticated
  USING (FALSE);

-- ============================================================
-- POLICIES : audit_logs (lecture audit_director + holding + admin)
-- ============================================================

CREATE POLICY "audit_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (is_admin() OR is_holding_level() OR is_audit_director());

CREATE POLICY "audit_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- Bloquer toute modification
CREATE POLICY "audit_no_update" ON audit_logs FOR UPDATE TO authenticated USING (FALSE);
CREATE POLICY "audit_no_delete" ON audit_logs FOR DELETE TO authenticated USING (FALSE);

-- ============================================================
-- POLICIES : notifications (utilisateur voit les siennes)
-- ============================================================

CREATE POLICY "notif_select" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "notif_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notif_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- ============================================================
-- POLICIES : intercompany_transactions
-- ============================================================

CREATE POLICY "interco_select" ON intercompany_transactions
  FOR SELECT TO authenticated
  USING (
    sender_org_id = ANY(get_user_org_ids())
    OR receiver_org_id = ANY(get_user_org_ids())
    OR is_holding_level()
    OR is_audit_director()
  );

CREATE POLICY "interco_insert" ON intercompany_transactions
  FOR INSERT TO authenticated
  WITH CHECK (sender_org_id = ANY(get_user_org_ids()));

CREATE POLICY "interco_update" ON intercompany_transactions
  FOR UPDATE TO authenticated
  USING (
    sender_org_id = ANY(get_user_org_ids())
    OR receiver_org_id = ANY(get_user_org_ids())
    OR is_holding_level()
  );

-- ============================================================
-- POLICIES : execution (engagements, liquidations, etc.)
-- ============================================================

CREATE POLICY "vendors_select" ON vendors
  FOR SELECT TO authenticated
  USING (organization_id = ANY(get_user_org_ids()) OR is_holding_level());

CREATE POLICY "vendors_manage" ON vendors
  FOR ALL TO authenticated
  USING (organization_id = ANY(get_user_org_ids()) OR is_admin());

CREATE POLICY "engagements_select" ON engagements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM credit_openings co
      WHERE co.id = credit_opening_id
      AND (co.organization_id = ANY(get_user_org_ids()) OR is_holding_level() OR is_audit_director())
    )
  );

CREATE POLICY "credit_openings_select" ON credit_openings
  FOR SELECT TO authenticated
  USING (organization_id = ANY(get_user_org_ids()) OR is_holding_level() OR is_audit_director());

-- COPIL policies
CREATE POLICY "copil_members_select" ON copil_members
  FOR SELECT TO authenticated
  USING (organization_id = ANY(get_user_org_ids()) OR is_holding_level());

CREATE POLICY "copil_sessions_select" ON copil_sessions
  FOR SELECT TO authenticated
  USING (organization_id = ANY(get_user_org_ids()) OR is_holding_level() OR is_audit_director());

CREATE POLICY "copil_votes_select" ON copil_votes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM copil_sessions cs
      WHERE cs.id = session_id
      AND (cs.organization_id = ANY(get_user_org_ids()) OR is_holding_level() OR is_audit_director())
    )
  );

CREATE POLICY "consolidations_select" ON consolidations
  FOR SELECT TO authenticated
  USING (is_holding_level() OR is_audit_director() OR is_admin());

CREATE POLICY "consolidations_manage" ON consolidations
  FOR ALL TO authenticated
  USING (is_holding_level() OR is_admin());

-- Attachments
CREATE POLICY "attachments_select" ON attachments
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() OR is_admin() OR is_holding_level() OR is_audit_director());

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
