import * as XLSX from 'xlsx'

export function exportBudgetLinesToExcel(
  budget: Record<string, unknown>,
  lines: Record<string, unknown>[]
) {
  const CATEGORY_LABELS: Record<string, string> = {
    operating: 'Fonctionnement', investment: 'Investissement',
    revenue: 'Recette', project: 'Projet', other: 'Autre',
  }

  const rows = lines.map(l => ({
    'N° Ligne':         l.line_number,
    'Titre':            l.title,
    'Description':      l.description ?? '',
    'Catégorie':        CATEGORY_LABELS[l.category as string] ?? l.category,
    'Quantité':         l.quantity,
    'Unité':            l.unit ?? '',
    'Prix unitaire':    l.unit_price,
    'Devise':           l.currency_code,
    'TVA (%)':          l.vat_rate ?? 0,
    'Montant HTVA':     l.amount_htva,
    'Montant TVAC':     l.amount_tvac,
    'Priorité':         l.priority ?? '',
    'Période début':    l.period_start ?? '',
    'Période fin':      l.period_end ?? '',
    'PAA':              l.paa ?? '',
    'Justification':    l.justification_why ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Largeurs colonnes
  ws['!cols'] = [
    { wch: 8 }, { wch: 35 }, { wch: 30 }, { wch: 16 },
    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 8 },
    { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 40 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lignes budgétaires')

  // Feuille info budget
  const infoRows = [
    ['Titre', budget.title],
    ['Statut', budget.status],
    ['Devises', budget.currency_code],
    ['Créé le', budget.created_at ? new Date(budget.created_at as string).toLocaleDateString('fr-FR') : ''],
  ]
  const wsInfo = XLSX.utils.aoa_to_sheet(infoRows)
  wsInfo['!cols'] = [{ wch: 20 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Informations')

  const filename = `budget-${(budget.title as string).replace(/\s+/g, '_').slice(0, 30)}-${Date.now()}.xlsx`
  XLSX.writeFile(wb, filename)
}

export function exportBudgetsReportToExcel(
  budgets: Record<string, unknown>[],
  organizations: Array<{ id: string; name: string }>,
  fiscalYears: Array<{ id: string; code: string }>
) {
  const STATUS_LABELS: Record<string, string> = {
    draft: 'Brouillon', submitted: 'Soumis', under_review: 'En révision',
    approved: 'Approuvé', rejected: 'Rejeté', locked: 'Verrouillé',
    transmitted: 'Transmis', consolidated: 'Consolidé', final: 'Final',
  }

  const rows = budgets.map(b => ({
    'Titre':        b.title,
    'Statut':       STATUS_LABELS[b.status as string] ?? b.status,
    'Organisation': organizations.find(o => o.id === b.organization_id)?.name ?? '—',
    'Exercice':     fiscalYears.find(f => f.id === b.fiscal_year_id)?.code ?? '—',
    'Devise':       b.currency_code,
    'Montant HTVA': b.total_amount_htva ?? 0,
    'Créé le':      b.created_at ? new Date(b.created_at as string).toLocaleDateString('fr-FR') : '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 40 }, { wch: 14 }, { wch: 30 }, { wch: 12 },
    { wch: 8 }, { wch: 16 }, { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Budgets')
  XLSX.writeFile(wb, `rapport-budgets-${Date.now()}.xlsx`)
}

export function exportExecutionReportToExcel(data: Array<{
  org: string
  budget: number
  credited: number
  engaged: number
  paid: number
}>) {
  const rows = data.map(d => ({
    'Organisation':         d.org,
    'Budget total':         d.budget,
    'Crédits ouverts':      d.credited,
    'Engagé':               d.engaged,
    'Payé':                 d.paid,
    'Taux engagement (%)':  d.budget > 0 ? ((d.engaged / d.budget) * 100).toFixed(1) : '0.0',
    'Taux paiement (%)':    d.budget > 0 ? ((d.paid   / d.budget) * 100).toFixed(1) : '0.0',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 16 }, { wch: 20 }, { wch: 18 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Exécution')
  XLSX.writeFile(wb, `rapport-execution-${Date.now()}.xlsx`)
}
