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

  const { data: transportationBookings = [], isLoading, error } = useTransportationBookings();

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200/50";
      case "confirmed":
        return "bg-blue-50 text-blue-700 border-blue-200/50";
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/50";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-200/50";
      default:
        return "bg-zinc-50 text-zinc-700 border-zinc-200/50";
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

  const actions = (
    <Button
      onClick={() => navigate({ to: "/create-transportation-booking" })}
      className="bg-[#111111] hover:bg-[#242424] text-white flex items-center space-x-2 h-9 px-4 rounded-md font-medium text-sm transition-colors border border-transparent shadow-sm"
    >
      <Plus className="h-4 w-4 mr-2" />
      Buat Pemesanan
    </Button>
  );

  return (
    <PageLayout
      title="Pemesanan Transportasi"
      subtitle="Kelola pemesanan layanan transportasi"
      actions={actions}
    >
      <div className="space-y-6">

        {/* Filters */}
        <Card className="p-4 border border-[#e5e7eb] rounded-xl bg-white shadow-none">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Cari berdasarkan nomor booking, nama, atau telepon..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-zinc-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm text-zinc-800"
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
            <Card className="p-8 text-center border border-[#e5e7eb] rounded-xl bg-white shadow-none">
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
                <p className="text-zinc-500 text-sm font-medium">Memuat data pemesanan transportasi...</p>
              </div>
            </Card>
          ) : error ? (
            <Card className="p-8 text-center border border-[#e5e7eb] rounded-xl bg-white shadow-none">
              <p className="text-red-500 text-sm font-medium">Gagal memuat data pemesanan transportasi.</p>
            </Card>
          ) : filteredBookings.length === 0 ? (
            <Card className="p-8 text-center border border-[#e5e7eb] rounded-xl bg-white shadow-none">
              <p className="text-zinc-400 text-sm italic">Tidak ada pemesanan transportasi yang ditemukan.</p>
            </Card>
          ) : (
            filteredBookings.map((booking) => (
              <Card key={booking.id} className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white hover:border-[#111111] transition-all duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <h3 className="text-base font-bold text-zinc-950 tracking-tight">
                        {booking.number}
                      </h3>
                      <Badge variant="outline" className={`text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-none capitalize ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <div>
                        <span className="font-bold text-zinc-700">Customer:</span> <span className="text-zinc-900 normal-case">{booking.customerName}</span>
                      </div>
                      <div>
                        <span className="font-bold text-zinc-700">Phone:</span> <span className="text-zinc-900 normal-case">{booking.customerPhone}</span>
                      </div>
                      <div>
                        <span className="font-bold text-zinc-700">Routes:</span> <span className="text-zinc-900 normal-case">{booking.routeCount} rute</span>
                      </div>
                    </div>

                    {booking.routes && booking.routes.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-zinc-100/50 space-y-1.5">
                        {booking.routes.map((route, rIndex) => (
                          <div key={route.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-700 bg-zinc-50/60 border border-zinc-100 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-zinc-50">
                            <span className="font-bold text-zinc-600 uppercase text-[9px] bg-zinc-200/50 px-1.5 py-0.5 rounded shrink-0">
                              Rute #{rIndex + 1}
                            </span>
                            <span className="font-semibold text-zinc-800">{route.originLocation}</span>
                            <span className="text-zinc-400 font-normal">→</span>
                            <span className="font-semibold text-zinc-800">{route.destinationLocation}</span>
                            <span className="text-zinc-400 font-normal">•</span>
                            <span className="text-[10px] bg-zinc-100 border border-zinc-200/40 text-zinc-700 font-bold px-2 py-0.5 rounded capitalize">
                              {route.vehicleType}
                            </span>
                            <span className="text-zinc-400 font-normal ml-auto shrink-0 text-[10px]">
                              {formatDate(route.pickupDateTime)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
                      <div className="text-xs text-zinc-400 font-medium">
                        Created: {formatDate(booking.createdAt)}
                      </div>
                      <div className="text-base font-bold text-zinc-950">
                        {formatCurrency(booking.totalAmount.toString(), booking.currency)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 sm:ml-4 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate({ to: `/transportation-booking-detail/${booking.id}` })}
                      className="h-8 w-8 p-0 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-black rounded-md flex items-center justify-center transition-colors"
                      title="Lihat Detail"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate({ to: `/transportation-booking-edit/${booking.id}` })}
                      className="h-8 w-8 p-0 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-black rounded-md flex items-center justify-center transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-3.5 w-3.5" />
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
                      className="h-8 w-8 p-0 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-black rounded-md flex items-center justify-center transition-colors"
                      title="Unduh Invoice"
                    >
                      <FileText className="h-3.5 w-3.5" />
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
                      className="h-8 w-8 p-0 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-black rounded-md flex items-center justify-center transition-colors"
                      title="Unduh Kwitansi"
                    >
                      <Receipt className="h-3.5 w-3.5" />
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