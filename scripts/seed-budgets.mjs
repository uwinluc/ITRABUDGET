/**
 * Seed fictif — module Budgets
 * Usage: node scripts/seed-budgets.mjs
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://szmlfieeqzqafssnojqd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bWxmaWVlcXpxYWZzc25vanFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQyMDc4MywiZXhwIjoyMDkxOTk2NzgzfQ.IXEC6O_AnyS2rNQPNwVmS5ay4AhDGpPqkKqAWYmNQY4',
  { auth: { persistSession: false } }
)

// ── IDs connus du seed ────────────────────────────────────────
const USERS = {
  admin:           'adcd0507-f3a9-46c9-8a34-b08a1de2d82e',
  dg_kinshasa:     'a0000000-0000-0000-0000-000000000002',
  dir_finance:     'a0000000-0000-0000-0000-000000000003',
  consolidation:   'a0000000-0000-0000-0000-000000000004',
}
const ORGS = {
  holding:    'b0000000-0000-0000-0000-000000000001',
  rdc:        'b0000000-0000-0000-0000-000000000002',
  cameroun:   'b0000000-0000-0000-0000-000000000003',
  kenya:      'b0000000-0000-0000-0000-000000000004',
  kinshasa:   'b0000000-0000-0000-0000-000000000010',
  lubumbashi: 'b0000000-0000-0000-0000-000000000011',
  douala:     'b0000000-0000-0000-0000-000000000012',
  nairobi:    'b0000000-0000-0000-0000-000000000013',
  dir_fin:    'b0000000-0000-0000-0000-000000000020',
  dir_rh:     'b0000000-0000-0000-0000-000000000021',
  dir_com:    'b0000000-0000-0000-0000-000000000022',
  svc_cpt:    'b0000000-0000-0000-0000-000000000030',
  svc_tre:    'b0000000-0000-0000-0000-000000000031',
  svc_paie:   'b0000000-0000-0000-0000-000000000032',
}
const FY2025 = 'c0000000-0000-0000-0000-000000000001'
const UNITS = {
  unite:   'd0000000-0000-0000-0000-000000000001',
  mois:    'd0000000-0000-0000-0000-000000000008',
  an:      'd0000000-0000-0000-0000-000000000009',
  forfait: 'd0000000-0000-0000-0000-000000000010',
  jour:    'd0000000-0000-0000-0000-000000000007',
  heure:   'd0000000-0000-0000-0000-000000000006',
}

// ── Helpers ───────────────────────────────────────────────────
async function getRubricId(code) {
  const { data, error } = await supabase
    .from('budget_rubrics')
    .select('id')
    .eq('code', code)
    .limit(1)
  if (error) throw new Error(`Rubric ${code} error: ${error.message}`)
  if (!data || data.length === 0) throw new Error(`Rubric ${code} not found`)
  return data[0].id
}

async function getExchangeRateId(fromCurrency) {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('id')
    .eq('from_currency', fromCurrency)
    .eq('to_currency', 'USD')
    .limit(1)
  if (error || !data || data.length === 0) return null
  return data[0].id
}

function usd(amount, rate) {
  return Math.round(amount * rate * 100) / 100
}

async function insertBudget(budget) {
  const { data, error } = await supabase
    .from('budgets')
    .insert(budget)
    .select('id')
    .single()
  if (error) throw new Error(`Budget insert error: ${error.message}`)
  return data.id
}

async function insertLines(lines) {
  const { error } = await supabase.from('budget_lines').insert(lines)
  if (error) throw new Error(`Lines insert error: ${error.message}`)
}

async function insertTx(transactions) {
  const { error } = await supabase.from('budget_transactions').insert(transactions)
  if (error) throw new Error(`Transactions insert error: ${error.message}`)
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('📦 Récupération des rubriques...')
  const R = {
    rh:      await getRubricId('FONCT-RH'),
    loc:     await getRubricId('FONCT-LOC'),
    util:    await getRubricId('FONCT-UTIL'),
    comm:    await getRubricId('FONCT-COMM'),
    transp:  await getRubricId('FONCT-TRANSP'),
    form:    await getRubricId('FONCT-FORM'),
    it:      await getRubricId('INVEST-IT'),
    mob:     await getRubricId('INVEST-MOB'),
    veh:     await getRubricId('INVEST-VEH'),
    ventes:  await getRubricId('REV-VENTES'),
    services:await getRubricId('REV-SERV'),
    proj:    await getRubricId('PROJ-INVEST'),
  }

  const erCDF = await getExchangeRateId('CDF')
  const erXAF = await getExchangeRateId('XAF')
  const erKES = await getExchangeRateId('KES')
  const rateCDF = 0.000347, rateXAF = 0.001613, rateKES = 0.007752

  // ══════════════════════════════════════════════════
  // 1. Budget Direction Financière — APPROVED (CDF)
  // ══════════════════════════════════════════════════
  console.log('✅ 1/8 Budget Dir. Financière (approved)...')
  const b1 = await insertBudget({
    fiscal_year_id: FY2025,
    organization_id: ORGS.dir_fin,
    title: 'Budget Opérationnel 2025 — Direction Financière',
    status: 'approved',
    submitted_at: '2025-01-15T10:00:00Z',
    created_by: USERS.dir_finance,
    updated_by: USERS.admin,
    created_at: '2025-01-10T08:30:00Z',
  })
  await insertLines([
    { budget_id: b1, rubric_id: R.rh, category: 'operating', title: 'Salaires équipe comptable (4 agents)', paa: 'PAA-FIN-001', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 2400000, price_type: 'htva', vat_rate: 0, currency_code: 'CDF', amount_usd: usd(12*2400000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Rémunération mensuelle de 4 comptables pour assurer la clôture financière et la gestion comptable quotidienne', justification_consequence: 'Sans ce budget, les clôtures mensuelles seraient impossibles et la trésorerie non contrôlée', is_recurring: true, line_number: 1, created_by: USERS.dir_finance },
    { budget_id: b1, rubric_id: R.it, category: 'investment', title: 'Logiciel comptabilité SAGE — licences', paa: 'PAA-FIN-002', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'high', quantity: 4, unit_id: UNITS.unite, unit_price: 850000, price_type: 'htva', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(4*850000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Renouvellement des 4 licences SAGE pour la production des états financiers annuels conformément aux normes OHADA', justification_consequence: 'Risque de non-conformité aux obligations légales de présentation des comptes', is_recurring: false, line_number: 2, created_by: USERS.dir_finance },
    { budget_id: b1, rubric_id: R.form, category: 'operating', title: 'Formation IFRS — 2 collaborateurs', paa: 'PAA-FIN-003', period_start: '2025-03-01', period_end: '2025-03-31', priority: 'medium', quantity: 1, unit_id: UNITS.forfait, unit_price: 1200000, price_type: 'htva', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(1200000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Mise à niveau des compétences sur les normes IFRS adoptées par le groupe pour la consolidation', justification_consequence: 'Décalage avec les standards groupe pouvant invalider la consolidation annuelle', is_recurring: false, line_number: 3, created_by: USERS.dir_finance },
    { budget_id: b1, rubric_id: R.comm, category: 'operating', title: 'Abonnement internet haut débit — Finance', paa: 'PAA-FIN-004', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'high', quantity: 12, unit_id: UNITS.mois, unit_price: 180000, price_type: 'tvac', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(12*180000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Connexion stable nécessaire pour l\'accès aux plateformes bancaires et la transmission des rapports au holding', justification_consequence: 'Interruption des virements bancaires et blocage des reportings groupe', is_recurring: true, line_number: 4, created_by: USERS.dir_finance },
  ])
  await insertTx([
    { budget_id: b1, type: 'creation', to_status: 'draft', performed_by: USERS.dir_finance, organization_id: ORGS.dir_fin, comment: 'Création budget opérationnel 2025', created_at: '2025-01-10T08:30:00Z' },
    { budget_id: b1, type: 'submission', from_status: 'draft', to_status: 'submitted', performed_by: USERS.dir_finance, organization_id: ORGS.dir_fin, comment: 'Soumission pour validation DG', created_at: '2025-01-15T10:00:00Z' },
    { budget_id: b1, type: 'validation', from_status: 'submitted', to_status: 'approved', performed_by: USERS.dg_kinshasa, organization_id: ORGS.kinshasa, comment: 'Budget validé. Conforme aux prévisions du plan stratégique.', created_at: '2025-01-22T14:30:00Z' },
  ])

  // ══════════════════════════════════════════════════
  // 2. Budget Direction RH — SUBMITTED (CDF)
  // ══════════════════════════════════════════════════
  console.log('📤 2/8 Budget Dir. RH (submitted)...')
  const b2 = await insertBudget({
    fiscal_year_id: FY2025,
    organization_id: ORGS.dir_rh,
    title: 'Budget RH & Formation 2025 — Kinshasa',
    status: 'submitted',
    submitted_at: '2025-02-03T09:15:00Z',
    created_by: USERS.admin,
    created_at: '2025-01-28T11:00:00Z',
  })
  await insertLines([
    { budget_id: b2, rubric_id: R.rh, category: 'operating', title: 'Masse salariale mensuelle — 12 agents RH', paa: 'PAA-RH-001', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 4800000, price_type: 'htva', vat_rate: 0, currency_code: 'CDF', amount_usd: usd(12*4800000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Rémunération de l\'ensemble du personnel RH assurant la gestion des 120 collaborateurs du siège', justification_consequence: 'Arrêt immédiat des processus paie et recrutement compromettant l\'opérationnalité du siège', is_recurring: true, line_number: 1, created_by: USERS.admin },
    { budget_id: b2, rubric_id: R.form, category: 'operating', title: 'Programme formation managériale Q1-Q2', paa: 'PAA-RH-002', period_start: '2025-01-15', period_end: '2025-06-30', priority: 'high', quantity: 3, unit_id: UNITS.unite, unit_price: 750000, price_type: 'htva', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(3*750000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Sessions de formation en leadership et gestion d\'équipe pour 3 chefs de service nouvellement nommés', justification_consequence: 'Déficit de compétences managériales entraînant un faible rendement des nouvelles équipes', is_recurring: false, line_number: 2, created_by: USERS.admin },
    { budget_id: b2, rubric_id: R.it, category: 'investment', title: 'Module SIRH — gestion des congés', paa: 'PAA-RH-003', period_start: '2025-04-01', period_end: '2025-09-30', priority: 'medium', quantity: 1, unit_id: UNITS.forfait, unit_price: 2500000, price_type: 'htva', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(2500000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Déploiement du module de gestion automatisée des congés et absences pour éliminer les erreurs manuelles', justification_consequence: 'Maintien d\'un processus manuel chronophage et source d\'erreurs dans les bulletins de paie', is_recurring: false, line_number: 3, created_by: USERS.admin },
    { budget_id: b2, rubric_id: R.transp, category: 'operating', title: 'Transport recrutements — déplacements candidats', paa: 'PAA-RH-004', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'low', quantity: 24, unit_id: UNITS.unite, unit_price: 85000, price_type: 'htva', vat_rate: 0, currency_code: 'CDF', amount_usd: usd(24*85000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Remboursement transport candidats convoqués pour entretiens depuis les communes périphériques de Kinshasa', justification_consequence: 'Perte de candidats qualifiés ne pouvant pas financer leur déplacement', is_recurring: false, line_number: 4, created_by: USERS.admin },
  ])
  await insertTx([
    { budget_id: b2, type: 'creation', to_status: 'draft', performed_by: USERS.admin, organization_id: ORGS.dir_rh, comment: 'Initialisation budget RH 2025', created_at: '2025-01-28T11:00:00Z' },
    { budget_id: b2, type: 'submission', from_status: 'draft', to_status: 'submitted', performed_by: USERS.admin, organization_id: ORGS.dir_rh, comment: 'Prêt pour validation DG Kinshasa', created_at: '2025-02-03T09:15:00Z' },
  ])

  // ══════════════════════════════════════════════════
  // 3. Budget Lubumbashi — DRAFT (CDF)
  // ══════════════════════════════════════════════════
  console.log('📝 3/8 Budget Lubumbashi (draft)...')
  const b3 = await insertBudget({
    fiscal_year_id: FY2025,
    organization_id: ORGS.lubumbashi,
    title: 'Budget Opérationnel 2025 — Agence Lubumbashi',
    status: 'draft',
    created_by: USERS.admin,
    created_at: '2025-02-10T14:00:00Z',
  })
  await insertLines([
    { budget_id: b3, rubric_id: R.loc, category: 'operating', title: 'Loyer bureau Lubumbashi — avenue Kasai', paa: 'PAA-LUB-001', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 3500000, price_type: 'tvac', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(12*3500000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Loyer mensuel du bureau principal de l\'agence de Lubumbashi, contrat ferme jusqu\'en décembre 2025', justification_consequence: 'Résiliation du bail avec perte de notre présence commerciale à Lubumbashi', is_recurring: true, line_number: 1, created_by: USERS.admin },
    { budget_id: b3, rubric_id: R.rh, category: 'operating', title: 'Salaires personnel local — 8 agents', paa: 'PAA-LUB-002', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 2800000, price_type: 'htva', vat_rate: 0, currency_code: 'CDF', amount_usd: usd(12*2800000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Masse salariale mensuelle des 8 agents permanents de l\'agence (commerciaux, techniciens et administration)', justification_consequence: 'Fermeture de facto de l\'agence et perte du portefeuille clients Katanga', is_recurring: true, line_number: 2, created_by: USERS.admin },
    { budget_id: b3, rubric_id: R.veh, category: 'investment', title: 'Véhicule commercial Toyota Hilux', paa: 'PAA-LUB-003', period_start: '2025-06-01', period_end: '2025-06-30', priority: 'high', quantity: 1, unit_id: UNITS.unite, unit_price: 45000000, price_type: 'htva', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(45000000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Remplacement du véhicule actuel (2017) avec 280 000 km, coûts de maintenance dépassant la valeur résiduelle', justification_consequence: 'Arrêt des visites terrain et perte estimée à 30% du chiffre d\'affaires prospection zone minière', is_recurring: false, line_number: 3, created_by: USERS.admin },
    { budget_id: b3, rubric_id: R.util, category: 'operating', title: 'Électricité et groupe électrogène — carburant', paa: 'PAA-LUB-004', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'high', quantity: 12, unit_id: UNITS.mois, unit_price: 650000, price_type: 'htva', vat_rate: 0, currency_code: 'CDF', amount_usd: usd(12*650000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Alimentation électrique via groupe électrogène face aux délestages fréquents de la SNEL à Lubumbashi (14h/jour en moyenne)', justification_consequence: 'Paralysie des équipements informatiques et arrêt du service client en heures de travail', is_recurring: true, line_number: 4, created_by: USERS.admin },
  ])
  await insertTx([
    { budget_id: b3, type: 'creation', to_status: 'draft', performed_by: USERS.admin, organization_id: ORGS.lubumbashi, comment: 'Début de saisie budget agence 2025', created_at: '2025-02-10T14:00:00Z' },
  ])

  // ══════════════════════════════════════════════════
  // 4. Budget Douala — UNDER_REVIEW (XAF)
  // ══════════════════════════════════════════════════
  console.log('🔍 4/8 Budget Douala (under_review)...')
  const b4 = await insertBudget({
    fiscal_year_id: FY2025,
    organization_id: ORGS.douala,
    title: 'Budget Prévisionnel 2025 — ITRAHUB Douala',
    status: 'under_review',
    submitted_at: '2025-01-20T08:00:00Z',
    created_by: USERS.admin,
    updated_by: USERS.admin,
    created_at: '2025-01-12T09:00:00Z',
  })
  await insertLines([
    { budget_id: b4, rubric_id: R.rh, category: 'operating', title: 'Salaires équipe Douala (10 collaborateurs)', paa: 'PAA-DLA-001', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 4500000, price_type: 'htva', vat_rate: 0, currency_code: 'XAF', amount_usd: usd(12*4500000, rateXAF), exchange_rate_id: erXAF, justification_why: 'Masse salariale des 10 employés permanents du bureau Douala incluant charges patronales CNPS', justification_consequence: 'Impossibilité légale d\'exploiter sans satisfaire aux obligations salariales', is_recurring: true, line_number: 1, created_by: USERS.admin },
    { budget_id: b4, rubric_id: R.loc, category: 'operating', title: 'Loyer bureau Akwa — Douala', paa: 'PAA-DLA-002', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 1800000, price_type: 'tvac', vat_rate: 19.25, currency_code: 'XAF', amount_usd: usd(12*1800000, rateXAF), exchange_rate_id: erXAF, justification_why: 'Bail commercial du bureau principal dans le quartier Akwa, zone économique centrale de Douala', justification_consequence: 'Expulsion et perte de l\'adresse fiscale déclarée à la DGI Cameroun', is_recurring: true, line_number: 2, created_by: USERS.admin },
    { budget_id: b4, rubric_id: R.it, category: 'investment', title: 'Serveur local + NAS backup', paa: 'PAA-DLA-003', period_start: '2025-03-01', period_end: '2025-04-30', priority: 'high', quantity: 1, unit_id: UNITS.forfait, unit_price: 6500000, price_type: 'htva', vat_rate: 19.25, currency_code: 'XAF', amount_usd: usd(6500000, rateXAF), exchange_rate_id: erXAF, justification_why: 'Infrastructure serveur locale pour sécuriser les données clients et assurer la continuité d\'activité lors des coupures internet', justification_consequence: 'Perte de données critiques en cas de défaillance et non-conformité à la loi camerounaise sur la protection des données', is_recurring: false, line_number: 3, created_by: USERS.admin },
    { budget_id: b4, rubric_id: R.transp, category: 'operating', title: 'Carburant flotte véhicules (3 véhicules)', paa: 'PAA-DLA-004', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'medium', quantity: 12, unit_id: UNITS.mois, unit_price: 480000, price_type: 'htva', vat_rate: 0, currency_code: 'XAF', amount_usd: usd(12*480000, rateXAF), exchange_rate_id: erXAF, justification_why: 'Dotation mensuelle carburant pour les 3 véhicules de service affectés aux déplacements commerciaux et logistiques', justification_consequence: 'Arrêt des visites clients et livraisons, impact direct sur le chiffre d\'affaires', is_recurring: true, line_number: 4, created_by: USERS.admin },
    { budget_id: b4, rubric_id: R.form, category: 'operating', title: 'Formation vente — techniques de négociation', paa: 'PAA-DLA-005', period_start: '2025-05-01', period_end: '2025-05-31', priority: 'medium', quantity: 6, unit_id: UNITS.unite, unit_price: 350000, price_type: 'htva', vat_rate: 19.25, currency_code: 'XAF', amount_usd: usd(6*350000, rateXAF), exchange_rate_id: erXAF, justification_why: 'Formation de 6 commerciaux aux techniques de négociation avancée pour améliorer le taux de conversion des prospects', justification_consequence: 'Maintien d\'un taux de transformation commercial de 18% en dessous de la cible groupe de 28%', is_recurring: false, line_number: 5, created_by: USERS.admin },
  ])
  await insertTx([
    { budget_id: b4, type: 'creation', to_status: 'draft', performed_by: USERS.admin, organization_id: ORGS.douala, comment: 'Budget Douala initialisé', created_at: '2025-01-12T09:00:00Z' },
    { budget_id: b4, type: 'submission', from_status: 'draft', to_status: 'submitted', performed_by: USERS.admin, organization_id: ORGS.douala, comment: 'Soumission pour revue Cameroun', created_at: '2025-01-20T08:00:00Z' },
    { budget_id: b4, type: 'validation', from_status: 'submitted', to_status: 'under_review', performed_by: USERS.admin, organization_id: ORGS.cameroun, comment: 'En cours d\'examen — demande de justificatifs supplémentaires pour ligne serveur', created_at: '2025-01-25T16:00:00Z' },
  ])

  // ══════════════════════════════════════════════════
  // 5. Budget Nairobi — LOCKED (KES)
  // ══════════════════════════════════════════════════
  console.log('🔒 5/8 Budget Nairobi (locked)...')
  const b5 = await insertBudget({
    fiscal_year_id: FY2025,
    organization_id: ORGS.nairobi,
    title: 'Annual Budget 2025 — ITRAHUB Nairobi',
    status: 'locked',
    submitted_at: '2024-12-10T07:00:00Z',
    locked_at: '2025-01-05T12:00:00Z',
    created_by: USERS.admin,
    updated_by: USERS.admin,
    created_at: '2024-12-02T08:00:00Z',
  })
  await insertLines([
    { budget_id: b5, rubric_id: R.rh, category: 'operating', title: 'Staff salaries — 7 permanent employees', paa: 'PAA-NBI-001', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 420000, price_type: 'htva', vat_rate: 0, currency_code: 'KES', amount_usd: usd(12*420000, rateKES), exchange_rate_id: erKES, justification_why: 'Monthly payroll for 7 permanent staff covering operations, sales and administration in Nairobi office', justification_consequence: 'Legal non-compliance and immediate cessation of all operations', is_recurring: true, line_number: 1, created_by: USERS.admin },
    { budget_id: b5, rubric_id: R.loc, category: 'operating', title: 'Office rent — Westlands Business Park', paa: 'PAA-NBI-002', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 180000, price_type: 'tvac', vat_rate: 16, currency_code: 'KES', amount_usd: usd(12*180000, rateKES), exchange_rate_id: erKES, justification_why: 'Prime office space in Westlands, Nairobi\'s financial district, essential for client meetings and regulatory compliance', justification_consequence: 'Loss of professional address and inability to host client delegations', is_recurring: true, line_number: 2, created_by: USERS.admin },
    { budget_id: b5, rubric_id: R.mob, category: 'investment', title: 'Office furniture — new floor fit-out', paa: 'PAA-NBI-003', period_start: '2025-02-01', period_end: '2025-03-31', priority: 'medium', quantity: 1, unit_id: UNITS.forfait, unit_price: 1850000, price_type: 'htva', vat_rate: 16, currency_code: 'KES', amount_usd: usd(1850000, rateKES), exchange_rate_id: erKES, justification_why: 'Fit-out of new floor (additional 120m²) rented to accommodate 5 new hires planned for Q2 2025', justification_consequence: 'New hires cannot be onboarded without adequate workspace', is_recurring: false, line_number: 3, created_by: USERS.admin },
    { budget_id: b5, rubric_id: R.comm, category: 'operating', title: 'Safaricom fiber + mobile data bundle', paa: 'PAA-NBI-004', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'high', quantity: 12, unit_id: UNITS.mois, unit_price: 45000, price_type: 'tvac', vat_rate: 16, currency_code: 'KES', amount_usd: usd(12*45000, rateKES), exchange_rate_id: erKES, justification_why: 'Reliable high-speed connectivity for video conferencing with Kinshasa HQ and cloud platform access', justification_consequence: 'Disruption of daily reporting and inability to access ERP system hosted in Kinshasa', is_recurring: true, line_number: 4, created_by: USERS.admin },
    { budget_id: b5, rubric_id: R.ventes, category: 'revenue', title: 'Projections revenus services B2B — Kenya', paa: 'PAA-NBI-005', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'high', quantity: 12, unit_id: UNITS.mois, unit_price: 900000, price_type: 'htva', vat_rate: 0, currency_code: 'KES', amount_usd: usd(12*900000, rateKES), exchange_rate_id: erKES, justification_why: 'Revenu mensuel moyen projeté basé sur 8 contrats clients actifs et un pipeline de 4 nouvelles opportunités', justification_consequence: 'Sous-financement du budget opérationnel si les projections ne sont pas validées', is_recurring: true, line_number: 5, created_by: USERS.admin },
  ])
  await insertTx([
    { budget_id: b5, type: 'creation', to_status: 'draft', performed_by: USERS.admin, organization_id: ORGS.nairobi, comment: 'FY2025 budget initialized', created_at: '2024-12-02T08:00:00Z' },
    { budget_id: b5, type: 'submission', from_status: 'draft', to_status: 'submitted', performed_by: USERS.admin, organization_id: ORGS.nairobi, comment: 'Submitted for Kenya country review', created_at: '2024-12-10T07:00:00Z' },
    { budget_id: b5, type: 'validation', from_status: 'submitted', to_status: 'approved', performed_by: USERS.admin, organization_id: ORGS.kenya, comment: 'Approved at country level. Solid revenue projections.', created_at: '2024-12-18T11:00:00Z' },
    { budget_id: b5, type: 'locking', from_status: 'approved', to_status: 'locked', performed_by: USERS.consolidation, organization_id: ORGS.holding, comment: 'Budget verrouillé pour transmission au holding', created_at: '2025-01-05T12:00:00Z' },
  ])

  // ══════════════════════════════════════════════════
  // 6. Budget Direction Commerciale — REJECTED (CDF)
  // ══════════════════════════════════════════════════
  console.log('❌ 6/8 Budget Dir. Commerciale (rejected)...')
  const b6 = await insertBudget({
    fiscal_year_id: FY2025,
    organization_id: ORGS.dir_com,
    title: 'Budget Commercial & Marketing 2025',
    status: 'rejected',
    submitted_at: '2025-01-18T10:30:00Z',
    created_by: USERS.admin,
    updated_by: USERS.dg_kinshasa,
    created_at: '2025-01-14T09:00:00Z',
  })
  await insertLines([
    { budget_id: b6, rubric_id: R.rh, category: 'operating', title: 'Salaires équipe commerciale (6 agents)', paa: 'PAA-COM-001', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 2100000, price_type: 'htva', vat_rate: 0, currency_code: 'CDF', amount_usd: usd(12*2100000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Masse salariale de l\'équipe commerciale terrain assurant la prospection et le suivi des 45 comptes clients actifs', justification_consequence: 'Perte du portefeuille client et baisse du chiffre d\'affaires de 60% en moins de 3 mois', is_recurring: true, line_number: 1, created_by: USERS.admin },
    { budget_id: b6, rubric_id: R.transp, category: 'operating', title: 'Budget déplacement commercial — national', paa: 'PAA-COM-002', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'high', quantity: 12, unit_id: UNITS.mois, unit_price: 1200000, price_type: 'htva', vat_rate: 0, currency_code: 'CDF', amount_usd: usd(12*1200000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Couverture des frais de mission pour les visites clients en province (Matadi, Mbuji-Mayi, Kananga)', justification_consequence: 'Réduction à zéro de la prospection hors Kinshasa, perte de part de marché provincial', is_recurring: true, line_number: 2, created_by: USERS.admin },
    { budget_id: b6, rubric_id: R.comm, category: 'operating', title: 'Campagne publicitaire digitale — Q2 2025', paa: 'PAA-COM-003', period_start: '2025-04-01', period_end: '2025-06-30', priority: 'medium', quantity: 1, unit_id: UNITS.forfait, unit_price: 8500000, price_type: 'htva', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(8500000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Campagne Google Ads + réseaux sociaux pour le lancement de la nouvelle offre de services financiers digitaux', justification_consequence: 'Lancement sans visibilité avec risque d\'échec commercial du nouveau produit', is_recurring: false, line_number: 3, created_by: USERS.admin },
  ])
  await insertTx([
    { budget_id: b6, type: 'creation', to_status: 'draft', performed_by: USERS.admin, organization_id: ORGS.dir_com, comment: 'Budget commercial 2025 créé', created_at: '2025-01-14T09:00:00Z' },
    { budget_id: b6, type: 'submission', from_status: 'draft', to_status: 'submitted', performed_by: USERS.admin, organization_id: ORGS.dir_com, comment: 'Soumis pour approbation', created_at: '2025-01-18T10:30:00Z' },
    { budget_id: b6, type: 'rejection', from_status: 'submitted', to_status: 'rejected', performed_by: USERS.dg_kinshasa, organization_id: ORGS.kinshasa, comment: 'Rejeté — budget marketing Q2 surévalué. Réviser à la baisse de 40% et justifier le ROI attendu avec indicateurs mesurables.', created_at: '2025-01-28T15:45:00Z' },
  ])

  // ══════════════════════════════════════════════════
  // 7. Budget Service Comptabilité — DRAFT (CDF)
  // ══════════════════════════════════════════════════
  console.log('📝 7/8 Budget Service Comptabilité (draft)...')
  const b7 = await insertBudget({
    fiscal_year_id: FY2025,
    organization_id: ORGS.svc_cpt,
    title: 'Budget Service Comptabilité 2025',
    status: 'draft',
    created_by: USERS.dir_finance,
    created_at: '2025-02-15T10:00:00Z',
  })
  await insertLines([
    { budget_id: b7, rubric_id: R.rh, category: 'operating', title: 'Salaires comptables (3 agents)', paa: 'PAA-CPT-001', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 900000, price_type: 'htva', vat_rate: 0, currency_code: 'CDF', amount_usd: usd(12*900000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Rémunération mensuelle des 3 comptables du service pour la saisie et le contrôle des pièces comptables quotidiennes', justification_consequence: 'Arriéré comptable compromettant les obligations déclaratives DGI (TVA, IS)', is_recurring: true, line_number: 1, created_by: USERS.dir_finance },
    { budget_id: b7, rubric_id: R.it, category: 'investment', title: 'Matériel de bureau — ordinateurs portables', paa: 'PAA-CPT-002', period_start: '2025-03-01', period_end: '2025-03-31', priority: 'medium', quantity: 3, unit_id: UNITS.unite, unit_price: 1200000, price_type: 'htva', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(3*1200000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Remplacement des 3 ordinateurs obsolètes (2018) ne supportant plus la version actuelle de SAGE Comptabilité', justification_consequence: 'Ralentissement critique des traitements comptables lors des clôtures mensuelles', is_recurring: false, line_number: 2, created_by: USERS.dir_finance },
    { budget_id: b7, rubric_id: R.form, category: 'operating', title: 'Atelier fiscalité OHADA — 3 comptables', paa: 'PAA-CPT-003', period_start: '2025-07-01', period_end: '2025-07-31', priority: 'medium', quantity: 3, unit_id: UNITS.unite, unit_price: 350000, price_type: 'htva', vat_rate: 0, currency_code: 'CDF', amount_usd: usd(3*350000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Mise à niveau sur les nouvelles dispositions fiscales DGI 2025 et les révisions du droit comptable OHADA', justification_consequence: 'Risque d\'erreurs déclaratives entraînant des pénalités fiscales', is_recurring: false, line_number: 3, created_by: USERS.dir_finance },
  ])
  await insertTx([
    { budget_id: b7, type: 'creation', to_status: 'draft', performed_by: USERS.dir_finance, organization_id: ORGS.svc_cpt, comment: 'Budget comptabilité 2025 en cours', created_at: '2025-02-15T10:00:00Z' },
  ])

  // ══════════════════════════════════════════════════
  // 8. Budget Kinshasa Siège (global) — TRANSMITTED (CDF)
  // ══════════════════════════════════════════════════
  console.log('📡 8/8 Budget Kinshasa Siège (transmitted)...')
  const b8 = await insertBudget({
    fiscal_year_id: FY2025,
    organization_id: ORGS.kinshasa,
    title: 'Budget Consolidé Siège 2025 — ITRAHUB Kinshasa',
    status: 'transmitted',
    submitted_at: '2024-12-05T08:00:00Z',
    locked_at: '2024-12-20T14:00:00Z',
    transmitted_at: '2025-01-08T09:00:00Z',
    created_by: USERS.dg_kinshasa,
    updated_by: USERS.consolidation,
    created_at: '2024-11-25T10:00:00Z',
  })
  await insertLines([
    { budget_id: b8, rubric_id: R.rh, category: 'operating', title: 'Masse salariale globale siège — 45 agents', paa: 'PAA-KIN-001', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 18500000, price_type: 'htva', vat_rate: 0, currency_code: 'CDF', amount_usd: usd(12*18500000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Masse salariale consolidée du siège incluant DG, directions et services support (45 ETP)', justification_consequence: 'Cessation d\'activité totale du siège social du groupe en RDC', is_recurring: true, line_number: 1, created_by: USERS.dg_kinshasa },
    { budget_id: b8, rubric_id: R.loc, category: 'operating', title: 'Loyer immeuble siège — Gombe, Kinshasa', paa: 'PAA-KIN-002', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'critical', quantity: 12, unit_id: UNITS.mois, unit_price: 12000000, price_type: 'tvac', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(12*12000000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Bail du bâtiment abritant le siège social (3 étages, 800m²) dans la commune de la Gombe', justification_consequence: 'Perte du siège social avec impact réglementaire et commercial majeur', is_recurring: true, line_number: 2, created_by: USERS.dg_kinshasa },
    { budget_id: b8, rubric_id: R.it, category: 'investment', title: 'Upgrade infrastructure IT — cloud hybride', paa: 'PAA-KIN-003', period_start: '2025-04-01', period_end: '2025-09-30', priority: 'high', quantity: 1, unit_id: UNITS.forfait, unit_price: 85000000, price_type: 'htva', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(85000000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Migration vers une architecture cloud hybride (AWS + infrastructure locale) pour améliorer la résilience et réduire les coûts de maintenance à 3 ans', justification_consequence: 'Risque croissant de panne critique avec l\'infrastructure vieillissante (MTTR actuel : 6h)', is_recurring: false, line_number: 3, created_by: USERS.dg_kinshasa },
    { budget_id: b8, rubric_id: R.proj, category: 'project', title: 'Projet digitalisation guichets — Phase 2', paa: 'PAA-KIN-004', period_start: '2025-07-01', period_end: '2025-12-31', priority: 'high', quantity: 1, unit_id: UNITS.forfait, unit_price: 120000000, price_type: 'htva', vat_rate: 16, currency_code: 'CDF', amount_usd: usd(120000000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Phase 2 du projet de digitalisation des points de service incluant tablettes, scanners et logiciel de gestion clientèle', justification_consequence: 'Perte de l\'avantage concurrentiel digital face à l\'entrée de nouveaux acteurs fintech', is_recurring: false, line_number: 4, created_by: USERS.dg_kinshasa },
    { budget_id: b8, rubric_id: R.services, category: 'revenue', title: 'Revenus consolidés prestations groupe 2025', paa: 'PAA-KIN-005', period_start: '2025-01-01', period_end: '2025-12-31', priority: 'high', quantity: 12, unit_id: UNITS.mois, unit_price: 45000000, price_type: 'htva', vat_rate: 0, currency_code: 'CDF', amount_usd: usd(12*45000000, rateCDF), exchange_rate_id: erCDF, justification_why: 'Projection des revenus de refacturation des services partagés (IT, RH, Finance, Legal) aux filiales du groupe en RDC', justification_consequence: 'Déséquilibre du bilan consolidé groupe si les refacturations intercompanies ne sont pas budgétisées', is_recurring: true, line_number: 5, created_by: USERS.dg_kinshasa },
  ])
  await insertTx([
    { budget_id: b8, type: 'creation', to_status: 'draft', performed_by: USERS.dg_kinshasa, organization_id: ORGS.kinshasa, comment: 'Budget siège FY2025 initialisé', created_at: '2024-11-25T10:00:00Z' },
    { budget_id: b8, type: 'submission', from_status: 'draft', to_status: 'submitted', performed_by: USERS.dg_kinshasa, organization_id: ORGS.kinshasa, comment: 'Soumission officielle budget consolidé siège', created_at: '2024-12-05T08:00:00Z' },
    { budget_id: b8, type: 'validation', from_status: 'submitted', to_status: 'approved', performed_by: USERS.admin, organization_id: ORGS.rdc, comment: 'Approuvé au niveau pays RDC. Budget solide.', created_at: '2024-12-12T10:00:00Z' },
    { budget_id: b8, type: 'locking', from_status: 'approved', to_status: 'locked', performed_by: USERS.consolidation, organization_id: ORGS.holding, comment: 'Verrouillage pour consolidation holding', created_at: '2024-12-20T14:00:00Z' },
    { budget_id: b8, type: 'transmission', from_status: 'locked', to_status: 'transmitted', performed_by: USERS.consolidation, organization_id: ORGS.holding, comment: 'Transmis au holding pour consolidation annuelle FY2025', created_at: '2025-01-08T09:00:00Z' },
  ])

  console.log('\n✅ Seed budgets terminé avec succès — 8 budgets insérés.')
}

main().catch(err => {
  console.error('❌ Erreur:', err.message)
  process.exit(1)
})
