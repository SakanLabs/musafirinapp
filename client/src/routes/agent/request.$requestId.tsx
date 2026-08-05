import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AgentPageLayout } from "@/components/layout/AgentPageLayout";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ClipboardList,
  Check,
  Clock,
  MessageSquare,
  CreditCard,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/agent/request/$requestId")({
  component: RequestDetailPage,
});

const serviceTypeLabels: Record<string, string> = {
  hotel: "Hotel",
  transportation: "Transportasi",
  muthowif: "Muthowif",
  visa: "Visa Umrah",
  siskopatuh: "Siskopatuh",
  custom_la: "Paket LA",
};

const statusConfig: Record<string, { label: string; class: string; step: number }> = {
  draft: { label: "Draft", class: "bg-gray-50 text-gray-600 border-gray-200/50", step: 0 },
  submitted: { label: "Terkirim", class: "bg-blue-50 text-blue-700 border-blue-200/50", step: 1 },
  need_more_info: { label: "Butuh Info Tambahan", class: "bg-amber-50 text-amber-700 border-amber-200/50", step: 1 },
  in_review: { label: "Sedang Diproses", class: "bg-indigo-50 text-indigo-700 border-indigo-200/50", step: 2 },
  quoted: { label: "Ada Penawaran", class: "bg-purple-50 text-purple-700 border-purple-200/50", step: 3 },
  quote_revision_requested: { label: "Revisi Penawaran", class: "bg-orange-50 text-orange-700 border-orange-200/50", step: 3 },
  quote_accepted: { label: "Penawaran Diterima", class: "bg-emerald-50 text-emerald-700 border-emerald-200/50", step: 4 },
  invoiced: { label: "Invoice Terbit", class: "bg-cyan-50 text-cyan-700 border-cyan-200/50", step: 4 },
  payment_uploaded: { label: "Menunggu Verifikasi", class: "bg-yellow-50 text-yellow-700 border-yellow-200/50", step: 4 },
  paid: { label: "Terbayar", class: "bg-green-50 text-green-700 border-green-200/50", step: 5 },
  voucher_issued: { label: "Voucher Terbit", class: "bg-teal-50 text-teal-700 border-teal-200/50", step: 5 },
  completed: { label: "Selesai", class: "bg-emerald-50 text-emerald-800 border-emerald-200/50", step: 6 },
  cancelled: { label: "Dibatalkan", class: "bg-red-50 text-red-700 border-red-200/50", step: -1 },
  rejected: { label: "Ditolak", class: "bg-red-50 text-red-600 border-red-200/50", step: -1 },
};

const progressSteps = [
  { label: "Request Dibuat", icon: ClipboardList },
  { label: "Terkirim", icon: Send },
  { label: "Diproses", icon: Clock },
  { label: "Penawaran", icon: MessageSquare },
  { label: "Pembayaran", icon: CreditCard },
  { label: "Dokumen", icon: FileText },
  { label: "Selesai", icon: CheckCircle2 },
];

function RequestDetailPage() {
  const { requestId } = Route.useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);

  useEffect(() => {
    loadRequest();
  }, [requestId]);

  const loadRequest = async () => {
    try {
      setLoading(true);
      const [res, invoiceRes] = await Promise.all([
        apiClient.get<any>(`/api/agent-requests/${requestId}`),
        apiClient.get<any>(`/api/agent-requests/${requestId}/invoice`).catch(() => null)
      ]);
      if (res.success) setRequest(res.data);
      if (invoiceRes && invoiceRes.success) setInvoice(invoiceRes.data);
      else if (!res.success) toast.error("Request tidak ditemukan");
    } catch (error) {
      toast.error("Gagal memuat detail request");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptQuotation = async () => {
    setActionLoading("accept");
    try {
      const res = await apiClient.post<any>(`/api/agent-requests/${requestId}/accept-quotation`);
      if (res.success) {
        toast.success("Penawaran berhasil diterima!");
        loadRequest();
      } else toast.error(res.error);
    } catch { toast.error("Gagal menerima penawaran"); }
    finally { setActionLoading(""); }
  };

  const handleRejectQuotation = async () => {
    setActionLoading("reject");
    try {
      const res = await apiClient.post<any>(`/api/agent-requests/${requestId}/reject-quotation`, { reason: "Ditolak oleh agent" });
      if (res.success) {
        toast.success("Penawaran ditolak");
        loadRequest();
      } else toast.error(res.error);
    } catch { toast.error("Gagal menolak penawaran"); }
    finally { setActionLoading(""); }
  };

  const handleRequestRevision = async () => {
    if (!revisionNotes.trim()) {
      toast.error("Masukkan catatan revisi");
      return;
    }
    setActionLoading("revision");
    try {
      const res = await apiClient.post<any>(`/api/agent-requests/${requestId}/request-revision`, { notes: revisionNotes });
      if (res.success) {
        toast.success("Permintaan revisi dikirim");
        setShowRevisionInput(false);
        setRevisionNotes("");
        loadRequest();
      } else toast.error(res.error);
    } catch { toast.error("Gagal mengirim revisi"); }
    finally { setActionLoading(""); }
  };

  const handleSubmitDraft = async () => {
    setActionLoading("submit");
    try {
      const res = await apiClient.post<any>(`/api/agent-requests/${requestId}/submit`);
      if (res.success) {
        toast.success("Request berhasil dikirim ke admin!");
        loadRequest();
      } else toast.error(res.error);
    } catch { toast.error("Gagal mengirim request"); }
    finally { setActionLoading(""); }
  };

  if (loading) {
    return (
      <AgentPageLayout title="Detail Request" showBackButton>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </AgentPageLayout>
    );
  }

  if (!request) {
    return (
      <AgentPageLayout title="Detail Request" showBackButton>
        <div className="text-center py-20">
          <XCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Request tidak ditemukan</p>
        </div>
      </AgentPageLayout>
    );
  }

  const sc = statusConfig[request.status] || statusConfig.draft;
  const currentStep = sc.step;
  const meta = request.meta || {};
  const quotation = request.quotationData;
  const timeline = request.timeline || [];

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <AgentPageLayout
      title={request.requestNumber}
      subtitle={`${serviceTypeLabels[request.serviceType] || request.serviceType} — ${request.title}`}
      showBackButton
    >
      <div className="max-w-4xl space-y-6">
        {/* Status & Progress Stepper */}
        <Card className="p-5 border border-[#e5e7eb] rounded-lg shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs font-semibold py-1 px-3 rounded-md shadow-none ${sc.class}`}>
                {sc.label}
              </Badge>
              <Badge variant="outline" className="text-[9px] font-semibold py-0.5 px-2 rounded shadow-none bg-[#f5f5f5] text-gray-600 border-gray-200/50">
                {serviceTypeLabels[request.serviceType]}
              </Badge>
            </div>
            {request.status === "draft" && (
              <Button size="sm" onClick={handleSubmitDraft} disabled={actionLoading === "submit"} className="h-8 px-3 text-xs font-semibold bg-[#111111] hover:bg-[#242424] text-white rounded-md">
                {actionLoading === "submit" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                Kirim Request
              </Button>
            )}
          </div>

          {/* Progress Stepper */}
          {currentStep >= 0 && (
            <div className="flex items-center justify-between px-2">
              {progressSteps.map((step, i) => (
                <div key={i} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      i <= currentStep
                        ? "bg-[#111111] text-white"
                        : "bg-[#f5f5f5] text-gray-400"
                    }`}>
                      {i < currentStep ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <step.icon className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <span className={`text-[9px] font-medium mt-1.5 text-center max-w-[60px] leading-tight ${
                      i <= currentStep ? "text-[#111111]" : "text-gray-400"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {i < progressSteps.length - 1 && (
                    <div className={`w-6 sm:w-10 h-[2px] mx-1 ${
                      i < currentStep ? "bg-[#111111]" : "bg-[#e5e7eb]"
                    }`} />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Request Detail */}
        <Card className="p-5 border border-[#e5e7eb] rounded-lg shadow-none">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Detail Request</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">No. Request</p>
                <p className="text-sm font-bold text-[#111111] font-mono">{request.requestNumber}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Tanggal Dibuat</p>
                <p className="text-sm text-gray-700">{formatDate(request.createdAt)}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Judul</p>
              <p className="text-sm text-[#111111] font-medium">{request.title}</p>
            </div>
            {request.description && (
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Catatan</p>
                <p className="text-xs text-gray-600">{request.description}</p>
              </div>
            )}

            {/* Meta details */}
            {Object.entries(meta).filter(([_, v]) => v && typeof v !== 'object').length > 0 && (
              <div className="border-t border-[#e5e7eb] pt-3 mt-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Detail Layanan</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(meta).filter(([_, v]) => v && typeof v !== 'object').map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                      <span className="text-[#111111] font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Master Estimated Price */}
        {meta.agentPrice !== undefined && meta.agentPrice > 0 && (
          <Card className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg shadow-none">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">Estimasi Harga (Master)</p>
                <p className="text-sm font-bold text-blue-900">SAR {meta.agentPrice.toLocaleString("id-ID")}</p>
              </div>
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-none text-[10px]">
                Auto Calculated
              </Badge>
            </div>
            <p className="text-[10px] text-blue-500 mt-2">Harga ini adalah estimasi otomatis berdasarkan data master. Harga final akan diberikan oleh Admin pada penawaran resmi.</p>
          </Card>
        )}

        {/* Quotation Section */}
        {quotation && (
          <Card className="p-5 border border-[#e5e7eb] rounded-lg shadow-none">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Penawaran</h3>
              {request.status === "quoted" && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-none bg-purple-50 text-purple-700 border-purple-200/50">
                    Menunggu Respon Anda
                  </Badge>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {/* Quotation details */}
              {typeof quotation === 'object' && Object.entries(quotation as Record<string, any>).map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                  <span className="text-[#111111] font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                </div>
              ))}

              {request.totalAmount && (
                <div className="border-t border-[#e5e7eb] pt-3 mt-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Harga</p>
                  <p className="text-lg font-bold text-[#111111]">
                    {request.currency} {Number(request.totalAmount).toLocaleString("id-ID")}
                  </p>
                </div>
              )}

              {request.quotationNotes && (
                <div className="bg-[#f8f9fa] rounded-md p-3 mt-2">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Catatan Admin</p>
                  <p className="text-xs text-gray-700">{request.quotationNotes}</p>
                </div>
              )}
            </div>

            {/* Quotation Actions */}
            {request.status === "quoted" && (
              <div className="border-t border-[#e5e7eb] pt-4 mt-4">
                {showRevisionInput ? (
                  <div className="space-y-3">
                    <textarea
                      value={revisionNotes}
                      onChange={(e) => setRevisionNotes(e.target.value)}
                      placeholder="Jelaskan revisi yang Anda inginkan..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-md bg-white focus:ring-1 focus:ring-[#111111] outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleRequestRevision} disabled={actionLoading === "revision"} className="h-8 px-3 text-xs font-semibold bg-[#111111] hover:bg-[#242424] text-white rounded-md">
                        {actionLoading === "revision" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                        Kirim Revisi
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowRevisionInput(false)} className="h-8 px-3 text-xs font-semibold border-[#e5e7eb] rounded-md">
                        Batal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAcceptQuotation} disabled={!!actionLoading} className="h-8 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md">
                      {actionLoading === "accept" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ThumbsUp className="h-3 w-3 mr-1" />}
                      Terima Penawaran
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowRevisionInput(true)} disabled={!!actionLoading} className="h-8 px-3 text-xs font-semibold border-orange-200 text-orange-600 hover:bg-orange-50 rounded-md">
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Minta Revisi
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleRejectQuotation} disabled={!!actionLoading} className="h-8 px-3 text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50 rounded-md">
                      {actionLoading === "reject" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ThumbsDown className="h-3 w-3 mr-1" />}
                      Tolak
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Invoice Section */}
        {invoice && (
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-sm">
            <h3 className="text-sm font-bold text-[#111111] mb-4">Invoice / Tagihan</h3>
            <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2.5 rounded-md">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Invoice: {invoice.number}</p>
                  <p className="text-xs font-medium text-gray-500">Total: {request.currency} {Number(invoice.amount).toLocaleString("id-ID")}</p>
                </div>
              </div>
              <a href={invoice.pdfUrl || `${import.meta.env.VITE_API_URL || ''}/api/agent-requests/invoice/${invoice.number}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white">Lihat / Download PDF</Button>
              </a>
            </div>
          </Card>
        )}

        {/* Admin Notes */}
        {request.status === "need_more_info" && (
          <Card className="p-5 border-2 border-amber-200 rounded-lg shadow-none bg-amber-50/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-800">Admin Membutuhkan Informasi Tambahan</h3>
                <p className="text-xs text-amber-700 mt-1">{request.quotationNotes || "Silakan periksa catatan admin di timeline dan perbarui request Anda."}</p>
                <Button size="sm" className="mt-3 h-8 px-3 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md" onClick={() => navigate({ to: "/agent/create-request" })}>
                  Edit & Kirim Ulang
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Timeline */}
        <Card className="p-5 border border-[#e5e7eb] rounded-lg shadow-none">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Timeline Aktivitas</h3>

          {timeline.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Belum ada aktivitas</p>
          ) : (
            <div className="space-y-0">
              {timeline.map((entry: any, i: number) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                      i === 0 ? "bg-[#111111] text-white" : "bg-[#f5f5f5] text-gray-400"
                    }`}>
                      {entry.eventType === 'status_change' ? <ChevronRight className="h-3 w-3" /> :
                       entry.eventType === 'quotation_sent' ? <MessageSquare className="h-3 w-3" /> :
                       entry.eventType === 'payment_uploaded' ? <CreditCard className="h-3 w-3" /> :
                       <Clock className="h-3 w-3" />}
                    </div>
                    {i < timeline.length - 1 && <div className="w-[1px] h-full bg-[#e5e7eb] min-h-[24px]" />}
                  </div>
                  <div className="pb-4 min-w-0">
                    <p className="text-xs font-semibold text-[#111111]">{entry.title}</p>
                    {entry.description && <p className="text-[11px] text-gray-500 mt-0.5">{entry.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400">{formatDate(entry.createdAt)}</span>
                      <Badge variant="outline" className="text-[9px] py-0 px-1.5 rounded shadow-none bg-[#f5f5f5] text-gray-500 border-gray-200/50">
                        {entry.actorRole}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AgentPageLayout>
  );
}
