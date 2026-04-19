-- ============================================================
-- ITRABUDGET - Migration 006: Triggers automatiques d'audit
-- ============================================================

-- Fonction générique d'enregistrement dans audit_logs
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id       UUID;
  v_org_id        UUID;
  v_action        TEXT;
  v_before        JSONB;
  v_after         JSONB;
  v_hash          TEXT;
BEGIN
  -- Récupérer l'utilisateur courant (peut être NULL pour les opérations système)
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Déterminer l'action
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_before := NULL;
    v_after  := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_before := to_jsonb(OLD);
    v_after  := NULL;
  END IF;

  -- Extraire organization_id si disponible dans la ligne
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_org_id := (v_before->>'organization_id')::UUID;
    ELSE
      v_org_id := (v_after->>'organization_id')::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_org_id := NULL;
  END;

  -- Calculer un hash d'intégrité
  v_hash := encode(
    digest(
      COALESCE(v_user_id::TEXT, '') ||
      TG_TABLE_NAME ||
      v_action ||
      COALESCE(v_before::TEXT, '') ||
      COALESCE(v_after::TEXT, '') ||
      NOW()::TEXT,
      'sha256'
    ),
    'hex'
  );

  INSERT INTO audit_logs (
    user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    hash,
    created_at
  ) VALUES (
    v_user_id,
    v_org_id,
    v_action,
    TG_TABLE_NAME,
    COALESCE(
      (CASE WHEN TG_OP = 'DELETE' THEN v_before->>'id' ELSE v_after->>'id' END)::UUID::TEXT,
      NULL
    ),
    v_before,
    v_after,
    v_hash,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ============================================================
-- Attacher le trigger sur les tables critiques
-- ============================================================

-- Budgets
CREATE TRIGGER trg_audit_budgets
  AFTER INSERT OR UPDATE OR DELETE ON budgets
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Lignes budgétaires
CREATE TRIGGER trg_audit_budget_lines
  AFTER INSERT OR UPDATE OR DELETE ON budget_lines
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Organisations
CREATE TRIGGER trg_audit_organizations
  AFTER INSERT OR UPDATE OR DELETE ON organizations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Utilisateurs (profils)
CREATE TRIGGER trg_audit_profiles
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Rôles utilisateurs
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Exercices fiscaux
CREATE TRIGGER trg_audit_fiscal_years
  AFTER INSERT OR UPDATE OR DELETE ON fiscal_years
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Transactions interco
CREATE TRIGGER trg_audit_intercompany
  AFTER INSERT OR UPDATE ON intercompany_transactions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Consolidations
CREATE TRIGGER trg_audit_consolidations
  AFTER INSERT OR UPDATE ON consolidations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Délégations
CREATE TRIGGER trg_audit_delegations
  AFTER INSERT OR UPDATE OR DELETE ON delegations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Sessions COPIL
CREATE TRIGGER trg_audit_copil_sessions
  AFTER INSERT OR UPDATE ON copil_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Votes COPIL
CREATE TRIGGER trg_audit_copil_votes
  AFTER INSERT ON copil_votes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Eléments d'exécution budgétaire
CREATE TRIGGER trg_audit_execution_items
  AFTER INSERT OR UPDATE OR DELETE ON execution_items
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================
-- Fonction helper pour créer des notifications in-app
-- ============================================================

CREATE OR REPLACE FUNCTION fn_notify_user(
  p_user_id   UUID,
  p_title     TEXT,
  p_body      TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id   UUID  DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (user_id, channel, title, body, entity_type, entity_id, is_read, created_at)
  VALUES (p_user_id, 'in_app', p_title, p_body, p_entity_type, p_entity_id::TEXT, FALSE, NOW());
END;
$$;

-- ============================================================
-- Trigger: notifier le receiver lors d'une transaction interco
-- ============================================================

CREATE OR REPLACE FUNCTION fn_notify_interco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_receiver_users RECORD;
BEGIN
  -- Notifier tous les utilisateurs actifs de l'org receiver
  FOR v_receiver_users IN
    SELECT ur.user_id FROM user_roles ur
    WHERE ur.organization_id = NEW.receiver_org_id
      AND ur.is_active = TRUE
      AND ur.role IN ('dg_subsidiary', 'dga_subsidiary', 'admin', 'dg_holding', 'dga_holding')
  LOOP
    PERFORM fn_notify_user(
      v_receiver_users.user_id,
      'Nouvelle transaction interco reçue',
      'Référence: ' || NEW.reference || ' — Montant: ' || NEW.amount::TEXT || ' ' || NEW.currency_code,
      'intercompany_transactions',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_interco_receiver
  AFTER INSERT ON intercompany_transactions
  FOR EACH ROW EXECUTE FUNCTION fn_notify_interco();

-- ============================================================
-- Trigger: notifier le créateur d'un budget lors d'un changement
-- de statut (validation, rejet, etc.)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_notify_budget_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title TEXT;
  v_body  TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'approved' THEN
        v_title := 'Budget approuvé';
        v_body  := 'Votre budget "' || NEW.title || '" a été approuvé.';
      WHEN 'rejected' THEN
        v_title := 'Budget rejeté';
        v_body  := 'Votre budget "' || NEW.title || '" a été rejeté.';
      WHEN 'under_review' THEN
        v_title := 'Budget en révision';
        v_body  := 'Votre budget "' || NEW.title || '" est en cours de révision.';
      WHEN 'locked' THEN
        v_title := 'Budget verrouillé';
        v_body  := 'Votre budget "' || NEW.title || '" a été verrouillé.';
      ELSE
        RETURN NEW;
    END CASE;

    PERFORM fn_notify_user(NEW.created_by, v_title, v_body, 'budgets', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_budget_status
  AFTER UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION fn_notify_budget_status();
