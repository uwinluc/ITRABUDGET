-- ============================================================
-- ITRABUDGET - Migration 004: RLS Exécution + Fournisseurs
-- ============================================================

-- credit_openings
CREATE POLICY "credit_select" ON credit_openings FOR SELECT
  USING (is_admin() OR is_holding_level() OR organization_id = ANY(get_user_org_ids()));

CREATE POLICY "credit_insert" ON credit_openings FOR INSERT
  WITH CHECK (is_admin() OR organization_id = ANY(get_user_org_ids()));

-- engagements
CREATE POLICY "engagement_select" ON engagements FOR SELECT
  USING (
    is_admin() OR is_holding_level() OR
    credit_opening_id IN (
      SELECT id FROM credit_openings WHERE organization_id = ANY(get_user_org_ids())
    )
  );

CREATE POLICY "engagement_insert" ON engagements FOR INSERT
  WITH CHECK (
    is_admin() OR
    credit_opening_id IN (
      SELECT id FROM credit_openings WHERE organization_id = ANY(get_user_org_ids())
    )
  );

CREATE POLICY "engagement_update" ON engagements FOR UPDATE
  USING (
    is_admin() OR is_holding_level() OR
    credit_opening_id IN (
      SELECT id FROM credit_openings WHERE organization_id = ANY(get_user_org_ids())
    )
  );

-- liquidations
CREATE POLICY "liquidation_select" ON liquidations FOR SELECT
  USING (
    is_admin() OR is_holding_level() OR
    engagement_id IN (
      SELECT e.id FROM engagements e
      JOIN credit_openings c ON c.id = e.credit_opening_id
      WHERE c.organization_id = ANY(get_user_org_ids())
    )
  );

CREATE POLICY "liquidation_insert" ON liquidations FOR INSERT
  WITH CHECK (
    is_admin() OR
    engagement_id IN (
      SELECT e.id FROM engagements e
      JOIN credit_openings c ON c.id = e.credit_opening_id
      WHERE c.organization_id = ANY(get_user_org_ids())
    )
  );

-- ordonnances
CREATE POLICY "ordonnance_select" ON ordonnances FOR SELECT
  USING (
    is_admin() OR is_holding_level() OR
    liquidation_id IN (
      SELECT l.id FROM liquidations l
      JOIN engagements e ON e.id = l.engagement_id
      JOIN credit_openings c ON c.id = e.credit_opening_id
      WHERE c.organization_id = ANY(get_user_org_ids())
    )
  );

CREATE POLICY "ordonnance_insert" ON ordonnances FOR INSERT
  WITH CHECK (
    is_admin() OR
    liquidation_id IN (
      SELECT l.id FROM liquidations l
      JOIN engagements e ON e.id = l.engagement_id
      JOIN credit_openings c ON c.id = e.credit_opening_id
      WHERE c.organization_id = ANY(get_user_org_ids())
    )
  );

-- payments
CREATE POLICY "payment_select" ON payments FOR SELECT
  USING (
    is_admin() OR is_holding_level() OR
    ordonnance_id IN (
      SELECT o.id FROM ordonnances o
      JOIN liquidations l ON l.id = o.liquidation_id
      JOIN engagements e ON e.id = l.engagement_id
      JOIN credit_openings c ON c.id = e.credit_opening_id
      WHERE c.organization_id = ANY(get_user_org_ids())
    )
  );

CREATE POLICY "payment_insert" ON payments FOR INSERT
  WITH CHECK (
    is_admin() OR is_holding_level() OR
    ordonnance_id IN (
      SELECT o.id FROM ordonnances o
      JOIN liquidations l ON l.id = o.liquidation_id
      JOIN engagements e ON e.id = l.engagement_id
      JOIN credit_openings c ON c.id = e.credit_opening_id
      WHERE c.organization_id = ANY(get_user_org_ids())
    )
  );

-- vendors
CREATE POLICY "vendor_select" ON vendors FOR SELECT
  USING (is_admin() OR is_holding_level() OR organization_id = ANY(get_user_org_ids()));

CREATE POLICY "vendor_insert" ON vendors FOR INSERT
  WITH CHECK (is_admin() OR organization_id = ANY(get_user_org_ids()));

CREATE POLICY "vendor_update" ON vendors FOR UPDATE
  USING (is_admin() OR organization_id = ANY(get_user_org_ids()));
