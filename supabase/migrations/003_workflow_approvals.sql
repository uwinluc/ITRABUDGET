-- ============================================================
-- ITRABUDGET - Migration 003: Workflow d'approbation
-- ============================================================

-- Rendre workflow_step_id facultatif (chaîne auto-générée)
ALTER TABLE budget_approvals
  ALTER COLUMN workflow_step_id DROP NOT NULL;

-- Ajouter colonnes pour chaîne dynamique
ALTER TABLE budget_approvals
  ADD COLUMN IF NOT EXISTS step_order   INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS step_label   TEXT,
  ADD COLUMN IF NOT EXISTS required_role user_role,
  ADD COLUMN IF NOT EXISTS approver_org_id UUID REFERENCES organizations(id);

-- Index
CREATE INDEX IF NOT EXISTS idx_budget_approvals_budget   ON budget_approvals(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_approvals_approver ON budget_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_budget_approvals_decision ON budget_approvals(decision);

-- RLS budget_approvals : visible par les approuveurs concernés et holding
CREATE POLICY "approvals_select" ON budget_approvals FOR SELECT
  USING (
    is_admin() OR is_holding_level() OR
    approver_id = auth.uid() OR
    budget_id IN (
      SELECT id FROM budgets WHERE organization_id = ANY(get_user_org_ids())
    )
  );

CREATE POLICY "approvals_insert" ON budget_approvals FOR INSERT
  WITH CHECK (is_admin() OR is_holding_level() OR
    budget_id IN (
      SELECT id FROM budgets WHERE organization_id = ANY(get_user_org_ids())
    )
  );

CREATE POLICY "approvals_update" ON budget_approvals FOR UPDATE
  USING (
    approver_id = auth.uid() OR is_admin() OR is_holding_level()
  );

-- RLS workflow_steps
CREATE POLICY "workflow_steps_select" ON workflow_steps FOR SELECT USING (true);
CREATE POLICY "workflow_steps_insert" ON workflow_steps FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "workflow_steps_update" ON workflow_steps FOR UPDATE USING (is_admin());

-- RLS copil_members
CREATE POLICY "copil_members_select" ON copil_members FOR SELECT USING (true);
CREATE POLICY "copil_members_insert" ON copil_members FOR INSERT
  WITH CHECK (is_admin() OR is_holding_level());
CREATE POLICY "copil_members_update" ON copil_members FOR UPDATE
  USING (is_admin() OR is_holding_level());
CREATE POLICY "copil_members_delete" ON copil_members FOR DELETE
  USING (is_admin() OR is_holding_level());

-- RLS copil_sessions
CREATE POLICY "copil_sessions_select" ON copil_sessions FOR SELECT
  USING (
    is_admin() OR is_holding_level() OR
    organization_id = ANY(get_user_org_ids()) OR
    EXISTS (
      SELECT 1 FROM copil_members cm
      WHERE cm.organization_id = copil_sessions.organization_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "copil_sessions_insert" ON copil_sessions FOR INSERT
  WITH CHECK (
    is_admin() OR is_holding_level() OR
    organization_id = ANY(get_user_org_ids())
  );

CREATE POLICY "copil_sessions_update" ON copil_sessions FOR UPDATE
  USING (
    is_admin() OR is_holding_level() OR
    organization_id = ANY(get_user_org_ids())
  );

-- RLS copil_votes
CREATE POLICY "copil_votes_select" ON copil_votes FOR SELECT
  USING (
    is_admin() OR is_holding_level() OR
    member_id IN (
      SELECT id FROM copil_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "copil_votes_insert" ON copil_votes FOR INSERT
  WITH CHECK (
    member_id IN (
      SELECT id FROM copil_members WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );
