import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout/PageLayout";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { authService } from "@/lib/auth";
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
  Building2,
  Send,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  FileBadge,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/agent-request-admin-detail/$id")({
  beforeLoad: async () => {
    const isAuth = await authService.isAuthenticated();
    if (!isAuth) throw new Error("Unauthorized");
  },
  component: AdminRequestDetailPage,
});

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
  quote_accepted: { label: "Penawaran Diterima", class: "bg-emerald-50 text-emerald-700 border-emerald-200/50" },
  invoiced: { label: "Invoice Terbit", class: "bg-cyan-50 text-cyan-700 border-cyan-200/50" },
  payment_uploaded: { label: "Bukti Bayar Diupload", class: "bg-yellow-50 text-yellow-700 border-yellow-200/50" },
  paid: { label: "Terbayar", class: "bg-green-50 text-green-700 border-green-200/50" },
  voucher_issued: { label: "Voucher Terbit", class: "bg-teal-50 text-teal-700 border-teal-200/50" },
  completed: { label: "Selesai", class: "bg-emerald-50 text-emerald-800 border-emerald-200/50" },
  cancelled: { label: "Dibatalkan", class: "bg-red-50 text-red-700 border-red-200/50" },
  rejected: { label: "Ditolak", class: "bg-red-50 text-red-600 border-red-200/50" },
};

function AdminRequestDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  
  // Quotation form state
  const [showQuotationForm, setShowQuotationForm] = useState(false);
  const [quotationAmount, setQuotationAmount] = useState("");
  const [quotationNotes, setQuotationNotes] = useState("");

  // Notes form state
  const [noteContent, setNoteContent] = useState("");
  const [invoice, setInvoice] = useState<any>(null);

  useEffect(() => {
    loadRequest();
  }, [id]);

  const loadRequest = async () => {
    try {
      setLoading(true);
      const [reqRes, invoiceRes] = await Promise.all([
        apiClient.get<any>(`/api/agent-requests/admin/${id}`),
        apiClient.get<any>(`/api/agent-requests/admin/${id}/invoice`).catch(() => null)
      ]);

      if (reqRes.success) {
        setRequest(reqRes.data);
        setTimeline(reqRes.data.timeline || []);
      }
      if (invoiceRes && invoiceRes.success) setInvoice(invoiceRes.data);
      else if (!reqRes.success) toast.error("Request tidak ditemukan");
    } catch (error) {
      toast.error("Gagal memuat detail request");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setActionLoading("status");
    try {
      const res = await apiClient.patch<any>(`/api/agent-requests/admin/${id}/status`, { status: newStatus });
      if (res.success) {
        toast.success(`Status berhasil diubah ke ${statusConfig[newStatus]?.label}`);
        loadRequest();
      } else toast.error(res.error);
    } catch { toast.error("Gagal mengubah status"); }
    finally { setActionLoading(""); }
  };

  const handleAssignToMe = async () => {
    setActionLoading("assign");
    try {
      const res = await apiClient.post<any>(`/api/agent-requests/admin/${id}/assign`, {});
      if (res.success) {
        toast.success("Request berhasil diassign ke Anda");
        loadRequest();
      } else toast.error(res.error);
    } catch { toast.error("Gagal assign request"); }
    finally { setActionLoading(""); }
  };

  const handleSendQuotation = async () => {
    if (!quotationAmount) {
      toast.error("Masukkan harga penawaran");
      return;
    }
    setActionLoading("quotation");
    try {
      const res = await apiClient.post<any>(`/api/agent-requests/admin/${id}/quotation`, {
        totalAmount: quotationAmount,
        notes: quotationNotes,
        quotationData: {
          price: quotationAmount,
          currency: "SAR",
          notes: quotationNotes,
        }
      });
      if (res.success) {
        toast.success("Penawaran berhasil dikirim ke Agent");
        setShowQuotationForm(false);
        loadRequest();
      } else toast.error(res.error);
    } catch { toast.error("Gagal mengirim penawaran"); }
    finally { setActionLoading(""); }
  };

  const handleAddNote = async () => {
    if (!noteContent) {
      toast.error("Catatan tidak boleh kosong");
      return;
    }
    setActionLoading("note");
    try {
      const res = await apiClient.post<any>(`/api/agent-requests/admin/${id}/note`, {
        title: "Catatan Admin",
        description: noteContent,
        notifyAgent: true,
      });
      if (res.success) {
        toast.success("Catatan berhasil ditambahkan");
        setNoteContent("");
        loadRequest();
      } else toast.error(res.error);
    } catch { toast.error("Gagal menambah catatan"); }
    finally { setActionLoading(""); }
  };

  if (loading) {
    return (
      <PageLayout title="Detail Request" showBackButton>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </PageLayout>
    );
  }

  if (!request) {
    return (
      <PageLayout title="Detail Request" showBackButton>
        <div className="text-center py-20">
          <XCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Request tidak ditemukan</p>
        </div>
      </PageLayout>
    );
  }

  const sc = statusConfig[request.status] || statusConfig.draft;
  const meta = request.meta || {};
  const profile = request.companyProfile || {};
  const formatCurrency = (amount: number, currency: string) => `${currency} ${Number(amount).toLocaleString("id-ID")}`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <PageLayout
      title={`Request: ${request.requestNumber}`}
      subtitle={`${serviceTypeLabels[request.serviceType]} — ${request.title}`}
      showBackButton
    >
      <div className="max-w-6xl space-y-6">
        
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs font-semibold py-1 px-3 rounded-md shadow-none ${sc.class}`}>
              {sc.label}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {request.status === "submitted" && (
              <Button size="sm" onClick={handleAssignToMe} disabled={!!actionLoading} className="h-8 px-4 text-xs font-semibold bg-[#111111] hover:bg-[#242424] text-white rounded-md">
                {actionLoading === "assign" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                Assign & Proses
              </Button>
            )}

            {["in_review", "quote_revision_requested", "quoted", "quote_accepted", "invoiced", "payment_uploaded", "paid", "voucher_issued"].includes(request.status) && (
              <Button 
                size="sm" 
                onClick={() => {
                  if (!showQuotationForm && request.totalAmount) {
                    setQuotationAmount(request.totalAmount || "");
                    setQuotationNotes(request.quotationNotes || "");
                  }
                  setShowQuotationForm(!showQuotationForm);
                }} 
                className="h-8 px-4 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-md"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                {["in_review"].includes(request.status) && !request.totalAmount ? "Buat Penawaran" : "Edit Penawaran"}
              </Button>
            )}

            {request.status === "quote_accepted" && (
              <Button size="sm" onClick={() => handleUpdateStatus("invoiced")} disabled={!!actionLoading} className="h-8 px-4 text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white rounded-md">
                {actionLoading === "status" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                Tandai Invoiced
              </Button>
            )}

            {request.status === "payment_uploaded" && (
              <Button size="sm" onClick={() => handleUpdateStatus("paid")} disabled={!!actionLoading} className="h-8 px-4 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-md">
                {actionLoading === "status" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                Verifikasi Pembayaran
              </Button>
            )}

            {["paid", "voucher_issued"].includes(request.status) && (
              <Button size="sm" onClick={() => handleUpdateStatus("completed")} disabled={!!actionLoading} className="h-8 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md">
                Tandai Selesai
              </Button>
            )}

            {["submitted", "in_review", "need_more_info"].includes(request.status) && (
              <Button size="sm" variant="outline" onClick={() => handleUpdateStatus("cancelled")} disabled={!!actionLoading} className="h-8 px-4 text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50 rounded-md">
                Batalkan Request
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quotation Form (Conditionally Rendered) */}
            {showQuotationForm && (
              <Card className="p-5 border-2 border-purple-200 bg-purple-50/50 rounded-lg shadow-none space-y-4">
                <h3 className="text-sm font-bold text-purple-900 flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2 text-purple-600" />
                  Kirim Penawaran ke Agent
                </h3>
                
                {request.agentQuotationResponse && (
                  <div className="bg-white p-3 rounded-md border border-purple-100 text-xs">
                    <span className="font-bold text-purple-800 block mb-1">Catatan Revisi dari Agent:</span>
                    <span className="text-gray-700">{request.agentQuotationResponse}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Total Harga (SAR)</Label>
                    <Input
                      type="number"
                      value={quotationAmount}
                      onChange={(e) => setQuotationAmount(e.target.value)}
                      placeholder="Masukkan total harga penawaran..."
                      className="mt-1.5 h-9 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Catatan Penawaran / Pesan (opsional)</Label>
                    <textarea
                      value={quotationNotes}
                      onChange={(e) => setQuotationNotes(e.target.value)}
                      rows={3}
                      placeholder="Contoh: Harga sudah termasuk breakfast..."
                      className="mt-1.5 w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-md bg-white focus:ring-1 focus:ring-purple-600 outline-none resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowQuotationForm(false)} className="h-8 px-4 text-xs font-semibold border-[#e5e7eb] bg-white rounded-md">
                      Batal
                    </Button>
                    <Button size="sm" onClick={handleSendQuotation} disabled={actionLoading === "quotation"} className="h-8 px-4 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-md">
                      {actionLoading === "quotation" ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Send className="h-3 w-3 mr-1.5" />}
                      Kirim Penawaran
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Request Detail Card */}
            <Card className="p-5 border border-[#e5e7eb] rounded-lg shadow-none">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Detail Request</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Layanan</p>
                    <p className="text-sm font-medium text-[#111111]">{serviceTypeLabels[request.serviceType]}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Tanggal Request</p>
                    <p className="text-sm text-gray-700">{formatDate(request.createdAt)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Judul</p>
                  <p className="text-sm text-[#111111] font-medium">{request.title}</p>
                </div>
                {request.description && (
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Catatan Tambahan</p>
                    <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-100">{request.description}</p>
                  </div>
                )}

                {/* Specific details */}
                {Object.entries(meta).filter(([_, v]) => v && typeof v !== 'object').length > 0 && (
                  <div className="border-t border-[#e5e7eb] pt-4 mt-4">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-3">Spesifikasi Layanan</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                      {Object.entries(meta).filter(([_, v]) => v && typeof v !== 'object').map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center text-xs pb-2 border-b border-gray-100">
                          <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="text-[#111111] font-semibold">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Master Estimated Price */}
                {meta.agentPrice !== undefined && meta.agentPrice > 0 && (
                  <div className="border-t border-[#e5e7eb] pt-4 mt-4">
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-3">Estimasi Harga Master</p>
                    <div className="bg-blue-50/50 border border-blue-100 rounded-md p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Harga Agent (Estimated)</p>
                          <p className="text-sm font-bold text-blue-900">SAR {meta.agentPrice.toLocaleString("id-ID")}</p>
                        </div>
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-none">
                          System Calc
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quotation Details (if any) */}
                {request.quotationData && (
                  <div className="border-t border-[#e5e7eb] pt-4 mt-4">
                    <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-3">Penawaran yang Dikirim</p>
                    <div className="bg-purple-50/50 border border-purple-100 rounded-md p-4">
                      {request.totalAmount && (
                        <div className="mb-2">
                          <span className="text-xs text-gray-500 block mb-1">Total Harga:</span>
                          <span className="text-lg font-bold text-purple-900">{request.currency} {Number(request.totalAmount).toLocaleString("id-ID")}</span>
                        </div>
                      )}
                      {request.quotationNotes && (
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Catatan:</span>
                          <span className="text-xs text-gray-800">{request.quotationNotes}</span>
                        </div>
                      )}
                      {request.agentQuotationResponse && ["cancelled", "quote_revision_requested"].includes(request.status) && (
                        <div className="mt-3 pt-3 border-t border-purple-200">
                          <span className="text-xs text-red-500 font-semibold block mb-1">Respon Agent:</span>
                          <span className="text-xs text-gray-800">{request.agentQuotationResponse}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Invoice Section */}
                {invoice && (
                  <div className="mt-4 pt-4 border-t border-[#e5e7eb]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-md">
                          <FileText className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800">Invoice: {invoice.number}</p>
                          <p className="text-[10px] text-gray-500">Total: {formatCurrency(invoice.amount, invoice.currency)}</p>
                        </div>
                      </div>
                      <a href={invoice.pdfUrl || `${import.meta.env.VITE_API_URL || ''}/api/agent-requests/invoice/${invoice.number}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-8 text-xs bg-white">Lihat PDF</Button>
                      </a>
                    </div>
                  </div>
                )}
                
                {/* Payment Proof */}
                {request.paymentProofUrl && (
                  <div className="border-t border-[#e5e7eb] pt-4 mt-4">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-3">Bukti Pembayaran</p>
                    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-xs font-semibold text-gray-800">Bukti_Transfer.pdf</p>
                          <p className="text-[10px] text-gray-500">{formatDate(request.paymentProofUploadedAt)}</p>
                        </div>
                      </div>
                      <a href={request.paymentProofUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-7 text-xs">Lihat / Download</Button>
                      </a>
                    </div>
                  </div>
                )}

              </div>
            </Card>

            {/* Timeline */}
            <Card className="p-5 border border-[#e5e7eb] rounded-lg shadow-none">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Timeline & Log Aktivitas</h3>
              
              <div className="space-y-0">
                {timeline.map((entry: any, i: number) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 border-2 border-white ${
                        entry.actorRole === "admin" ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600"
                      }`}>
                        {entry.eventType === 'status_change' ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                         entry.eventType === 'note' ? <MessageSquare className="h-3.5 w-3.5" /> :
                         <Clock className="h-3.5 w-3.5" />}
                      </div>
                      {i < timeline.length - 1 && <div className="w-[2px] h-full bg-[#e5e7eb] min-h-[30px]" />}
                    </div>
                    <div className="pb-5 min-w-0 flex-1 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#111111]">{entry.title}</p>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatDate(entry.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 mb-1.5">
                        <UserIcon className="h-3 w-3 text-gray-400" />
                        <span className="text-[10px] font-medium text-gray-500 capitalize">{entry.actorRole}</span>
                      </div>
                      {entry.description && (
                        <div className={`text-xs p-3 rounded-md mt-1 ${
                          entry.eventType === 'note' ? "bg-blue-50 border border-blue-100 text-blue-900" : "bg-gray-50 border border-gray-100 text-gray-700"
                        }`}>
                          {entry.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Note Form */}
              <div className="mt-4 pt-4 border-t border-[#e5e7eb] flex gap-2">
                <Input
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Kirim pesan ke agent atau tambah catatan internal..."
                  className="flex-1 h-9 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddNote();
                  }}
                />
                <Button size="sm" onClick={handleAddNote} disabled={actionLoading === "note"} className="h-9 px-4 bg-[#111111] hover:bg-[#242424] text-white">
                  {actionLoading === "note" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </Card>

          </div>

          <div className="space-y-6">
            
            {/* Agent / Company Profile Card */}
            <Card className="p-5 border border-[#e5e7eb] rounded-lg shadow-none">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Informasi Agent</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <UserIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#111111] truncate">{request.agentName}</p>
                    <p className="text-xs text-gray-500 truncate">{request.agentEmail}</p>
                  </div>
                </div>

                <div className="border-t border-[#e5e7eb] pt-4 space-y-3">
                  {profile.companyName ? (
                    <>
                      <div className="flex items-start gap-2">
                        <Building2 className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{profile.companyName}</p>
                          <p className="text-[10px] text-gray-500">Travel Agency</p>
                        </div>
                      </div>
                      {profile.companyPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <p className="text-xs text-gray-700">{profile.companyPhone}</p>
                        </div>
                      )}
                      {profile.companyAddress && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-gray-700">{profile.companyAddress}, {profile.city}</p>
                        </div>
                      )}
                      {profile.licenseNumber && (
                        <div className="flex items-center gap-2">
                          <FileBadge className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <p className="text-xs text-gray-700">Izin: {profile.licenseNumber}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-2 bg-gray-50 rounded-md">
                      <p className="text-[10px] text-gray-500 italic">Agent belum melengkapi profil perusahaan</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Assignment Card */}
            <Card className="p-5 border border-[#e5e7eb] rounded-lg shadow-none">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Penugasan</h3>
              
              {request.assignedAdminId ? (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Request ini sedang ditangani oleh admin
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-md border border-amber-100">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Belum ada admin yang bertugas
                  </div>
                  <Button size="sm" onClick={handleAssignToMe} disabled={!!actionLoading} className="w-full h-8 text-xs font-semibold bg-white border border-[#e5e7eb] text-[#111111] hover:bg-gray-50 rounded-md">
                    {actionLoading === "assign" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Assign ke Saya
                  </Button>
                </div>
              )}
            </Card>

          </div>
        </div>
      </div>
    </PageLayout>
  );
}
