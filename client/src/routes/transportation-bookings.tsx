import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Search, Filter, Eye, Edit, FileText, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/layout/PageLayout";
import { formatCurrency, formatDate } from "@/lib/utils";
import { authService } from "@/lib/auth";
import { useTransportationBookings } from "@/lib/queries/transportationBookings";

export const Route = createFileRoute("/transportation-bookings")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: TransportationBookingsPage,
});

function TransportationBookingsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch transportation bookings from API
  const { data: transportationBookings = [], isLoading, error } = useTransportationBookings();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "confirmed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const filteredBookings = transportationBookings.filter((booking) => {
    const matchesSearch =
      booking.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customerPhone.includes(searchTerm);

    const matchesStatus = statusFilter === "all" || booking.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <PageLayout title="Pemesanan Transportasi">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pemesanan Transportasi</h1>
            <p className="text-gray-600">Kelola pemesanan layanan transportasi</p>
          </div>
          <Button
            onClick={() => navigate({ to: "/create-transportation-booking" })}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Pemesanan</span>
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Cari berdasarkan nomor booking, nama, atau telepon..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Bookings List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card className="p-8 text-center">
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-gray-500">Memuat data pemesanan transportasi...</p>
              </div>
            </Card>
          ) : error ? (
            <Card className="p-8 text-center">
              <p className="text-red-500">Gagal memuat data pemesanan transportasi.</p>
            </Card>
          ) : filteredBookings.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">Tidak ada pemesanan transportasi yang ditemukan.</p>
            </Card>
          ) : (
            filteredBookings.map((booking) => (
              <Card key={booking.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {booking.number}
                      </h3>
                      <Badge className={getStatusColor(booking.status)}>
                        {booking.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Customer:</span> {booking.customerName}
                      </div>
                      <div>
                        <span className="font-medium">Phone:</span> {booking.customerPhone}
                      </div>
                      <div>
                        <span className="font-medium">Routes:</span> {booking.routeCount} rute
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-500">
                        Created: {formatDate(booking.createdAt)}
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatCurrency(booking.totalAmount.toString(), booking.currency)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate({ to: `/transportation-booking-detail/${booking.id}` })}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate({ to: `/transportation-booking-edit/${booking.id}` })}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/transportation/${booking.id}/invoice`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                          });

                          if (response.ok) {
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = url;
                            a.download = `transportation-invoice-${booking.number}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            toast.success('Invoice generated and downloaded successfully!');
                          } else {
                            let errorMsg = 'Failed to generate invoice';
                            try {
                              const errData = await response.json();
                              errorMsg = errData.error || errData.message || errorMsg;
                            } catch (_) { }
                            toast.error(errorMsg);
                          }
                        } catch (error) {
                          console.error('Error generating invoice:', error);
                          const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
                          toast.error(msg);
                        }
                      }}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/transportation/${booking.id}/receipt`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                          });

                          if (response.ok) {
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = url;
                            a.download = `transportation-receipt-${booking.number}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            toast.success('Receipt generated and downloaded successfully!');
                          } else {
                            let errorMsg = 'Failed to generate receipt';
                            try {
                              const errData = await response.json();
                              errorMsg = errData.error || errData.message || errorMsg;
                            } catch (_) { }
                            toast.error(errorMsg);
                          }
                        } catch (error) {
                          console.error('Error generating receipt:', error);
                          const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
                          toast.error(msg);
                        }
                      }}
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </PageLayout>
  );
}