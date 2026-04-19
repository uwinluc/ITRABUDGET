-- ============================================================
-- ITRABUDGET - Migration 005: RLS Interco + Consolidation + Audit + Notifs
-- ============================================================

-- intercompany_transactions
CREATE POLICY "interco_select" ON intercompany_transactions FOR SELECT
  USING (
    is_admin() OR is_holding_level() OR
    sender_org_id   = ANY(get_user_org_ids()) OR
    receiver_org_id = ANY(get_user_org_ids())
  );

CREATE POLICY "interco_insert" ON intercompany_transactions FOR INSERT
  WITH CHECK (is_admin() OR sender_org_id = ANY(get_user_org_ids()));

CREATE POLICY "interco_update" ON intercompany_transactions FOR UPDATE
  USING (
    is_admin() OR is_holding_level() OR
    sender_org_id   = ANY(get_user_org_ids()) OR
    receiver_org_id = ANY(get_user_org_ids())
  );

-- consolidations
CREATE POLICY "consolidation_select" ON consolidations FOR SELECT
  USING (is_admin() OR is_holding_level());

CREATE POLICY "consolidation_insert" ON consolidations FOR INSERT
  WITH CHECK (is_admin() OR is_holding_level());

CREATE POLICY "consolidation_update" ON consolidations FOR UPDATE
  USING (is_admin() OR is_holding_level());

-- notifications: chaque utilisateur voit uniquement ses notifs
CREATE POLICY "notif_select" ON notifications FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "notif_insert" ON notifications FOR INSERT
  WITH CHECK (is_admin() OR is_holding_level());

CREATE POLICY "notif_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid() OR is_admin());

-- audit_logs: lecture seule pour admin/audit/holding, jamais de modification
CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  USING (is_admin() OR is_holding_level() OR EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
    AND ur.role = 'audit_director' AND ur.is_active = TRUE
  ));

-- delegations
CREATE POLICY "delegation_select" ON delegations FOR SELECT
  USING (delegator_id = auth.uid() OR delegate_id = auth.uid() OR is_admin() OR is_holding_level());

CREATE POLICY "delegation_insert" ON delegations FOR INSERT
  WITH CHECK (delegator_id = auth.uid() OR is_admin() OR is_holding_level());

CREATE POLICY "delegation_update" ON delegations FOR UPDATE
  USING (delegator_id = auth.uid() OR is_admin() OR is_holding_level());
