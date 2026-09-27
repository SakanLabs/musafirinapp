import { createFileRoute, Link } from "@tanstack/react-router";
import { AgentPageLayout } from "@/components/layout/AgentPageLayout";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { authService } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ClipboardList,
  Clock,
  MessageSquareQuote,
  CreditCard,
  CheckCircle2,
  Plus,
  ArrowRight,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/agent/dashboard")({
  component: AgentDashboardPage,
});

interface Stats {
  total: number;
  processing: number;
  quoted: number;
  payment: number;
  completed: number;
}

interface AgentRequest {
  id: number;
  requestNumber: string;
  serviceType: string;
  status: string;
  title: string;
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
  in_review: { label: "Sedang Diproses", class: "bg-indigo-50 text-indigo-700 border-indigo-200/50" },
  quoted: { label: "Ada Penawaran", class: "bg-purple-50 text-purple-700 border-purple-200/50" },
  quote_revision_requested: { label: "Revisi Penawaran", class: "bg-orange-50 text-orange-700 border-orange-200/50" },
  quote_accepted: { label: "Diterima", class: "bg-emerald-50 text-emerald-700 border-emerald-200/50" },
  invoiced: { label: "Invoice Terbit", class: "bg-cyan-50 text-cyan-700 border-cyan-200/50" },
  payment_uploaded: { label: "Menunggu Verifikasi", class: "bg-yellow-50 text-yellow-700 border-yellow-200/50" },
  paid: { label: "Terbayar", class: "bg-green-50 text-green-700 border-green-200/50" },
  voucher_issued: { label: "Voucher Terbit", class: "bg-teal-50 text-teal-700 border-teal-200/50" },
  completed: { label: "Selesai", class: "bg-emerald-50 text-emerald-800 border-emerald-200/50" },
  cancelled: { label: "Dibatalkan", class: "bg-red-50 text-red-700 border-red-200/50" },
  rejected: { label: "Ditolak", class: "bg-red-50 text-red-600 border-red-200/50" },
};

function AgentDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentRequests, setRecentRequests] = useState<AgentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const user = await authService.getCurrentUser();
      if (user) setUserName(user.name);

      const [statsRes, requestsRes] = await Promise.all([
        apiClient.get<any>("/api/agent-requests/stats"),
        apiClient.get<any>("/api/agent-requests"),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (requestsRes.success) setRecentRequests(requestsRes.data.slice(0, 5));
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AgentPageLayout title="Dashboard" subtitle="Agent Portal">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </AgentPageLayout>
    );
  }

  const statCards = [
    { label: "Total Request", value: stats?.total || 0, icon: ClipboardList, color: "text-[#111111]", bg: "bg-[#f5f5f5]" },
    { label: "Sedang Diproses", value: stats?.processing || 0, icon: Clock, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Menunggu Penawaran", value: stats?.quoted || 0, icon: MessageSquareQuote, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Menunggu Pembayaran", value: stats?.payment || 0, icon: CreditCard, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Selesai", value: stats?.completed || 0, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <AgentPageLayout
      title="Dashboard"
      subtitle="Agent Portal — Selamat datang kembali"
      actions={
        <Link to="/agent/create-request">
          <Button size="sm" className="bg-[#111111] hover:bg-[#242424] text-white rounded-md text-xs font-semibold h-9 px-4">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Buat Request
          </Button>
        </Link>
      }
    >
      <div className="space-y-8 max-w-6xl">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#111111] to-[#333333] rounded-xl p-6 text-white">
          <h2 className="text-xl font-bold tracking-tight">
            Halo, {userName}! 👋
          </h2>
          <p className="text-white/70 text-sm mt-1">
            Kelola semua permintaan layanan Umrah Anda dari satu tempat. Buat request baru atau lacak progress request yang sudah ada.
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map((stat) => (
            <Card key={stat.label} className="p-4 border border-[#e5e7eb] rounded-lg shadow-none hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#111111] tracking-tight">{stat.value}</p>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">{stat.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Recent Requests */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#111111] tracking-tight">Request Terbaru</h3>
            <Link to="/agent/requests" className="text-xs text-gray-500 hover:text-[#111111] font-medium flex items-center gap-1 transition-colors">
              Lihat Semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentRequests.length === 0 ? (
            <Card className="p-8 border border-[#e5e7eb] rounded-lg shadow-none text-center">
              <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Belum ada request</p>
              <p className="text-xs text-gray-400 mt-1">Buat request pertama Anda untuk kebutuhan layanan Umrah</p>
              <Link to="/agent/create-request">
                <Button size="sm" className="mt-4 bg-[#111111] hover:bg-[#242424] text-white rounded-md text-xs font-semibold">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Buat Request
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentRequests.map((req) => {
                const sc = statusConfig[req.status] || statusConfig.draft;
                return (
                  <Link key={req.id} to="/agent/request/$requestId" params={{ requestId: req.id.toString() }}>
                    <Card className="p-4 border border-[#e5e7eb] rounded-lg shadow-none hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-[#f5f5f5] flex items-center justify-center shrink-0">
                            <ClipboardList className="h-4 w-4 text-gray-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#111111] font-mono">{req.requestNumber}</span>
                              <Badge variant="outline" className={`text-[9px] font-semibold py-0 px-1.5 rounded shadow-none capitalize ${sc.class}`}>
                                {serviceTypeLabels[req.serviceType] || req.serviceType}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5 truncate">{req.title}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant="outline" className={`text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-none ${sc.class}`}>
                            {sc.label}
                          </Badge>
                          <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AgentPageLayout>
  );
}
