import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageLayout } from '@/components/layout/PageLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDate } from '@/lib/utils'

import { ArrowLeft, Plus, Minus, DollarSign, Calendar, User, Mail, Phone, MapPin, Loader2 } from 'lucide-react'
// toast import removed – not used in this file

// Import query hooks
import { useClient, useClientBookings } from '@/lib/queries/clients'
import {
  useClientDepositBalance,
  useClientDepositTransactions,
  useAddDeposit,
  useUpdateDepositTransaction,
  useDeleteDepositTransaction,
  type AddDepositData,
  type DepositTransaction,
  type UpdateDepositTransactionData
} from '@/lib/queries/deposits'

// Validation function
function validateParams(params: { clientId: string }) {
  const { clientId } = params

  if (!clientId) {
    throw new Error('Client ID is required')
  }

  if (!/^\d+$/.test(clientId)) {
    throw new Error('Client ID must be a valid number')
  }

  return { clientId }
}

// Route definition
export const Route = createFileRoute('/client-detail/$clientId')({
  beforeLoad: async ({ params }) => {
    // Validate parameters
    validateParams(params)

    return {}
  },
  component: ClientDetailPage,
})

// Helper functions

function getTransactionTypeColor(type: string): string {
  switch (type?.toLowerCase()) {
    case 'deposit':
    case 'adjustment':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/30'
    case 'refund':
      return 'bg-rose-50 text-rose-700 border-rose-200/30'
    case 'usage':
      return 'bg-zinc-100 text-zinc-800 border-zinc-200/50'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200/50'
  }
}

function getBookingStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/30'
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200/30'
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200/30'
    default:
      return 'bg-zinc-100 text-zinc-800 border-zinc-200/50'
  }
}

function ClientDetailPage() {
  const navigate = useNavigate()
  const params = Route.useParams()
  const clientId = params.clientId // Keep as string for API calls

  const [isAddDepositOpen, setIsAddDepositOpen] = useState(false)
  const [depositFormData, setDepositFormData] = useState({
    amount: "",
    description: "",
    referenceNumber: "",
    adjustmentType: "increase" as "increase" | "decrease"
  })

  // Edit transaction state
  const [isEditTxOpen, setIsEditTxOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<DepositTransaction | null>(null)
  const [editTxFormData, setEditTxFormData] = useState({
    amount: "",
    description: "",
    referenceNumber: ""
  })

  // Fetch data using TanStack Query
  const { data: client, isLoading: clientLoading, error: clientError } = useClient(clientId)
  const { data: clientBookings = [], isLoading: bookingsLoading } = useClientBookings(clientId)
  const { data: depositBalance, isLoading: balanceLoading } = useClientDepositBalance(clientId)
  const { data: transactions = [], isLoading: transactionsLoading } = useClientDepositTransactions(clientId)

  // Mutations
  const addDepositMutation = useAddDeposit()
  const updateTransactionMutation = useUpdateDepositTransaction()
  const deleteTransactionMutation = useDeleteDepositTransaction()

  // Handle form submissions
  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!depositFormData.amount || !depositFormData.description) {
      console.error('Please fill in all required fields')
      return
    }

    const amount = parseFloat(depositFormData.amount)
    if (isNaN(amount) || amount <= 0) {
      console.error('Please enter a valid amount')
      return
    }

    try {
      const depositData: AddDepositData = {
        clientId: parseInt(clientId), // Convert to number for API
        amount,
        description: depositFormData.description,
        referenceNumber: depositFormData.referenceNumber || undefined
      }

      await addDepositMutation.mutateAsync(depositData)


      setIsAddDepositOpen(false)
      setDepositFormData({
        amount: "",
        description: "",
        referenceNumber: "",
        adjustmentType: "increase"
      })
    } catch (error) {
      console.error('Error adding deposit:', error)
    }
  }



  // Edit transaction handlers
  const handleOpenEditTransaction = (tx: DepositTransaction) => {
    // Guard: usage transactions cannot be edited per server rules
    if (tx.type === 'usage') {
      toast.warning('Usage transactions cannot be edited.');
      return;
    }
    setSelectedTransaction(tx);
    setEditTxFormData({
      amount: tx.amount ? parseFloat(tx.amount).toFixed(2) : "",
      description: tx.description || "",
      referenceNumber: tx.referenceNumber || ""
    });
    setIsEditTxOpen(true);
  }

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransaction) return;

    // Guard: usage transactions cannot be edited
    if (selectedTransaction.type === 'usage') {
      toast.warning('Usage transactions cannot be edited.');
      return;
    }

    try {
      const payload: UpdateDepositTransactionData = {
        clientId: parseInt(clientId),
        transactionId: selectedTransaction.id,
        description: editTxFormData.description,
        referenceNumber: editTxFormData.referenceNumber,
      };

      const rawAmount = (editTxFormData.amount || '').trim();
      const isAmountProvided = rawAmount !== '';

      if (isAmountProvided) {
        const amountNum = parseFloat(rawAmount);
        if (isNaN(amountNum)) {
          toast.warning('Amount must be a valid number');
          return;
        }
        // Enforce positive amounts for deposit/refund per server rules
        if (
          (selectedTransaction.type === 'deposit' || selectedTransaction.type === 'refund') &&
          amountNum <= 0
        ) {
          toast.warning('Amount must be greater than 0 for deposit/refund');
          return;
        }
        // Adjustment can be positive, negative, or zero
        payload.amount = amountNum;
      }

      await updateTransactionMutation.mutateAsync(payload);
      toast.success('Transaction updated successfully');
      setIsEditTxOpen(false);
      setSelectedTransaction(null);
      setEditTxFormData({ amount: "", description: "", referenceNumber: "" });
    } catch (error) {
      console.error('Error updating transaction:', error);
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(msg);
    }
  }

  // Delete transaction handler
  const handleDeleteTransaction = async (tx: DepositTransaction) => {
    const confirmed = window.confirm('Delete this transaction? This will reverse its effect on the balance.')
    if (!confirmed) return
    try {
      await deleteTransactionMutation.mutateAsync({
        clientId: parseInt(clientId),
        transactionId: tx.id
      })
    } catch (error) {
      console.error('Error deleting transaction:', error)
    }
  }

  // Handle loading and error states
  if (clientLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (clientError) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600 mb-2">Error Loading Client</h2>
            <p className="text-gray-600 mb-4">
              {clientError instanceof Error ? clientError.message : 'Failed to load client data'}
            </p>
            <Button onClick={() => navigate({ to: '/clients' })}>
              Back to Clients
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-600 mb-2">Client Not Found</h2>
            <p className="text-gray-600 mb-4">The requested client could not be found.</p>
            <Button onClick={() => navigate({ to: '/clients' })}>
              Back to Clients
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PageLayout
      title={client.name}
      subtitle="Client Details & Deposit Management"
      actions={
        <div className="flex items-center space-x-3">
          <Badge className="bg-[#f5f5f5] text-[#111111] border-[#e5e7eb] font-semibold text-xs py-0.5 px-2.5 rounded-full shadow-none border">
            Active
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: '/clients' })}
            className="h-8 px-3 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-medium rounded-md flex items-center space-x-1.5 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Clients</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* Client Information */}
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
          <CardHeader className="border-b border-gray-100 pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-400" />
              <span>Client Profile</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="flex items-center space-x-3.5">
              <div className="p-2 bg-[#f5f5f5] rounded-lg">
                <Mail className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Email Address</p>
                <p className="font-semibold text-gray-800 text-sm">{client.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3.5">
              <div className="p-2 bg-[#f5f5f5] rounded-lg">
                <Phone className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Phone Number</p>
                <p className="font-semibold text-gray-800 text-sm">{client.phone}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3.5">
              <div className="p-2 bg-[#f5f5f5] rounded-lg">
                <MapPin className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Billing Address</p>
                <p className="font-semibold text-gray-800 text-sm">{client.address || <span className="text-gray-400 font-mono">-</span>}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3.5">
              <div className="p-2 bg-[#f5f5f5] rounded-lg">
                <Calendar className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Member Since</p>
                <p className="font-semibold text-gray-800 text-sm font-mono">
                  {new Date(client.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deposit Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">Current Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-[#111111]">
                {balanceLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                ) : (
                  `SAR ${depositBalance?.currentBalance ? parseFloat(depositBalance.currentBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Available balance for bookings</p>
            </CardContent>
          </Card>

          <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Deposited</CardTitle>
              <Plus className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-[#111111]">
                {balanceLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                ) : (
                  `SAR ${depositBalance?.totalDeposited ? parseFloat(depositBalance.totalDeposited).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Lifetime total funding</p>
            </CardContent>
          </Card>

          <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Used</CardTitle>
              <Minus className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-[#111111]">
                {balanceLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                ) : (
                  `SAR ${depositBalance?.totalUsed ? parseFloat(depositBalance.totalUsed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Total amount charged to bookings</p>
            </CardContent>
          </Card>
        </div>

        {/* Add Deposit Modal */}
        {isAddDepositOpen && (
          <div className="fixed inset-0 bg-[#111111]/40 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
            <div className="bg-white p-6 rounded-xl border border-[#e5e7eb] w-full max-w-md shadow-xl">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-4 pb-2 border-b border-gray-100">Add Deposit</h3>
              <form onSubmit={handleAddDeposit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Amount (SAR) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={depositFormData.amount}
                      onChange={(e) => setDepositFormData(prev => ({ ...prev, amount: e.target.value }))}
                      required
                      className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="referenceNumber" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Reference Number</Label>
                    <Input
                      id="referenceNumber"
                      placeholder="Optional reference"
                      value={depositFormData.referenceNumber}
                      onChange={(e) => setDepositFormData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                      className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the deposit..."
                    value={depositFormData.description}
                    onChange={(e) => setDepositFormData(prev => ({ ...prev, description: e.target.value }))}
                    required
                    className="px-3 py-2 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100 mt-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDepositOpen(false)}
                    className="h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-md"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addDepositMutation.isPending}
                    className="h-9 px-4 bg-[#111111] hover:bg-[#242424] text-white font-semibold text-xs rounded-md transition-colors border border-transparent shadow-sm"
                  >
                    {addDepositMutation.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Adding...
                      </>
                    ) : (
                      'Add Deposit'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Transaction Modal */}
        {isEditTxOpen && (
          <div className="fixed inset-0 bg-[#111111]/40 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
            <div className="bg-white p-6 rounded-xl border border-[#e5e7eb] w-full max-w-md shadow-xl">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-2 pb-2 border-b border-gray-100">Edit Transaction</h3>
              {selectedTransaction && (
                <div className="mb-4 p-3 bg-[#f9fafb] rounded-lg border border-gray-100 text-xs text-gray-500 space-y-1 font-mono">
                  <div>Type: <span className="font-semibold text-gray-700 uppercase">{selectedTransaction.type}</span></div>
                  <div>Amount: <span className="font-semibold text-gray-700">SAR {selectedTransaction.amount ? parseFloat(selectedTransaction.amount).toFixed(2) : '0.00'}</span></div>
                  <div>Date: <span className="font-semibold text-gray-700">{new Date(selectedTransaction.createdAt).toLocaleDateString()}</span></div>
                </div>
              )}
              <form onSubmit={handleUpdateTransaction} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="editAmount" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Amount (SAR)</Label>
                  <Input
                    id="editAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={editTxFormData.amount}
                    onChange={(e) => setEditTxFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editDescription" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Description</Label>
                  <Textarea
                    id="editDescription"
                    placeholder="Update description..."
                    value={editTxFormData.description}
                    onChange={(e) => setEditTxFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="px-3 py-2 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editReferenceNumber" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Reference Number</Label>
                  <Input
                    id="editReferenceNumber"
                    placeholder="Optional reference"
                    value={editTxFormData.referenceNumber}
                    onChange={(e) => setEditTxFormData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                    className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100 mt-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditTxOpen(false)
                      setSelectedTransaction(null)
                    }}
                    className="h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-md"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateTransactionMutation.isPending}
                    className="h-9 px-4 bg-[#111111] hover:bg-[#242424] text-white font-semibold text-xs rounded-md transition-colors border border-transparent shadow-sm"
                  >
                    {updateTransactionMutation.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transaction History */}
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between space-y-0 py-4 px-6">
            <div>
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">Transaction History</CardTitle>
              <CardDescription className="text-xs text-gray-400 mt-0.5">
                Recent deposit transactions and balance changes
              </CardDescription>
            </div>
            <Button
              disabled={addDepositMutation.isPending}
              onClick={() => setIsAddDepositOpen(true)}
              className="h-8 px-3.5 bg-[#111111] hover:bg-[#242424] text-white font-medium text-xs rounded-md transition-colors flex items-center space-x-1.5 border border-transparent shadow-sm"
            >
              {addDepositMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>Add Deposit</span>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {transactionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No transactions found for this client.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full border-collapse">
                  <thead className="bg-[#f9fafb]">
                    <tr className="border-b border-[#e5e7eb]">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Date</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Type</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Amount</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Description</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Reference</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Balance After</th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-xs text-gray-500 font-mono">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5 text-xs">
                          <Badge variant="outline" className={`text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-none ${getTransactionTypeColor(transaction.type)}`}>
                            {transaction.type.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className={`px-6 py-3.5 text-xs ${transaction.type === 'deposit' || transaction.type === 'adjustment'
                          ? 'text-emerald-600 font-semibold'
                          : 'text-rose-600 font-semibold'
                          }`}>
                          {transaction.type === 'deposit' || transaction.type === 'adjustment' ? '+' : '-'}
                          SAR {transaction.amount ? Math.abs(parseFloat(transaction.amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-gray-700 max-w-xs truncate" title={transaction.description}>
                          {transaction.description}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-gray-500 font-mono">
                          {transaction.referenceNumber || '-'}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-gray-600 font-mono">
                          SAR {transaction.balanceAfter ? parseFloat(transaction.balanceAfter).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-right space-x-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={transaction.type === 'usage'}
                            title={transaction.type === 'usage' ? 'Usage transactions cannot be edited' : undefined}
                            onClick={() => handleOpenEditTransaction(transaction)}
                            className="h-7 px-2.5 border-[#e5e7eb] hover:bg-gray-50 text-[11px] font-medium text-gray-700 rounded-md transition-colors"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deleteTransactionMutation.isPending}
                            onClick={() => handleDeleteTransaction(transaction)}
                            className="h-7 px-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 text-[11px] font-medium rounded-md transition-colors"
                          >
                            {deleteTransactionMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Delete'
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Bookings */}
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-100 py-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">Associated Bookings</CardTitle>
            <CardDescription className="text-xs text-gray-400 mt-0.5">
              All bookings associated with this client
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {bookingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : clientBookings.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No bookings found for this client.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full border-collapse">
                  <thead className="bg-[#f9fafb]">
                    <tr className="border-b border-[#e5e7eb]">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Code</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Hotel</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Check-in</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Check-out</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Meal Plan</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Status</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Total</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Created</th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {clientBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-xs font-semibold text-[#111111] font-mono">{booking.code}</td>
                        <td className="px-6 py-3.5 text-xs text-gray-700">{booking.hotelName}</td>
                        <td className="px-6 py-3.5 text-xs text-gray-600 font-mono">{formatDate(booking.checkIn)}</td>
                        <td className="px-6 py-3.5 text-xs text-gray-600 font-mono">{formatDate(booking.checkOut)}</td>
                        <td className="px-6 py-3.5 text-xs text-gray-600">{booking.mealPlan}</td>
                        <td className="px-6 py-3.5 text-xs">
                          <Badge variant="outline" className={`text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-none ${getBookingStatusColor(booking.bookingStatus)}`}>
                            {booking.bookingStatus}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5 text-xs font-semibold text-[#111111] font-mono">
                          {formatCurrency(booking.totalAmount.toString(), 'SAR')}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-gray-500 font-mono">{formatDate(booking.createdAt)}</td>
                        <td className="px-6 py-3.5 text-xs text-right">
                          <Link
                            to="/booking-detail"
                            search={{ id: booking.id.toString() }}
                            className="inline-flex items-center justify-center h-7 px-3 border border-[#e5e7eb] hover:bg-gray-50 text-[11px] font-semibold text-[#111111] rounded-md transition-colors shadow-sm bg-white"
                          >
                            View Booking
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
