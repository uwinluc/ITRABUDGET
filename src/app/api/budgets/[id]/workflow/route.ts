import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Dérive la chaîne d'approbation depuis la hiérarchie d'une organisation
async function buildApprovalChain(
  budgetId: string,
  orgId: string,
  supabase: SupabaseClient
) {
  const steps: Array<{
    budget_id: string
    step_order: number
    step_label: string
    required_role: string
    approver_org_id: string
    decision: string
    deadline: string
  }> = []

  const ROLE_FOR_LEVEL: Record<string, string | null> = {
    service:    'service_chief',
    direction:  'director',
    subsidiary: 'dg_subsidiary',
    country:    null,
    holding:    'dg_holding',
  }

  let currentOrgId: string | null = orgId
  let stepOrder = 1

  while (currentOrgId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, level, parent_id, has_copil')
      .eq('id', currentOrgId)
      .single() as { data: { id: string; name: string; level: string; parent_id: string | null; has_copil: boolean } | null }

    if (!org) break

    const role = ROLE_FOR_LEVEL[org.level as string]
    if (role) {
      steps.push({
        budget_id: budgetId,
        step_order: stepOrder++,
        step_label: `Validation ${org.name}`,
        required_role: role,
        approver_org_id: org.id,
        decision: 'pending',
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      })

      // Étape COPIL si filiale avec COPIL
      if (org.level === 'subsidiary' && org.has_copil) {
        steps.push({
          budget_id: budgetId,
          step_order: stepOrder++,
          step_label: `COPIL ${org.name}`,
          required_role: 'copil_president',
          approver_org_id: org.id,
          decision: 'pending',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
      }
    }

    currentOrgId = (org.parent_id as string | null) ?? null
  }

  return steps
}

// POST /api/budgets/[id]/workflow  { action: 'submit'|'approve'|'reject', comment?, approvalId? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: budgetId } = await params
  const body = await req.json() as { action: string; comment?: string; approvalId?: string }
  const { action, comment, approvalId } = body

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = await createAdminClient()

  // Charger le budget
  const { data: budget } = await admin
    .from('budgets')
    .select('id, status, organization_id, title')
    .eq('id', budgetId)
    .single()

  if (!budget) return NextResponse.json({ error: 'Budget introuvable' }, { status: 404 })

  const status = budget.status as string

  // ── SOUMETTRE ─────────────────────────────────────────────
  if (action === 'submit') {
    if (status !== 'draft') {
      return NextResponse.json({ error: 'Seul un brouillon peut être soumis' }, { status: 400 })
    }

    // Générer la chaîne d'approbation
    const chain = await buildApprovalChain(budgetId, budget.organization_id as string, admin)

    if (chain.length === 0) {
      // Pas de chaîne configurée → approbation automatique directe
      await admin.from('budgets').update({
        status: 'approved',
        submitted_at: new Date().toISOString(),
      }).eq('id', budgetId)

      await admin.from('budget_transactions').insert({
        budget_id: budgetId,
        type: 'submission',
        from_status: 'draft',
        to_status: 'approved',
        performed_by: user.id,
        organization_id: budget.organization_id,
        comment: comment ?? 'Soumis et approuvé automatiquement (aucun workflow configuré)',
      })

      return NextResponse.json({ success: true, autoApproved: true })
    }

    // Insérer les étapes d'approbation
    const { error: chainErr } = await admin.from('budget_approvals').insert(chain)
    if (chainErr) return NextResponse.json({ error: chainErr.message }, { status: 500 })

    // Mettre à jour le budget
    await admin.from('budgets').update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }).eq('id', budgetId)

    await admin.from('budget_transactions').insert({
      budget_id: budgetId,
      type: 'submission',
      from_status: 'draft',
      to_status: 'submitted',
      performed_by: user.id,
      organization_id: budget.organization_id,
      comment: comment ?? null,
    })

    return NextResponse.json({ success: true, stepsCreated: chain.length })
  }

  // ── APPROUVER ─────────────────────────────────────────────
  if (action === 'approve') {
    if (!approvalId) return NextResponse.json({ error: 'approvalId requis' }, { status: 400 })

    const { error: updateErr } = await admin
      .from('budget_approvals')
      .update({
        decision: 'approved',
        approver_id: user.id,
        comment: comment ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', approvalId)
      .eq('budget_id', budgetId)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Vérifier si toutes les étapes sont approuvées
    const { data: remaining } = await admin
      .from('budget_approvals')
      .select('id')
      .eq('budget_id', budgetId)
      .eq('decision', 'pending')

    if (!remaining || remaining.length === 0) {
      // Toutes approuvées → budget approuvé
      await admin.from('budgets').update({ status: 'approved' }).eq('id', budgetId)

      await admin.from('budget_transactions').insert({
        budget_id: budgetId,
        type: 'validation',
        from_status: status,
        to_status: 'approved',
        performed_by: user.id,
        organization_id: budget.organization_id,
        comment: 'Toutes les étapes approuvées',
      })
    } else {
      // Mettre en révision si encore en cours
      if (status === 'submitted') {
        await admin.from('budgets').update({ status: 'under_review' }).eq('id', budgetId)
        await admin.from('budget_transactions').insert({
          budget_id: budgetId,
          type: 'validation',
          from_status: 'submitted',
          to_status: 'under_review',
          performed_by: user.id,
          organization_id: budget.organization_id,
          comment: comment ?? null,
        })
      }
    }

    return NextResponse.json({ success: true, remainingSteps: remaining?.length ?? 0 })
  }

  // ── REJETER ───────────────────────────────────────────────
  if (action === 'reject') {
    if (!approvalId) return NextResponse.json({ error: 'approvalId requis' }, { status: 400 })
    if (!comment) return NextResponse.json({ error: 'Commentaire obligatoire pour un rejet' }, { status: 400 })

    await admin.from('budget_approvals').update({
      decision: 'rejected',
      approver_id: user.id,
      comment,
      decided_at: new Date().toISOString(),
    }).eq('id', approvalId).eq('budget_id', budgetId)

    // Annuler les étapes en attente
    await admin.from('budget_approvals').update({ decision: 'rejected' })
      .eq('budget_id', budgetId)
      .eq('decision', 'pending')

    await admin.from('budgets').update({ status: 'rejected' }).eq('id', budgetId)

    await admin.from('budget_transactions').insert({
      budget_id: budgetId,
      type: 'rejection',
      from_status: status,
      to_status: 'rejected',
      performed_by: user.id,
      organization_id: budget.organization_id,
      comment,
    })

    return NextResponse.json({ success: true })
  }

  // ── VERROUILLER ───────────────────────────────────────────
  if (action === 'lock') {
    if (status !== 'approved') {
      return NextResponse.json({ error: 'Seul un budget approuvé peut être verrouillé' }, { status: 400 })
    }

    await admin.from('budgets').update({
      status: 'locked',
      locked_at: new Date().toISOString(),
    }).eq('id', budgetId)

    await admin.from('budget_transactions').insert({
      budget_id: budgetId,
      type: 'locking',
      from_status: 'approved',
      to_status: 'locked',
      performed_by: user.id,
      organization_id: budget.organization_id,
      comment: comment ?? null,
    })

    return NextResponse.json({ success: true })
  }

  // ── TRANSMETTRE ───────────────────────────────────────────
  if (action === 'transmit') {
    if (status !== 'locked') {
      return NextResponse.json({ error: 'Seul un budget verrouillé peut être transmis' }, { status: 400 })
    }

    await admin.from('budgets').update({
      status: 'transmitted',
      transmitted_at: new Date().toISOString(),
    }).eq('id', budgetId)

    await admin.from('budget_transactions').insert({
      budget_id: budgetId,
      type: 'transmission',
      from_status: 'locked',
      to_status: 'transmitted',
      performed_by: user.id,
      organization_id: budget.organization_id,
      comment: comment ?? null,
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
