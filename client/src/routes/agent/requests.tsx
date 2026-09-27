import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AgentPageLayout } from "@/components/layout/AgentPageLayout";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Filter,
  ClipboardList,
  Loader2,
  Eye,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/agent/requests")({
  component: AgentRequestsPage,
});

interface AgentRequest {
  id: number;
  requestNumber: string;
  serviceType: string;
  status: string;
  title: string;
  description: string | null;
  totalAmount: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

const serviceTypeLabels: Record<string, string> = {
  hotel: "Hotel",
  transportation: "Transportasi",
  muthowif: "Muthowif",
  visa: "Visa Umrah",
  siskopatuh: "Siskopatuh",
  custom_la: "Paket LA",
};

const statusConfig: Record<string, { label: string; class: string }> = {
  draft: { label: "Draft", class: "bg-gray-50 text-gray-600 border-gray-200/50" },
  submitted: { label: "Terkirim", class: "bg-blue-50 text-blue-700 border-blue-200/50" },
  need_more_info: { label: "Butuh Info", class: "bg-amber-50 text-amber-700 border-amber-200/50" },
  in_review: { label: "Diproses", class: "bg-indigo-50 text-indigo-700 border-indigo-200/50" },
  quoted: { label: "Ada Penawaran", class: "bg-purple-50 text-purple-700 border-purple-200/50" },
  quote_revision_requested: { label: "Revisi", class: "bg-orange-50 text-orange-700 border-orange-200/50" },
  quote_accepted: { label: "Diterima", class: "bg-emerald-50 text-emerald-700 border-emerald-200/50" },
  invoiced: { label: "Invoice", class: "bg-cyan-50 text-cyan-700 border-cyan-200/50" },
  payment_uploaded: { label: "Verifikasi", class: "bg-yellow-50 text-yellow-700 border-yellow-200/50" },
  paid: { label: "Terbayar", class: "bg-green-50 text-green-700 border-green-200/50" },
  voucher_issued: { label: "Voucher", class: "bg-teal-50 text-teal-700 border-teal-200/50" },
  completed: { label: "Selesai", class: "bg-emerald-50 text-emerald-800 border-emerald-200/50" },
  cancelled: { label: "Batal", class: "bg-red-50 text-red-700 border-red-200/50" },
  rejected: { label: "Ditolak", class: "bg-red-50 text-red-600 border-red-200/50" },
};

const serviceTypeOptions = [
  { value: "", label: "Semua Layanan" },
  { value: "hotel", label: "Hotel" },
  { value: "transportation", label: "Transportasi" },
  { value: "muthowif", label: "Muthowif" },
  { value: "visa", label: "Visa Umrah" },
  { value: "siskopatuh", label: "Siskopatuh" },
  { value: "custom_la", label: "Paket LA" },
];

const statusOptions = [
  { value: "", label: "Semua Status" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Terkirim" },
  { value: "in_review", label: "Sedang Diproses" },
  { value: "quoted", label: "Ada Penawaran" },
  { value: "invoiced", label: "Invoice Terbit" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

function AgentRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterServiceType, setFilterServiceType] = useState("");

  useEffect(() => {
    loadRequests();
  }, [filterStatus, filterServiceType]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterServiceType) params.set("serviceType", filterServiceType);
      const qs = params.toString() ? `?${params.toString()}` : "";

      const res = await apiClient.get<any>(`/api/agent-requests${qs}`);
      if (res.success) setRequests(res.data);
    } catch (error) {
      console.error("Failed to load requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = requests.filter((req) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      req.requestNumber.toLowerCase().includes(s) ||
      req.title.toLowerCase().includes(s) ||
      (serviceTypeLabels[req.serviceType] || "").toLowerCase().includes(s)
    );
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: string | null, currency: string) => {
    if (!amount) return "-";
    return `${currency} ${Number(amount).toLocaleString("id-ID")}`;
  };

  return (
    <AgentPageLayout
      title="Request Saya"
      subtitle="Semua permintaan layanan Anda"
      actions={
        <Link to="/agent/create-request">
          <Button size="sm" className="bg-[#111111] hover:bg-[#242424] text-white rounded-md text-xs font-semibold h-9 px-4">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Buat Request
          </Button>
        </Link>
      }
    >
      <div className="space-y-4 max-w-6xl">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari nomor request atau judul..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-9 text-sm border-[#e5e7eb] rounded-md"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={filterServiceType}
                onChange={(e) => setFilterServiceType(e.target.value)}
                className="h-9 px-3 pr-8 text-xs font-medium border border-[#e5e7eb] rounded-md bg-white text-[#111111] appearance-none cursor-pointer focus:ring-1 focus:ring-[#111111] focus:border-[#111111] outline-none"
              >
                {serviceTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 px-3 pr-8 text-xs font-medium border border-[#e5e7eb] rounded-md bg-white text-[#111111] appearance-none cursor-pointer focus:ring-1 focus:ring-[#111111] focus:border-[#111111] outline-none"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Request List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 border border-[#e5e7eb] rounded-lg shadow-none text-center">
            <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-500">
              {search || filterStatus || filterServiceType ? "Tidak ada request yang cocok" : "Belum ada request"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {search || filterStatus || filterServiceType ? "Coba ubah filter pencarian" : "Buat request pertama Anda"}
            </p>
            {!search && !filterStatus && !filterServiceType && (
              <Link to="/agent/create-request">
                <Button size="sm" className="mt-4 bg-[#111111] hover:bg-[#242424] text-white rounded-md text-xs font-semibold">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Buat Request
                </Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f8f9fa] border-b border-[#e5e7eb]">
                  <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 py-3">No. Request</th>
                  <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 py-3">Layanan</th>
                  <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Judul</th>
                  <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Total</th>
                  <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Tanggal</th>
                  <th className="text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 py-3 w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {filtered.map((req) => {
                  const sc = statusConfig[req.status] || statusConfig.draft;
                  return (
                    <tr key={req.id} className="hover:bg-[#f8f9fa] transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-[#111111] font-mono">{req.requestNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[9px] font-semibold py-0 px-1.5 rounded shadow-none bg-[#f5f5f5] text-gray-700 border-gray-200/50">
                          {serviceTypeLabels[req.serviceType] || req.serviceType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-gray-700 truncate block max-w-[200px]">{req.title}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-none ${sc.class}`}>
                          {sc.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs font-medium text-gray-700">
                          {formatCurrency(req.totalAmount, req.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-500">{formatDate(req.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate({ to: "/agent/request/$requestId", params: { requestId: req.id.toString() } })}
                          className="h-7 px-2 text-[10px] font-medium border-[#e5e7eb] hover:bg-gray-50 rounded-md"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Detail
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AgentPageLayout>
  );
}
