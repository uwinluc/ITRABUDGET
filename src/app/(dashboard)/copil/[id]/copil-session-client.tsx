'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Users, CheckCircle2, XCircle, MinusCircle,
  Clock, Building2, FileText, Vote, Loader2, AlertCircle,
  CheckCheck, Crown
} from 'lucide-react'
import { Button } from '@/components/ui/button'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatDate, cn } from '@/lib/utils'

type VoteDecision = 'approve' | 'reject' | 'abstain'

interface Props {
  session: Record<string, unknown>
  members: Array<{ id: string; user_id: string; role: string; is_active: boolean }>
  votes: Array<{ id: string; member_id: string; decision: string; comment: string | null; voted_at: string }>
  budget: Record<string, unknown> | null
  organization: Record<string, unknown> | null
  profiles: Array<{ id: string; first_name: string; last_name: string }>
  currentUserId: string
  currentMember: { id: string; role: string } | null
}

export function CopilSessionClient({
  session, members, votes, budget, organization, profiles,
  currentUserId, currentMember
}: Props) {
  const router = useRouter()
  const [voteDialog, setVoteDialog] = useState<VoteDecision | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)

  const sessionId = session.id as string
  const isClosed = !!(session.final_decision)
  const isPresident = currentMember?.role === 'copil_president'
  const canVote = currentMember !== null && !isClosed

  // Vote de l'utilisateur courant
  const myVote = currentMember
    ? votes.find(v => v.member_id === currentMember.id)
    : null

  const hasVoted = myVote !== null && myVote !== undefined

  const getProfile = (userId: string) => profiles.find(p => p.id === userId)

  const voteCount = {
    approve: votes.filter(v => v.decision === 'approve').length,
    reject:  votes.filter(v => v.decision === 'reject').length,
    abstain: votes.filter(v => v.decision === 'abstain').length,
    total:   votes.length,
  }

  const quorumThreshold = Math.ceil(members.length / 2)
  const hasQuorum = voteCount.total >= quorumThreshold
  const allVoted = voteCount.total === members.length
  const isUnanimousApprove = voteCount.approve === members.length && allVoted
  const isUnanimousReject = voteCount.reject === members.length && allVoted

  const handleVote = async (decision: VoteDecision) => {
    if (!currentMember) return
    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('copil_votes').insert({
        session_id: sessionId,
        member_id: currentMember.id,
        decision,
        comment: comment || null,
      })
      if (error) throw error
      toast.success('Vote enregistré')
      setVoteDialog(null)
      setComment('')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseSession = async (finalDecision: VoteDecision) => {
    if (!isPresident) return
    setCloseLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('copil_sessions')
        .update({
          final_decision: finalDecision,
          quorum_met: hasQuorum,
        })
        .eq('id', sessionId)

      if (error) throw error

      // Si approuvé → mettre le budget en approved (via workflow API)
      if (finalDecision === 'approve' && budget) {
        await fetch(`/api/budgets/${budget.id as string}/workflow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            approvalId: null,
            comment: `Approuvé en session COPIL — Vote : ${voteCount.approve} pour, ${voteCount.reject} contre, ${voteCount.abstain} abstentions`,
          }),
        })
      }

      toast.success(`Session clôturée — Décision : ${finalDecision === 'approve' ? 'Approuvé' : finalDecision === 'reject' ? 'Rejeté' : 'Abstention'}`)
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setCloseLoading(false)
    }
  }

  const VOTE_LABELS: Record<VoteDecision, { label: string; icon: React.ElementType; color: string }> = {
    approve: { label: 'Pour',       icon: CheckCircle2, color: 'text-green-600' },
    reject:  { label: 'Contre',     icon: XCircle,      color: 'text-red-500' },
    abstain: { label: 'Abstention', icon: MinusCircle,  color: 'text-gray-500' },
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Vote className="h-5 w-5" />
              Session COPIL
            </h1>
            {isClosed ? (
              <span className={cn(
                'text-sm px-2.5 py-0.5 rounded-full font-medium',
                session.final_decision === 'approve' ? 'bg-green-100 text-green-700' :
                session.final_decision === 'reject' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              )}>
                {session.final_decision === 'approve' ? '✓ Approuvé' :
                 session.final_decision === 'reject' ? '✗ Rejeté' : 'Abstention'}
              </span>
            ) : (
              <span className="text-sm px-2.5 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
                En délibération
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
            {organization && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {organization.name as string}
              </span>
            )}
            {(session.session_date as string | null) && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(session.session_date as string)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Budget concerné */}
      {budget && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{budget.title as string}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Budget soumis au vote COPIL</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => router.push(`/budgets/${budget.id as string}`)}
              >
                Voir le budget
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel votes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Résultats du vote</CardTitle>
            <CardDescription>
              {voteCount.total} / {members.length} votes exprimés
              {hasQuorum ? (
                <span className="ml-2 text-green-700 font-medium">— Quorum atteint</span>
              ) : (
                <span className="ml-2 text-orange-600">— Quorum : {quorumThreshold} requis</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Barres de progression */}
            <div className="space-y-3">
              {(['approve', 'reject', 'abstain'] as VoteDecision[]).map(d => {
                const count = voteCount[d]
                const pct = members.length > 0 ? (count / members.length) * 100 : 0
                const cfg = VOTE_LABELS[d]
                const Icon = cfg.icon
                return (
                  <div key={d}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className={cn('flex items-center gap-1.5 font-medium', cfg.color)}>
                        <Icon className="h-4 w-4" />
                        {cfg.label}
                      </span>
                      <span className="text-muted-foreground">{count} vote{count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          d === 'approve' ? 'bg-green-500' :
                          d === 'reject'  ? 'bg-red-500' : 'bg-gray-400'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <Separator />

            {/* Résultat automatique */}
            {allVoted && !isClosed && (
              <div className={cn(
                'p-3 rounded-lg text-sm font-medium text-center',
                isUnanimousApprove ? 'bg-green-50 text-green-700 border border-green-200' :
                isUnanimousReject ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-yellow-50 text-yellow-700 border border-yellow-200'
              )}>
                {isUnanimousApprove && '✓ Vote unanime — Budget approuvé'}
                {isUnanimousReject && '✗ Vote unanime — Budget rejeté'}
                {!isUnanimousApprove && !isUnanimousReject && '⚠ Vote non unanime — Pas de consensus'}
              </div>
            )}

            {/* Bouton voter */}
            {canVote && !hasVoted && (
              <div className="flex flex-col gap-2 pt-1">
                <p className="text-sm font-medium text-center mb-1">Votre vote</p>
                {(['approve', 'reject', 'abstain'] as VoteDecision[]).map(d => {
                  const cfg = VOTE_LABELS[d]
                  const Icon = cfg.icon
                  return (
                    <Button
                      key={d}
                      variant="outline"
                      className={cn(
                        'justify-start',
                        d === 'approve' && 'border-green-400 hover:bg-green-50 text-green-700',
                        d === 'reject'  && 'border-red-400 hover:bg-red-50 text-red-700',
                      )}
                      onClick={() => { setComment(''); setVoteDialog(d) }}
                    >
                      <Icon className="h-4 w-4" />
                      {cfg.label}
                    </Button>
                  )
                })}
              </div>
            )}

            {hasVoted && (
              <div className={cn(
                'p-3 rounded-lg text-sm text-center font-medium',
                myVote?.decision === 'approve' ? 'bg-green-50 text-green-700' :
                myVote?.decision === 'reject'  ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
              )}>
                <CheckCheck className="h-4 w-4 inline mr-1.5" />
                Vous avez voté : {VOTE_LABELS[myVote?.decision as VoteDecision]?.label}
              </div>
            )}

            {/* Boutons clôture (président uniquement) */}
            {isPresident && !isClosed && allVoted && (
              <div className="space-y-2 pt-2">
                <Separator />
                <p className="text-xs text-muted-foreground text-center">En tant que Président COPIL :</p>
                {!isUnanimousApprove && !isUnanimousReject && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 text-center">
                    ⚠ Vote non unanime — l&apos;approbation n&apos;est pas possible
                  </div>
                )}
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={closeLoading || !isUnanimousApprove}
                  onClick={() => handleCloseSession('approve')}
                >
                  {closeLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="h-4 w-4" />
                  Clôturer — Approuver
                </Button>
                <Button
                  className="w-full"
                  variant="destructive"
                  disabled={closeLoading}
                  onClick={() => handleCloseSession('reject')}
                >
                  {closeLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <XCircle className="h-4 w-4" />
                  Clôturer — Rejeter
                </Button>
              </div>
            )}

            {isClosed && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                <CheckCheck className="h-4 w-4" />
                Session clôturée
              </div>
            )}
          </CardContent>
        </Card>

        {/* Liste membres */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Membres du COPIL
            </CardTitle>
            <CardDescription>{members.length} membre{members.length > 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {members.map(member => {
                const profile = getProfile(member.user_id)
                const memberVote = votes.find(v => v.member_id === member.id)
                const isCurrentUser = member.user_id === currentUserId

                return (
                  <div
                    key={member.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5',
                      isCurrentUser && 'bg-muted/30'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {member.role === 'copil_president' && (
                          <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                        )}
                        <span className="text-sm font-medium">
                          {profile ? `${profile.first_name} ${profile.last_name}` : 'Profil inconnu'}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs text-muted-foreground">(vous)</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {member.role === 'copil_president' ? 'Président' : 'Membre'}
                      </p>
                    </div>
                    <div>
                      {memberVote ? (
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          memberVote.decision === 'approve' ? 'bg-green-100 text-green-700' :
                          memberVote.decision === 'reject'  ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        )}>
                          {VOTE_LABELS[memberVote.decision as VoteDecision]?.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          En attente
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {(session.notes as string | null) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes de session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.notes as string}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog vote */}
      {voteDialog && (
        <Dialog open={!!voteDialog} onOpenChange={() => setVoteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className={cn(
                'flex items-center gap-2',
                voteDialog === 'approve' ? 'text-green-700' :
                voteDialog === 'reject'  ? 'text-red-600' : ''
              )}>
                {voteDialog === 'approve' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                {voteDialog === 'reject'  && <XCircle className="h-5 w-5 text-red-500" />}
                {voteDialog === 'abstain' && <MinusCircle className="h-5 w-5 text-gray-500" />}
                Voter : {VOTE_LABELS[voteDialog].label}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {voteDialog === 'reject' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">
                    Le vote COPIL doit être unanime. Un vote contre bloquera l&apos;approbation du budget.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Commentaire {voteDialog === 'reject' ? '(recommandé)' : '(optionnel)'}</Label>
                <Textarea
                  placeholder="Justification de votre vote..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVoteDialog(null)}>Annuler</Button>
              <Button
                disabled={loading}
                variant={voteDialog === 'reject' ? 'destructive' : 'default'}
                className={cn(voteDialog === 'approve' && 'bg-green-600 hover:bg-green-700')}
                onClick={() => handleVote(voteDialog)}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmer mon vote
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
