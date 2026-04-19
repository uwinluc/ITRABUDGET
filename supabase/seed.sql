-- ============================================================
-- ITRABUDGET — Seed de démonstration
-- Admin: admin@itrabudget.com / Admin1234!
-- ============================================================

-- ============================================================
-- 1. UTILISATEUR ADMIN (auth.users + profile)
-- ============================================================

DO $$
DECLARE
  v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
  v_holding_id UUID := 'b0000000-0000-0000-0000-000000000001';
BEGIN

-- Insérer dans auth.users (Supabase auth)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud
) VALUES (
  v_admin_id,
  '00000000-0000-0000-0000-000000000000',
  'admin@itrabudget.com',
  crypt('Admin1234!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"first_name":"Admin","last_name":"ITRABUDGET"}',
  FALSE,
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. DEVISES (13 devises groupe)
-- ============================================================

INSERT INTO currencies (code, name_fr, name_en, name_pt, symbol, is_active, is_reference) VALUES
  ('USD', 'Dollar américain',   'US Dollar',          'Dólar americano',    '$',    TRUE,  TRUE),
  ('EUR', 'Euro',               'Euro',               'Euro',               '€',    TRUE,  FALSE),
  ('GBP', 'Livre sterling',     'British Pound',      'Libra esterlina',    '£',    TRUE,  FALSE),
  ('XAF', 'Franc CFA BEAC',    'CFA Franc BEAC',     'Franco CFA BEAC',    'FCFA', TRUE,  FALSE),
  ('XOF', 'Franc CFA BCEAO',   'CFA Franc BCEAO',    'Franco CFA BCEAO',   'FCFA', TRUE,  FALSE),
  ('TZS', 'Shilling tanzanien', 'Tanzanian Shilling', 'Xelim tanzaniano',   'TSh',  TRUE,  FALSE),
  ('KES', 'Shilling kényan',    'Kenyan Shilling',    'Xelim queniano',     'KSh',  TRUE,  FALSE),
  ('UGX', 'Shilling ougandais', 'Ugandan Shilling',   'Xelim ugandês',      'USh',  TRUE,  FALSE),
  ('MZN', 'Metical mozambicain','Mozambican Metical', 'Metical moçambicano','MT',   TRUE,  FALSE),
  ('AOA', 'Kwanza angolais',    'Angolan Kwanza',     'Kwanza angolano',    'Kz',   TRUE,  FALSE),
  ('RWF', 'Franc rwandais',     'Rwandan Franc',      'Franco ruandês',     'RF',   TRUE,  FALSE),
  ('BIF', 'Franc burundais',    'Burundian Franc',    'Franco burundinês',  'FBu',  TRUE,  FALSE),
  ('CDF', 'Franc congolais',    'Congolese Franc',    'Franco congolês',    'FC',   TRUE,  FALSE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 3. HIÉRARCHIE ORGANISATIONNELLE (5 niveaux)
-- ============================================================

-- Holding (Niveau 1)
INSERT INTO organizations (id, name, code, level, type, parent_id, currency_code, has_copil, is_active)
VALUES (v_holding_id, 'ITRAHUB Holding', 'HOLDING', 'holding', 'holding', NULL, 'USD', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Pays (Niveau 2)
INSERT INTO organizations (id, name, code, level, type, parent_id, country_code, currency_code, has_copil, is_active)
VALUES
  ('b0000000-0000-0000-0000-000000000002', 'ITRAHUB RDC',       'ITRB-CD', 'country', 'country', v_holding_id, 'CD', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000003', 'ITRAHUB Cameroun',  'ITRB-CM', 'country', 'country', v_holding_id, 'CM', 'XAF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000004', 'ITRAHUB Kenya',     'ITRB-KE', 'country', 'country', v_holding_id, 'KE', 'KES', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Filiales (Niveau 3)
INSERT INTO organizations (id, name, code, level, type, parent_id, country_code, currency_code, has_copil, is_active)
VALUES
  ('b0000000-0000-0000-0000-000000000010', 'ITRAHUB Kinshasa Siège', 'ITRB-KIN', 'subsidiary', 'headquarters', 'b0000000-0000-0000-0000-000000000002', 'CD', 'CDF', TRUE,  TRUE),
  ('b0000000-0000-0000-0000-000000000011', 'ITRAHUB Lubumbashi',     'ITRB-LUB', 'subsidiary', 'agency',        'b0000000-0000-0000-0000-000000000002', 'CD', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000012', 'ITRAHUB Douala',         'ITRB-DLA', 'subsidiary', 'headquarters',  'b0000000-0000-0000-0000-000000000003', 'CM', 'XAF', TRUE,  TRUE),
  ('b0000000-0000-0000-0000-000000000013', 'ITRAHUB Nairobi',        'ITRB-NBI', 'subsidiary', 'headquarters',  'b0000000-0000-0000-0000-000000000004', 'KE', 'KES', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Directions (Niveau 4)
INSERT INTO organizations (id, name, code, level, type, parent_id, currency_code, has_copil, is_active)
VALUES
  ('b0000000-0000-0000-0000-000000000020', 'Direction Financière',   'ITRB-KIN-FIN', 'direction', 'direction', 'b0000000-0000-0000-0000-000000000010', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000021', 'Direction RH',           'ITRB-KIN-RH',  'direction', 'direction', 'b0000000-0000-0000-0000-000000000010', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000022', 'Direction Commerciale',  'ITRB-KIN-COM', 'direction', 'direction', 'b0000000-0000-0000-0000-000000000010', 'CDF', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Services (Niveau 5)
INSERT INTO organizations (id, name, code, level, type, parent_id, currency_code, has_copil, is_active)
VALUES
  ('b0000000-0000-0000-0000-000000000030', 'Service Comptabilité',   'ITRB-KIN-FIN-CPT', 'service', 'service', 'b0000000-0000-0000-0000-000000000020', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000031', 'Service Trésorerie',     'ITRB-KIN-FIN-TRE', 'service', 'service', 'b0000000-0000-0000-0000-000000000020', 'CDF', FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000032', 'Service Paie',           'ITRB-KIN-RH-PAI',  'service', 'service', 'b0000000-0000-0000-0000-000000000021', 'CDF', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 4. EXERCICE FISCAL
-- ============================================================

INSERT INTO fiscal_years (id, organization_id, code, name, start_date, end_date, status, reference_currency)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  v_holding_id,
  'FY2025',
  'Exercice 2025',
  '2025-01-01',
  '2025-12-31',
  'active',
  'USD'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. PROFIL ADMIN + RÔLE
-- ============================================================

INSERT INTO profiles (id, first_name, last_name, preferred_language, is_active, two_factor_enabled,
                      notification_email, notification_in_app, notification_sms, theme)
VALUES (v_admin_id, 'Admin', 'ITRABUDGET', 'fr', TRUE, FALSE, TRUE, TRUE, FALSE, 'system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role, organization_id, is_active, valid_from)
VALUES (v_admin_id, 'admin', v_holding_id, TRUE, NOW())
ON CONFLICT (user_id, role, organization_id) DO NOTHING;

-- ============================================================
-- 6. UTILISATEURS DEMO SUPPLÉMENTAIRES
-- ============================================================

-- DG Filiale Kinshasa
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud)
VALUES ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'dg@itrabudget.com',
  crypt('Admin1234!', gen_salt('bf')), NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{"first_name":"Jean","last_name":"MUTOMBO"}',
  FALSE, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, first_name, last_name, preferred_language, is_active, two_factor_enabled, notification_email, notification_in_app, notification_sms, theme)
VALUES ('a0000000-0000-0000-0000-000000000002', 'Jean', 'MUTOMBO', 'fr', TRUE, FALSE, TRUE, TRUE, FALSE, 'system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role, organization_id, is_active, valid_from)
VALUES ('a0000000-0000-0000-0000-000000000002', 'dg_subsidiary', 'b0000000-0000-0000-0000-000000000010', TRUE, NOW())
ON CONFLICT (user_id, role, organization_id) DO NOTHING;

-- Directeur Financier
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud)
VALUES ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'fin@itrabudget.com',
  crypt('Admin1234!', gen_salt('bf')), NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{"first_name":"Marie","last_name":"KABILA"}',
  FALSE, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, first_name, last_name, preferred_language, is_active, two_factor_enabled, notification_email, notification_in_app, notification_sms, theme)
VALUES ('a0000000-0000-0000-0000-000000000003', 'Marie', 'KABILA', 'fr', TRUE, FALSE, TRUE, TRUE, FALSE, 'system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role, organization_id, is_active, valid_from)
VALUES ('a0000000-0000-0000-0000-000000000003', 'director', 'b0000000-0000-0000-0000-000000000020', TRUE, NOW())
ON CONFLICT (user_id, role, organization_id) DO NOTHING;

-- Officier de consolidation (Holding)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud)
VALUES ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'consolidation@itrabudget.com',
  crypt('Admin1234!', gen_salt('bf')), NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{"first_name":"Pierre","last_name":"LUMUMBA"}',
  FALSE, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, first_name, last_name, preferred_language, is_active, two_factor_enabled, notification_email, notification_in_app, notification_sms, theme)
VALUES ('a0000000-0000-0000-0000-000000000004', 'Pierre', 'LUMUMBA', 'fr', TRUE, FALSE, TRUE, TRUE, FALSE, 'system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role, organization_id, is_active, valid_from)
VALUES ('a0000000-0000-0000-0000-000000000004', 'consolidation_officer', v_holding_id, TRUE, NOW())
ON CONFLICT (user_id, role, organization_id) DO NOTHING;

-- ============================================================
-- 7. TAUX DE CHANGE (approximatifs avril 2025)
-- ============================================================

INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, fiscal_year_id)
VALUES
  ('CDF', 'USD', 0.000347,  '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('XAF', 'USD', 0.001613,  '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('KES', 'USD', 0.007752,  '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('EUR', 'USD', 1.085000,  '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('GBP', 'USD', 1.270000,  '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('TZS', 'USD', 0.000385,  '2025-01-01', 'c0000000-0000-0000-0000-000000000001'),
  ('UGX', 'USD', 0.000270,  '2025-01-01', 'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (from_currency, to_currency, effective_date) DO NOTHING;

-- ============================================================
-- 8. RUBRIQUES BUDGÉTAIRES de base
-- ============================================================

INSERT INTO budget_rubrics (organization_id, category, code, name_fr, name_en, name_pt, is_active)
VALUES
  (NULL, 'operating',   'FONCT-RH',    'Charges de personnel',       'Personnel Costs',        'Custos de pessoal',       TRUE),
  (NULL, 'operating',   'FONCT-LOC',   'Loyers et charges locatives', 'Rent & Occupancy',      'Aluguéis e encargos',     TRUE),
  (NULL, 'operating',   'FONCT-UTIL',  'Services et utilités',        'Utilities & Services',  'Serviços e utilidades',   TRUE),
  (NULL, 'operating',   'FONCT-COMM',  'Frais de communication',      'Communication Costs',   'Custos de comunicação',   TRUE),
  (NULL, 'operating',   'FONCT-TRANSP','Frais de transport',          'Transport Costs',       'Custos de transporte',    TRUE),
  (NULL, 'operating',   'FONCT-FORM',  'Formation et développement',  'Training & Development','Formação e desenvolvimento',TRUE),
  (NULL, 'investment',  'INVEST-IT',   'Équipements informatiques',   'IT Equipment',          'Equipamentos de TI',      TRUE),
  (NULL, 'investment',  'INVEST-MOB',  'Mobilier et équipements',     'Furniture & Equipment', 'Mobiliário e equipamentos',TRUE),
  (NULL, 'investment',  'INVEST-VEH',  'Véhicules',                   'Vehicles',              'Veículos',                TRUE),
  (NULL, 'revenue',     'REV-VENTES',  'Revenus des ventes',          'Sales Revenue',         'Receita de vendas',       TRUE),
  (NULL, 'revenue',     'REV-SERV',    'Revenus de services',         'Service Revenue',       'Receita de serviços',     TRUE),
  (NULL, 'project',     'PROJ-INVEST', 'Investissements projets',     'Project Investments',   'Investimentos em projetos',TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. UNITÉS BUDGÉTAIRES
-- ============================================================

INSERT INTO budget_units (id, code, name_fr, name_en, name_pt, is_active)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'U',    'Unité',      'Unit',      'Unidade',    TRUE),
  ('d0000000-0000-0000-0000-000000000002', 'KG',   'Kilogramme', 'Kilogram',  'Quilograma', TRUE),
  ('d0000000-0000-0000-0000-000000000003', 'L',    'Litre',      'Litre',     'Litro',      TRUE),
  ('d0000000-0000-0000-0000-000000000004', 'M',    'Mètre',      'Metre',     'Metro',      TRUE),
  ('d0000000-0000-0000-0000-000000000005', 'M2',   'Mètre carré','Square Metre','Metro quadrado',TRUE),
  ('d0000000-0000-0000-0000-000000000006', 'H',    'Heure',      'Hour',      'Hora',       TRUE),
  ('d0000000-0000-0000-0000-000000000007', 'J',    'Jour',       'Day',       'Dia',        TRUE),
  ('d0000000-0000-0000-0000-000000000008', 'MOIS', 'Mois',       'Month',     'Mês',        TRUE),
  ('d0000000-0000-0000-0000-000000000009', 'AN',   'An',         'Year',      'Ano',        TRUE),
  ('d0000000-0000-0000-0000-000000000010', 'FORFAIT','Forfait',  'Flat rate', 'Montante fixo',TRUE)
ON CONFLICT (id) DO NOTHING;

END $$;
