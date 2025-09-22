import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  FileText,
  Download,
  Eye,
  Plus,
  Filter,
  Loader2
} from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate, getPaymentStatusColor } from "@/lib/utils"
import { useInvoices, type Invoice } from "@/lib/queries/invoices"

export const Route = createFileRoute("/invoices")({ 
  component: InvoicesPage
})

// Mock invoices data
const mockInvoices = [
  {
    id: 1,
    number: "INV-2024-001",
    clientName: "John Doe",
    clientEmail: "john@example.com",
    bookingCode: "BK001",
    amount: "2500000",
    currency: "IDR",
    status: "paid",
    issueDate: "2024-01-16",
    dueDate: "2024-01-30",
    paidDate: "2024-01-18",
    pdfUrl: "/invoices/INV-2024-001.pdf",
    notes: "Payment received via bank transfer"
  },
  {
    id: 2,
    number: "INV-2024-002",
    clientName: "Jane Smith",
    clientEmail: "jane@example.com",
    bookingCode: "BK002",
    amount: "3200000",
    currency: "IDR",
    status: "pending",
    issueDate: "2024-01-17",
    dueDate: "2024-01-31",
    paidDate: null,
    pdfUrl: "/invoices/INV-2024-002.pdf",
    notes: null
  },
  {
    id: 3,
    number: "INV-2024-003",
    clientName: "Bob Johnson",
    clientEmail: "bob@example.com",
    bookingCode: "BK003",
    amount: "1800000",
    currency: "IDR",
    status: "paid",
    issueDate: "2024-01-18",
    dueDate: "2024-02-01",
    paidDate: "2024-01-20",
    pdfUrl: "/invoices/INV-2024-003.pdf",
    notes: "Payment received via credit card"
  },
  {
    id: 4,
    number: "INV-2024-004",
    clientName: "Alice Brown",
    clientEmail: "alice@example.com",
    bookingCode: "BK004",
    amount: "2800000",
    currency: "IDR",
    status: "overdue",
    issueDate: "2024-01-10",
    dueDate: "2024-01-24",
    paidDate: null,
    pdfUrl: "/invoices/INV-2024-004.pdf",
    notes: "Follow-up required"
  },
  {
    id: 5,
    number: "INV-2024-005",
    clientName: "Charlie Wilson",
    clientEmail: "charlie@example.com",
    bookingCode: "BK005",
    amount: "1500000",
    currency: "IDR",
    status: "paid",
    issueDate: "2024-01-19",
    dueDate: "2024-02-02",
    paidDate: "2024-01-21",
    pdfUrl: "/invoices/INV-2024-005.pdf",
    notes: "Payment received via bank transfer"
  }
]

function InvoicesPage() {
  // Fetch invoices using TanStack Query
  const { data: invoices = [], isLoading, error } = useInvoices()

  // Define columns for invoices table
  const invoiceColumns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Invoice Number',
      sortable: true,
      width: 'w-36'
    },
    {
      key: 'clientName',
      header: 'Client',
      sortable: true
    },
    {
      key: 'bookingCode',
      header: 'Booking',
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'bookingId',
      header: 'Booking ID',
      render: (invoice) => (
        <Link 
          to="/bookings/$bookingId" 
          params={{ bookingId: invoice.bookingId.toString() }}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          #{invoice.bookingId}
        </Link>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (invoice) => formatCurrency(invoice.amount, invoice.currency),
      sortable: true,
      width: 'w-32'
    },
    {
      key: 'status',
      header: 'Status',
      render: (invoice) => (
        <Badge className={getInvoiceStatusColor(invoice.status)}>
          {invoice.status}
        </Badge>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'issueDate',
      header: 'Issue Date',
      render: (invoice) => formatDate(invoice.issueDate),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (invoice) => formatDate(invoice.dueDate),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (invoice) => (
        <div className="flex space-x-2">
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => handleViewInvoice(invoice)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => handleDownloadPDF(invoice)}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: 'w-24'
    }
  ]

  const handleViewInvoice = async (invoice: Invoice) => {
    try {
      // Use the new endpoint that auto-creates invoice if not exists
      const response = await fetch(`http://localhost:3000/api/invoices/booking/${invoice.bookingCode}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get invoice: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data.pdfUrl) {
        window.open(result.data.pdfUrl, '_blank');
      } else {
        console.error("No PDF URL found in response");
      }
    } catch (error) {
      console.error("Error viewing invoice:", error);
      // Fallback to original method
      window.open(invoice.pdfUrl, '_blank');
    }
  }

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      // Use the new endpoint that auto-creates invoice if not exists
      const response = await fetch(`http://localhost:3000/api/invoices/booking/${invoice.bookingCode}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get invoice: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data.pdfUrl) {
        // Download the PDF
        const downloadResponse = await fetch(result.data.pdfUrl, {
          method: 'GET',
          credentials: 'include',
        });

        if (!downloadResponse.ok) {
          throw new Error(`Download failed: ${downloadResponse.status}`);
        }

        const blob = await downloadResponse.blob();
        
        // Create download link
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${result.data.number || invoice.number}.pdf`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        console.error("No PDF URL found in response");
      }
    } catch (error) {
      console.error("Error downloading invoice:", error);
      // Fallback to original method
      const link = document.createElement('a');
      link.href = invoice.pdfUrl;
      link.download = `${invoice.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Calculate summary stats
  const totalInvoices = invoices.length
  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending').length
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length
  const totalAmount = invoices.reduce((sum, inv) => sum + parseInt(inv.amount), 0)
  const paidAmount = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + parseInt(inv.amount), 0)

  return (
    <PageLayout
      title="Invoices"
      subtitle="Manage invoices and payment tracking"
      actions={
        <div className="flex space-x-3">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Link to="/invoices/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </Link>
        </div>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Invoices</p>
              <p className="text-3xl font-bold text-gray-900">{totalInvoices}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Paid</p>
              <p className="text-3xl font-bold text-green-600">{paidInvoices}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{pendingInvoices}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <FileText className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-3xl font-bold text-red-600">{overdueInvoices}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <FileText className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Revenue</h3>
          <p className="text-3xl font-bold text-blue-600">
            {formatCurrency(totalAmount.toString(), 'IDR')}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            From {totalInvoices} invoices
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Collected Revenue</h3>
          <p className="text-3xl font-bold text-green-600">
            {formatCurrency(paidAmount.toString(), 'IDR')}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            From {paidInvoices} paid invoices
          </p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Invoices</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading invoices...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-red-600">Error loading invoices. Please try again.</p>
          </div>
        ) : (
          <DataTable
            data={invoices}
            columns={invoiceColumns}
            emptyMessage="No invoices found"
          />
        )}
      </div>
    </PageLayout>
  )
}