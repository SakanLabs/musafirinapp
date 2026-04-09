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
      return 'bg-green-100 text-green-800 border-green-200'
    case 'refund':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'usage':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getBookingStatusColor(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
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
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Active
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: '/clients' })}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Clients</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* Client Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Client Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <Mail className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{client.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Phone className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{client.phone}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <MapPin className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">{client.address}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium">
                  {new Date(client.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deposit Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {balanceLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  `SAR ${depositBalance?.currentBalance ? parseFloat(depositBalance.currentBalance).toFixed(2) : '0.00'}`
                )}
              </div>
              <p className="text-xs text-muted-foreground">Available deposit balance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deposited</CardTitle>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {balanceLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  `SAR ${depositBalance?.totalDeposited ? parseFloat(depositBalance.totalDeposited).toFixed(2) : '0.00'}`
                )}
              </div>
              <p className="text-xs text-muted-foreground">Lifetime deposits</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Used</CardTitle>
              <Minus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {balanceLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  `SAR ${depositBalance?.totalUsed ? parseFloat(depositBalance.totalUsed).toFixed(2) : '0.00'}`
                )}
              </div>
              <p className="text-xs text-muted-foreground">Total amount used</p>
            </CardContent>
          </Card>
        </div>

        {/* Deposit Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Deposit Management</CardTitle>
            <CardDescription>
              Manage client deposits, refunds, and balance adjustments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                className="flex items-center space-x-2"
                disabled={addDepositMutation.isPending}
                onClick={() => setIsAddDepositOpen(true)}
              >
                {addDepositMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>Add Deposit</span>
              </Button>


            </div>
          </CardContent>
        </Card>

        {/* Add Deposit Modal */}
        {isAddDepositOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Add Deposit</h3>
              <form onSubmit={handleAddDeposit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (SAR) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={depositFormData.amount}
                      onChange={(e) => setDepositFormData(prev => ({ ...prev, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referenceNumber">Reference Number</Label>
                    <Input
                      id="referenceNumber"
                      placeholder="Optional reference"
                      value={depositFormData.referenceNumber}
                      onChange={(e) => setDepositFormData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the deposit..."
                    value={depositFormData.description}
                    onChange={(e) => setDepositFormData(prev => ({ ...prev, description: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDepositOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addDepositMutation.isPending}
                  >
                    {addDepositMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Edit Transaction</h3>
              {selectedTransaction && (
                <div className="mb-4 text-sm text-gray-600">
                  <div>Type: {selectedTransaction.type}</div>
                  <div>Amount: SAR {selectedTransaction.amount ? parseFloat(selectedTransaction.amount).toFixed(2) : '0.00'}</div>
                  <div>Date: {new Date(selectedTransaction.createdAt).toLocaleDateString()}</div>
                </div>
              )}
              <form onSubmit={handleUpdateTransaction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editAmount">Amount (SAR)</Label>
                  <Input
                    id="editAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={editTxFormData.amount}
                    onChange={(e) => setEditTxFormData(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editDescription">Description</Label>
                  <Textarea
                    id="editDescription"
                    placeholder="Update description..."
                    value={editTxFormData.description}
                    onChange={(e) => setEditTxFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editReferenceNumber">Reference Number</Label>
                  <Input
                    id="editReferenceNumber"
                    placeholder="Optional reference"
                    value={editTxFormData.referenceNumber}
                    onChange={(e) => setEditTxFormData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditTxOpen(false)
                      setSelectedTransaction(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateTransactionMutation.isPending}
                  >
                    {updateTransactionMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              Recent deposit transactions and balance changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No transactions found for this client.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Amount</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-left p-2">Reference</th>
                      <th className="text-left p-2">Balance After</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b">
                        <td className="p-2">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-2">
                          <Badge className={getTransactionTypeColor(transaction.type)}>
                            {transaction.type.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className={`p-2 ${transaction.type === 'deposit' || transaction.type === 'adjustment'
                          ? 'text-green-600 font-medium'
                          : 'text-red-600 font-medium'
                          }`}>
                          {transaction.type === 'deposit' || transaction.type === 'adjustment' ? '+' : '-'}
                          SAR {transaction.amount ? Math.abs(parseFloat(transaction.amount)).toFixed(2) : '0.00'}
                        </td>
                        <td className="p-2">{transaction.description}</td>
                        <td className="p-2">{transaction.referenceNumber || '-'}</td>
                        <td className="p-2">SAR {transaction.balanceAfter ? parseFloat(transaction.balanceAfter).toFixed(2) : '0.00'}</td>
                        <td className="p-2 space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={transaction.type === 'usage'}
                            title={transaction.type === 'usage' ? 'Usage transactions cannot be edited' : undefined}
                            onClick={() => handleOpenEditTransaction(transaction)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deleteTransactionMutation.isPending}
                            onClick={() => handleDeleteTransaction(transaction)}
                          >
                            {deleteTransactionMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
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
        <Card>
          <CardHeader>
            <CardTitle>Bookings</CardTitle>
            <CardDescription>
              All bookings associated with this client
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : clientBookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No bookings found for this client.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Code</th>
                      <th className="text-left p-2">Hotel</th>
                      <th className="text-left p-2">Check-in</th>
                      <th className="text-left p-2">Check-out</th>
                      <th className="text-left p-2">Meal Plan</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Total</th>
                      <th className="text-left p-2">Created</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientBookings.map((booking) => (
                      <tr key={booking.id} className="border-b">
                        <td className="p-2 font-medium">{booking.code}</td>
                        <td className="p-2">{booking.hotelName}</td>
                        <td className="p-2">{formatDate(booking.checkIn)}</td>
                        <td className="p-2">{formatDate(booking.checkOut)}</td>
                        <td className="p-2">{booking.mealPlan}</td>
                        <td className="p-2">
                          <Badge className={getBookingStatusColor(booking.bookingStatus)}>
                            {booking.bookingStatus}
                          </Badge>
                        </td>
                        <td className="p-2 font-medium">
                          {formatCurrency(booking.totalAmount.toString(), 'SAR')}
                        </td>
                        <td className="p-2">{formatDate(booking.createdAt)}</td>
                        <td className="p-2">
                          <Link
                            to="/booking-detail"
                            search={{ id: booking.id.toString() }}
                            className="text-primary hover:underline"
                          >
                            View
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
