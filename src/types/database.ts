export type OrgLevel = 'holding' | 'country' | 'subsidiary' | 'direction' | 'service'
export type OrgType = 'holding' | 'country' | 'headquarters' | 'agency' | 'extension' | 'direction' | 'service'
export type UserRole =
  | 'admin'
  | 'dg_holding' | 'dga_holding' | 'consolidation_officer' | 'legal_officer' | 'audit_director'
  | 'dg_subsidiary' | 'dga_subsidiary' | 'director' | 'service_chief'
  | 'copil_president' | 'copil_member'

export type BudgetStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'locked' | 'transmitted' | 'consolidated' | 'final'
export type BudgetCategory = 'operating' | 'investment' | 'revenue' | 'project' | 'other'
export type PriceType = 'htva' | 'tvac'
export type TransactionType = 'creation' | 'submission' | 'validation' | 'rejection' | 'adjustment' | 'locking' | 'transmission' | 'consolidation' | 'amendment' | 'transfer'
export type ExecutionStatus = 'credit_open' | 'engaged' | 'liquidated' | 'ordered' | 'paid' | 'cancelled'
export type NotifChannel = 'email' | 'sms' | 'in_app'
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical'
export type FiscalYearStatus = 'preparation' | 'active' | 'closed' | 'archived'
export type VoteDecision = 'approve' | 'reject' | 'abstain'
export type IntercompanyStatus = 'pending' | 'validated_by_sender' | 'validated_by_receiver' | 'matched' | 'eliminated' | 'disputed'

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Organization, 'id' | 'created_at'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      user_roles: {
        Row: UserRoleRow
        Insert: Omit<UserRoleRow, 'id' | 'created_at'>
        Update: Partial<Omit<UserRoleRow, 'id' | 'created_at'>>
      }
      currencies: {
        Row: Currency
        Insert: Omit<Currency, 'created_at'>
        Update: Partial<Currency>
      }
      exchange_rates: {
        Row: ExchangeRate
        Insert: Omit<ExchangeRate, 'id' | 'created_at'>
        Update: Partial<Omit<ExchangeRate, 'id' | 'created_at'>>
      }
      fiscal_years: {
        Row: FiscalYear
        Insert: Omit<FiscalYear, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<FiscalYear, 'id' | 'created_at'>>
      }
      budgets: {
        Row: Budget
        Insert: Omit<Budget, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Budget, 'id' | 'created_at'>>
      }
      budget_lines: {
        Row: BudgetLine
        Insert: Omit<BudgetLine, 'id' | 'created_at' | 'updated_at' | 'amount_htva' | 'amount_tvac'>
        Update: Partial<Omit<BudgetLine, 'id' | 'created_at' | 'amount_htva' | 'amount_tvac'>>
      }
      budget_transactions: {
        Row: BudgetTransaction
        Insert: Omit<BudgetTransaction, 'id' | 'created_at' | 'hash'>
        Update: never
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Pick<Notification, 'is_read' | 'read_at'>>
      }
      audit_logs: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at' | 'hash'>
        Update: never
      }
      vendors: {
        Row: Vendor
        Insert: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Vendor, 'id' | 'created_at'>>
      }
      copil_members: {
        Row: CopilMember
        Insert: Omit<CopilMember, 'id' | 'appointed_at'>
        Update: Partial<Pick<CopilMember, 'is_active'>>
      }
      copil_sessions: {
        Row: CopilSession
        Insert: Omit<CopilSession, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CopilSession, 'id' | 'created_at'>>
      }
      copil_votes: {
        Row: CopilVote
        Insert: Omit<CopilVote, 'id' | 'voted_at'>
        Update: never
      }
      intercompany_transactions: {
        Row: IntercompanyTransaction
        Insert: Omit<IntercompanyTransaction, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<IntercompanyTransaction, 'id' | 'created_at'>>
      }
      consolidations: {
        Row: Consolidation
        Insert: Omit<Consolidation, 'id' | 'created_at' | 'prepared_at'>
        Update: Partial<Omit<Consolidation, 'id' | 'created_at'>>
      }
      budget_units: {
        Row: BudgetUnit
        Insert: Omit<BudgetUnit, 'id'>
        Update: Partial<BudgetUnit>
      }
      budget_rubrics: {
        Row: BudgetRubric
        Insert: Omit<BudgetRubric, 'id' | 'created_at'>
        Update: Partial<Omit<BudgetRubric, 'id' | 'created_at'>>
      }
      delegations: {
        Row: Delegation
        Insert: Omit<Delegation, 'id' | 'created_at'>
        Update: Partial<Pick<Delegation, 'is_active'>>
      }
    }
    Functions: {
      is_admin: { Args: Record<never, never>; Returns: boolean }
      is_holding_level: { Args: Record<never, never>; Returns: boolean }
      is_audit_director: { Args: Record<never, never>; Returns: boolean }
      get_user_org_ids: { Args: Record<never, never>; Returns: string[] }
    }
  }
}

export interface Organization {
  id: string
  name: string
  code: string
  level: OrgLevel
  type: OrgType
  parent_id: string | null
  country_code: string | null
  currency_code: string | null
  has_copil: boolean
  is_active: boolean
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  avatar_url: string | null
  preferred_language: string
  is_active: boolean
  two_factor_enabled: boolean
  two_factor_secret: string | null
  last_login_at: string | null
  notification_email: boolean
  notification_sms: boolean
  notification_in_app: boolean
  theme: string
  created_at: string
  updated_at: string
}

export interface UserRoleRow {
  id: string
  user_id: string
  role: UserRole
  organization_id: string
  granted_by: string | null
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
}

export interface Currency {
  code: string
  name_fr: string
  name_en: string
  name_pt: string
  symbol: string
  is_active: boolean
  is_reference: boolean
  created_at: string
}

export interface ExchangeRate {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  effective_date: string
  fiscal_year_id: string | null
  set_by: string | null
  notes: string | null
  created_at: string
}

export interface FiscalYear {
  id: string
  organization_id: string
  code: string
  name: string
  start_date: string
  end_date: string
  status: FiscalYearStatus
  reference_currency: string
  budget_deadline: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Budget {
  id: string
  fiscal_year_id: string
  organization_id: string
  title: string
  status: BudgetStatus
  submitted_at: string | null
  locked_at: string | null
  transmitted_at: string | null
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface BudgetLine {
  id: string
  budget_id: string
  rubric_id: string | null
  category: BudgetCategory
  paa: string | null
  title: string
  description: string | null
  period_start: string | null
  period_end: string | null
  priority: PriorityLevel
  quantity: number
  unit_id: string | null
  unit_label: string | null
  unit_price: number
  price_type: PriceType
  vat_rate: number
  amount_htva: number
  amount_tvac: number
  currency_code: string
  amount_usd: number | null
  exchange_rate_id: string | null
  justification_why: string
  justification_consequence: string
  is_recurring: boolean
  parent_line_id: string | null
  line_number: number | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface BudgetTransaction {
  id: string
  budget_id: string
  budget_line_id: string | null
  type: TransactionType
  from_status: BudgetStatus | null
  to_status: BudgetStatus | null
  amount: number | null
  currency_code: string | null
  exchange_rate: number | null
  amount_usd: number | null
  performed_by: string
  organization_id: string
  comment: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  hash: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  channel: NotifChannel
  title: string
  body: string
  entity_type: string | null
  entity_id: string | null
  is_read: boolean
  sent_at: string | null
  read_at: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  organization_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  before_value: Record<string, unknown> | null
  after_value: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  fiscal_year_id: string | null
  hash: string
  created_at: string
}

export interface Vendor {
  id: string
  organization_id: string
  name: string
  code: string
  country_code: string | null
  email: string | null
  phone: string | null
  address: string | null
  tax_number: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CopilMember {
  id: string
  organization_id: string
  user_id: string
  role: 'copil_president' | 'copil_member'
  is_active: boolean
  appointed_at: string
  appointed_by: string | null
}

export interface CopilSession {
  id: string
  organization_id: string
  budget_id: string
  fiscal_year_id: string
  convened_by: string
  session_date: string | null
  quorum_met: boolean
  final_decision: VoteDecision | null
  pv_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CopilVote {
  id: string
  session_id: string
  member_id: string
  decision: VoteDecision
  comment: string | null
  voted_at: string
}

export interface IntercompanyTransaction {
  id: string
  reference: string
  fiscal_year_id: string
  sender_org_id: string
  receiver_org_id: string
  budget_line_id_sender: string | null
  description: string
  amount: number
  currency_code: string
  amount_usd: number | null
  status: IntercompanyStatus
  created_by: string
  validated_by_sender: string | null
  validated_sender_at: string | null
  validated_by_receiver: string | null
  validated_receiver_at: string | null
  matched_at: string | null
  eliminated_at: string | null
  dispute_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Consolidation {
  id: string
  fiscal_year_id: string
  reference_currency: string
  total_budget_usd: number | null
  total_consumed_usd: number | null
  interco_eliminated: number | null
  status: 'draft' | 'final'
  prepared_by: string
  validated_by: string | null
  prepared_at: string
  validated_at: string | null
  snapshot: Record<string, unknown> | null
  notes: string | null
  created_at: string
}

export interface BudgetUnit {
  id: string
  code: string
  name_fr: string
  name_en: string
  name_pt: string
  is_active: boolean
}

export interface BudgetRubric {
  id: string
  organization_id: string | null
  category: BudgetCategory
  code: string
  name_fr: string
  name_en: string
  name_pt: string
  is_active: boolean
  created_at: string
}

export interface Delegation {
  id: string
  delegator_id: string
  delegate_id: string
  role: UserRole
  organization_id: string
  reason: string
  valid_from: string
  valid_until: string
  is_active: boolean
  created_by: string | null
  created_at: string
}

// Types enrichis (avec joins)
export interface OrganizationWithChildren extends Organization {
  children?: OrganizationWithChildren[]
}

export interface ProfileWithRoles extends Profile {
  email?: string
  user_roles?: Array<UserRoleRow & { organization?: Organization }>
}
