'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import QuickAdd from '@/components/QuickAdd'
import ManualTransactionForm from '@/components/ManualTransactionForm'
import TripHeader from '@/components/TripHeader'
import StartTripModal from '@/components/StartTripModal'
import ShareTripModal from '@/components/ShareTripModal'
import MemberListModal from '@/components/MemberListModal'
import RecentActivity from '@/components/RecentActivity'
import TransactionEditForm from '@/components/TransactionEditForm'
import { createTrip } from '@/lib/trips/create'
import { joinTrip } from '@/lib/trips/join'
import { listTrips } from '@/lib/trips/list'
import { useAIParser } from '@/hooks/useAIParser'
import { createTransaction } from '@/lib/transactions/create'
import { TransactionParsed } from '@/types/transaction'
import { Transaction } from '@/types/transaction'
import { Trip, TripMember } from '@/types/trip'
import { supabase } from '@/lib/supabase/client'
import UndoToast from '@/components/UndoToast'
import { removeMember } from '@/lib/trips/removeMember'

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isProcessing, setIsProcessing] = useState(false)
  const [tripId, setTripId] = useState<string | null>(null)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [members, setMembers] = useState<TripMember[]>([])
  const [memberNames, setMemberNames] = useState<string[]>([])
  const [showManualForm, setShowManualForm] = useState(false)
  const [showStartTripModal, setShowStartTripModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [pendingParsed, setPendingParsed] = useState<TransactionParsed | null>(null)
  const [pendingReceiptUrl, setPendingReceiptUrl] = useState<string | null>(null)
  const [undoState, setUndoState] = useState<{
    type: 'transaction' | 'member'
    itemId: string
    message: string
  } | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  useEffect(() => {
    // Check for trip ID in localStorage or URL
    const storedTripId = localStorage.getItem('tripId')
    const storedUser = localStorage.getItem('currentUser')
    const inviteCode = searchParams.get('code')

    if (inviteCode) {
      // Handle joining via invite code
      const displayName = prompt('Enter your name:') || 'Guest'
      joinTrip(inviteCode, displayName)
        .then((id) => {
          localStorage.setItem('tripId', id)
          localStorage.setItem('currentUser', displayName)
          setTripId(id)
          setCurrentUser(displayName)
          loadTripData(id)
          loadTrips(displayName)
          router.replace('/')
        })
        .catch((err) => {
          alert(err.message)
        })
    } else if (storedTripId && storedUser) {
      setTripId(storedTripId)
      setCurrentUser(storedUser)
      loadTripData(storedTripId)
      loadTrips(storedUser)
    } else {
      // No trip - show start trip option
      setShowStartTripModal(true)
    }
  }, [searchParams, router])

  const loadTrips = async (userName: string) => {
    try {
      const userTrips = await listTrips(userName)
      setTrips(userTrips)
    } catch (error) {
      console.error('Error loading trips:', error)
    }
  }

  const loadTripData = async (tripId: string) => {
    // Load trip info
    const { data: tripData } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()

    if (tripData) {
      setTrip(tripData as Trip)
    }

    // Load members
    await loadMembers(tripId)
  }

  const loadMembers = async (tripId: string) => {
    const { data: membersData } = await supabase
      .from('trip_members')
      .select('id, display_name')
      .eq('trip_id', tripId)

    if (membersData) {
      setMembers(membersData as TripMember[])
      setMemberNames(membersData.map((m: { display_name: string }) => m.display_name))
    }
  }

  const { parseText, parseReceipt, isLoading: aiLoading } = useAIParser({
    tripId,
    onSuccess: async (parsed, receiptUrl) => {
      setPendingParsed(parsed)
      setPendingReceiptUrl(receiptUrl || null)
      // Auto-save if parsing looks good, otherwise show manual form
      if (parsed.total_amount > 0 && parsed.description) {
        await saveTransaction(parsed, receiptUrl || null)
      } else {
        setShowManualForm(true)
      }
    },
    onError: (error) => {
      console.error('AI parsing error:', error)
      setShowManualForm(true)
    },
  })

  const saveTransaction = async (parsed: TransactionParsed, receiptUrl: string | null) => {
    if (!tripId) return

    try {
      const result = await createTransaction(tripId, parsed, receiptUrl)
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }

      // Show undo toast - check if member was added
      if (result.addedMember) {
        setUndoState({
          type: 'member',
          itemId: result.addedMember.id,
          message: `${result.addedMember.name} added to trip`,
        })
      } else {
        setUndoState({
          type: 'transaction',
          itemId: result.transactionId,
          message: 'Transaction added',
        })
      }

      // Reload members in case new ones were added
      await loadMembers(tripId)

      // Reset state
      setPendingParsed(null)
      setPendingReceiptUrl(null)
      setShowManualForm(false)
    } catch (error) {
      console.error('Error saving transaction:', error)
      alert(error instanceof Error ? error.message : 'Failed to save transaction')
      setShowManualForm(true)
    }
  }

  const handleUndo = async () => {
    if (!undoState) return

    try {
      if (undoState.type === 'transaction') {
        const response = await fetch(`/api/transactions/${undoState.itemId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          setUndoState(null)
          if (navigator.vibrate) {
            navigator.vibrate(50)
          }
        }
      } else if (undoState.type === 'member') {
        if (!tripId) return
        await removeMember(tripId, undoState.itemId)
        await loadMembers(tripId)
        setUndoState(null)
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }
    } catch (error) {
      console.error('Error undoing:', error)
    }
  }

  const handleStartTrip = async (tripName: string, userName: string) => {
    try {
      const { tripId: newTripId, inviteCode } = await createTrip(userName, tripName)
      localStorage.setItem('tripId', newTripId)
      localStorage.setItem('currentUser', userName)
      setTripId(newTripId)
      setCurrentUser(userName)
      await loadTripData(newTripId)
      await loadTrips(userName)
      setShowStartTripModal(false)
    } catch (error) {
      console.error('Error creating trip:', error)
      alert(error instanceof Error ? error.message : 'Failed to create trip')
    }
  }

  const handleSwitchTrip = async (newTripId: string) => {
    localStorage.setItem('tripId', newTripId)
    setTripId(newTripId)
    await loadTripData(newTripId)
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!tripId) return
    try {
      await removeMember(tripId, memberId)
      await loadMembers(tripId)
    } catch (error) {
      console.error('Error removing member:', error)
      alert('Failed to remove member')
    }
  }

  const handleEditTransaction = async (data: Partial<Transaction>) => {
    if (!editingTransaction) return

    try {
      const response = await fetch(`/api/transactions/${editingTransaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update transaction')
      }

      setEditingTransaction(null)
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Failed to update transaction')
    }
  }

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return
    }

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete transaction')
      }
    } catch (error) {
      console.error('Error deleting transaction:', error)
      alert('Failed to delete transaction')
    }
  }

  const handleSubmit = async (text: string, imageFile?: File) => {
    // If no trip exists, show start trip modal
    if (!tripId || !currentUser) {
      setShowStartTripModal(true)
      return
    }

    setIsProcessing(true)

    try {
      // Parse with AI
      if (imageFile) {
        await parseReceipt(imageFile)
      } else if (text.trim()) {
        await parseText(text)
      }
    } catch (error) {
      console.error('Error processing transaction:', error)
      setShowManualForm(true)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManualSubmit = (data: TransactionParsed) => {
    saveTransaction(data, pendingReceiptUrl)
  }

  if (showManualForm) {
    return (
      <ManualTransactionForm
        initialData={pendingParsed || undefined}
        memberNames={memberNames}
        onSubmit={handleManualSubmit}
        onCancel={() => {
          setShowManualForm(false)
          setPendingParsed(null)
          setPendingReceiptUrl(null)
        }}
      />
    )
  }

  return (
    <div className="pb-16 min-h-screen bg-base">
      {trip ? (
        <>
          <TripHeader
            trip={trip}
            members={members}
            trips={trips}
            onShare={() => setShowShareModal(true)}
            onSwitchTrip={handleSwitchTrip}
            onCreateTrip={() => setShowStartTripModal(true)}
            onViewMembers={() => setShowMemberModal(true)}
          />
          <QuickAdd onSubmit={handleSubmit} isProcessing={isProcessing || aiLoading} />
          <RecentActivity
            tripId={tripId}
            onEdit={setEditingTransaction}
            onDelete={handleDeleteTransaction}
          />
        </>
      ) : (
        <div className="min-h-screen flex flex-col items-center justify-center px-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-serif font-bold text-accent mb-4">Squared</h1>
            <p className="text-accent/60 mb-8">Start tracking expenses for your trip</p>
            <button
              onClick={() => setShowStartTripModal(true)}
              className="px-8 py-4 bg-accent text-base rounded-full font-medium"
            >
              Start Trip
            </button>
          </div>
        </div>
      )}

      <StartTripModal
        isOpen={showStartTripModal}
        onClose={() => setShowStartTripModal(false)}
        onSubmit={handleStartTrip}
        defaultUserName={currentUser || ''}
      />

      {trip && (
        <>
          <ShareTripModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            inviteCode={trip.invite_code}
            tripName={trip.name}
          />

          <MemberListModal
            isOpen={showMemberModal}
            onClose={() => setShowMemberModal(false)}
            members={members}
            onRemoveMember={handleRemoveMember}
          />
        </>
      )}

      {editingTransaction && (
        <TransactionEditForm
          transaction={editingTransaction as any}
          memberNames={members.map((m) => ({ id: m.id, name: m.display_name }))}
          tripId={tripId}
          onSubmit={handleEditTransaction}
          onCancel={() => setEditingTransaction(null)}
        />
      )}

      {undoState && (
        <UndoToast
          show={true}
          type={undoState.type}
          message={undoState.message}
          onUndo={handleUndo}
          onDismiss={() => setUndoState(null)}
          itemId={undoState.itemId}
        />
      )}
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-success border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
