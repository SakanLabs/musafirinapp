import { createFileRoute } from "@tanstack/react-router";
import { AgentPageLayout } from "@/components/layout/AgentPageLayout";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Save, Loader2 } from "lucide-react";

export const Route = createFileRoute("/agent/profile")({
  component: AgentProfilePage,
});

function AgentProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    companyPhone: "",
    companyEmail: "",
    companyAddress: "",
    city: "",
    province: "",
    country: "Indonesia",
    licenseNumber: "",
    notes: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await apiClient.get<any>("/api/agent-requests/profile/me");
      if (res.success && res.data) {
        setForm({
          companyName: res.data.companyName || "",
          companyPhone: res.data.companyPhone || "",
          companyEmail: res.data.companyEmail || "",
          companyAddress: res.data.companyAddress || "",
          city: res.data.city || "",
          province: res.data.province || "",
          country: res.data.country || "Indonesia",
          licenseNumber: res.data.licenseNumber || "",
          notes: res.data.notes || "",
        });
      }
    } catch {}
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.companyName.trim()) {
      toast.error("Nama perusahaan wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.post<any>("/api/agent-requests/profile/save", form);
      if (res.success) toast.success("Profil perusahaan berhasil disimpan");
      else toast.error("Gagal menyimpan profil");
    } catch { toast.error("Gagal menyimpan profil"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <AgentPageLayout title="Profil Perusahaan" subtitle="Informasi travel/perusahaan Anda">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </AgentPageLayout>
    );
  }

  return (
    <AgentPageLayout
      title="Profil Perusahaan"
      subtitle="Kelola informasi travel/perusahaan Anda"
      actions={
        <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#111111] hover:bg-[#242424] text-white rounded-md text-xs font-semibold h-9 px-4">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Simpan
        </Button>
      }
    >
      <div className="max-w-2xl space-y-6">
        <Card className="p-6 border border-[#e5e7eb] rounded-lg shadow-none">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-[#f5f5f5] flex items-center justify-center">
              <Building2 className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111111]">Informasi Perusahaan</h3>
              <p className="text-xs text-gray-500">Data ini akan ditampilkan pada dokumen dan komunikasi dengan admin</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nama Perusahaan / Travel *</Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Contoh: PT Maju Bersama Travel" className="mt-1.5 h-9 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Telepon Perusahaan</Label>
                <Input value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} placeholder="+62..." className="mt-1.5 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Email Perusahaan</Label>
                <Input type="email" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} className="mt-1.5 h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Alamat</Label>
              <textarea value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} rows={2} className="mt-1.5 w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-md bg-white focus:ring-1 focus:ring-[#111111] outline-none resize-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Kota</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1.5 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Provinsi</Label>
                <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className="mt-1.5 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Negara</Label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="mt-1.5 h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nomor Izin Travel (PPIU/PIHK)</Label>
              <Input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} placeholder="Contoh: 123/2024" className="mt-1.5 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Catatan</Label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Catatan tambahan..." className="mt-1.5 w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-md bg-white focus:ring-1 focus:ring-[#111111] outline-none resize-none" />
            </div>
          </div>
        </Card>
      </div>
    </AgentPageLayout>
  );
}
