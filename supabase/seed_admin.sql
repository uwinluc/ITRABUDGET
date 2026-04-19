-- ============================================================
-- ITRABUDGET — Profil + Rôle + Données de base
-- UUID admin: adcd0507-f3a9-46c9-8a34-b08a1de2d82e
-- ============================================================

DO $$
DECLARE
  v_admin_id   UUID := 'adcd0507-f3a9-46c9-8a34-b08a1de2d82e';
  v_holding_id UUID := 'b0000000-0000-0000-0000-000000000001';
BEGIN

-- Organisations
INSERT INTO organizations (id, name, code, level, type, parent_id, currency_code, has_copil, is_active)
VALUES (v_holding_id, 'ITRAHUB Holding', 'HOLDING', 'holding', 'holding', NULL, 'USD', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO organizations (id, name, code, level, type, parent_id, country_code, currency_code, has_copil, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000002', 'ITRAHUB RDC',      'ITRB-CD', 'country', 'country', v_holding_id, 'CD', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000003', 'ITRAHUB Cameroun', 'ITRB-CM', 'country', 'country', v_holding_id, 'CM', 'XAF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000004', 'ITRAHUB Kenya',    'ITRB-KE', 'country', 'country', v_holding_id, 'KE', 'KES', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO organizations (id, name, code, level, type, parent_id, country_code, currency_code, has_copil, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000010', 'ITRAHUB Kinshasa Siège', 'ITRB-KIN', 'subsidiary', 'headquarters', 'b0000000-0000-0000-0000-000000000002', 'CD', 'CDF', TRUE,  TRUE),
  ('b0000000-0000-0000-0000-000000000011', 'ITRAHUB Lubumbashi',     'ITRB-LUB', 'subsidiary', 'agency',       'b0000000-0000-0000-0000-000000000002', 'CD', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000012', 'ITRAHUB Douala',         'ITRB-DLA', 'subsidiary', 'headquarters', 'b0000000-0000-0000-0000-000000000003', 'CM', 'XAF', TRUE,  TRUE),
  ('b0000000-0000-0000-0000-000000000013', 'ITRAHUB Nairobi',        'ITRB-NBI', 'subsidiary', 'headquarters', 'b0000000-0000-0000-0000-000000000004', 'KE', 'KES', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO organizations (id, name, code, level, type, parent_id, currency_code, has_copil, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000020', 'Direction Financière',  'ITRB-KIN-FIN', 'direction', 'direction', 'b0000000-0000-0000-0000-000000000010', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000021', 'Direction RH',          'ITRB-KIN-RH',  'direction', 'direction', 'b0000000-0000-0000-0000-000000000010', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000022', 'Direction Commerciale', 'ITRB-KIN-COM', 'direction', 'direction', 'b0000000-0000-0000-0000-000000000010', 'CDF', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO organizations (id, name, code, level, type, parent_id, currency_code, has_copil, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000030', 'Service Comptabilité', 'ITRB-KIN-FIN-CPT', 'service', 'service', 'b0000000-0000-0000-0000-000000000020', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000031', 'Service Trésorerie',   'ITRB-KIN-FIN-TRE', 'service', 'service', 'b0000000-0000-0000-0000-000000000020', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000032', 'Service Paie',         'ITRB-KIN-RH-PAI',  'service', 'service', 'b0000000-0000-0000-0000-000000000021', 'CDF', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Exercice fiscal
INSERT INTO fiscal_years (id, organization_id, code, name, start_date, end_date, status, reference_currency)
VALUES ('c0000000-0000-0000-0000-000000000001', v_holding_id, 'FY2025', 'Exercice 2025', '2025-01-01', '2025-12-31', 'active', 'USD')
ON CONFLICT DO NOTHING;

-- Taux de change
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, fiscal_year_id) VALUES
  ('CDF', 'USD', 0.000347, '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('XAF', 'USD', 0.001613, '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('KES', 'USD', 0.007752, '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('EUR', 'USD', 1.085000, '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('GBP', 'USD', 1.270000, '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('TZS', 'USD', 0.000385, '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('UGX', 'USD', 0.000270, '2025-01-01', 'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (from_currency, to_currency, effective_date) DO NOTHING;

-- Rubriques budgétaires
INSERT INTO budget_rubrics (organization_id, category, code, name_fr, name_en, name_pt, is_active) VALUES
  (NULL, 'operating',  'FONCT-RH',     'Charges de personnel',        'Personnel Costs',        'Custos de pessoal',         TRUE),
  (NULL, 'operating',  'FONCT-LOC',    'Loyers et charges locatives', 'Rent & Occupancy',       'Aluguéis e encargos',       TRUE),
  (NULL, 'operating',  'FONCT-UTIL',   'Services et utilités',        'Utilities & Services',   'Serviços e utilidades',     TRUE),
  (NULL, 'operating',  'FONCT-COMM',   'Frais de communication',      'Communication Costs',    'Custos de comunicação',     TRUE),
  (NULL, 'operating',  'FONCT-TRANSP', 'Frais de transport',          'Transport Costs',        'Custos de transporte',      TRUE),
  (NULL, 'operating',  'FONCT-FORM',   'Formation et développement',  'Training & Development', 'Formação e desenvolvimento', TRUE),
  (NULL, 'investment', 'INVEST-IT',    'Équipements informatiques',   'IT Equipment',           'Equipamentos de TI',        TRUE),
  (NULL, 'investment', 'INVEST-MOB',   'Mobilier et équipements',     'Furniture & Equipment',  'Mobiliário e equipamentos', TRUE),
  (NULL, 'investment', 'INVEST-VEH',   'Véhicules',                   'Vehicles',               'Veículos',                  TRUE),
  (NULL, 'revenue',    'REV-VENTES',   'Revenus des ventes',          'Sales Revenue',          'Receita de vendas',         TRUE),
  (NULL, 'revenue',    'REV-SERV',     'Revenus de services',         'Service Revenue',        'Receita de serviços',       TRUE),
  (NULL, 'project',    'PROJ-INVEST',  'Investissements projets',     'Project Investments',    'Investimentos em projetos', TRUE)
ON CONFLICT DO NOTHING;

-- Profil admin
INSERT INTO profiles (id, first_name, last_name, preferred_language, is_active,
                      two_factor_enabled, notification_email, notification_in_app, notification_sms, theme)
VALUES (v_admin_id, 'Admin', 'ITRABUDGET', 'fr', TRUE, FALSE, TRUE, TRUE, FALSE, 'system')
ON CONFLICT (id) DO UPDATE SET first_name = 'Admin', last_name = 'ITRABUDGET', is_active = TRUE;

-- Rôle admin
INSERT INTO user_roles (user_id, role, organization_id, is_active, valid_from)
VALUES (v_admin_id, 'admin', v_holding_id, TRUE, NOW())
ON CONFLICT (user_id, role, organization_id) DO NOTHING;

RAISE NOTICE 'Seed terminé. Connectez-vous avec admin@itrabudget.com / Admin1234!';

END $$;
