import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import {
  Loader2,
  PlusCircle,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
  Building,
  Plane,
  Car,
  UserCheck,
  Package,
  MoreHorizontal,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  useCustomLaFinanceSummary,
  useCustomLaExpenses,
  useCreateCustomLaExpense,
  useUpdateCustomLaExpense,
  useDeleteCustomLaExpense,
  type CustomLaExpense,
} from "@/lib/queries/customLa";

const EXPENSE_CATEGORIES = [
  { value: "hotel", label: "Hotel", icon: Building, color: "bg-blue-500" },
  { value: "visa", label: "Visa", icon: Plane, color: "bg-purple-500" },
  { value: "transportasi", label: "Transportasi", icon: Car, color: "bg-amber-500" },
  { value: "muthowif", label: "Muthowif", icon: UserCheck, color: "bg-teal-500" },
  { value: "handling", label: "Handling", icon: Package, color: "bg-rose-500" },
  { value: "lainnya", label: "Lainnya", icon: MoreHorizontal, color: "bg-zinc-500" },
];

const PAYMENT_METHODS = [
  { value: "transfer", label: "Transfer Bank" },
  { value: "cash", label: "Cash" },
  { value: "e-wallet", label: "E-Wallet" },
  { value: "check", label: "Check/Cek" },
  { value: "other", label: "Lainnya" },
];

interface ExpenseFormData {
  category: string;
  supplierName: string;
  description: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
  status: "pending" | "paid" | "cancelled";
}

const defaultFormData: ExpenseFormData = {
  category: "hotel",
  supplierName: "",
  description: "",
  amount: "",
  paymentDate: new Date().toISOString().split("T")[0],
  paymentMethod: "transfer",
  referenceNumber: "",
  notes: "",
  status: "pending",
};

function getCategoryInfo(category: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === category) || EXPENSE_CATEGORIES[5];
}

function getStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 font-semibold">
          <CheckCircle2 className="w-3 h-3 mr-0.5" /> Lunas
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 font-semibold">
          <Clock className="w-3 h-3 mr-0.5" /> Pending
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0 font-semibold">
          <XCircle className="w-3 h-3 mr-0.5" /> Batal
        </Badge>
      );
    default:
      return <Badge className="text-[10px] px-1.5 py-0">{status}</Badge>;
  }
}

export function FinanceTab({ laId }: { laId: number }) {
  const { data: summary, isLoading: summaryLoading } = useCustomLaFinanceSummary(laId);
  const { data: expenses, isLoading: expensesLoading } = useCustomLaExpenses(laId);
  const createExpense = useCreateCustomLaExpense();
  const updateExpense = useUpdateCustomLaExpense();
  const deleteExpense = useDeleteCustomLaExpense();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<CustomLaExpense | null>(null);
  const [formData, setFormData] = useState<ExpenseFormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const openCreateModal = () => {
    setEditingExpense(null);
    setFormData(defaultFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (expense: CustomLaExpense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      supplierName: expense.supplierName,
      description: expense.description || "",
      amount: expense.amount,
      paymentDate: expense.paymentDate
        ? new Date(expense.paymentDate).toISOString().split("T")[0]
        : "",
      paymentMethod: expense.paymentMethod || "transfer",
      referenceNumber: expense.referenceNumber || "",
      notes: expense.notes || "",
      status: expense.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.supplierName.trim()) {
      toast.error("Nama supplier harus diisi");
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Jumlah harus lebih dari 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        category: formData.category,
        supplierName: formData.supplierName.trim(),
        description: formData.description.trim() || null,
        amount: parseFloat(formData.amount),
        paymentDate: formData.paymentDate || null,
        paymentMethod: formData.paymentMethod || null,
        referenceNumber: formData.referenceNumber.trim() || null,
        notes: formData.notes.trim() || null,
        status: formData.status,
      };

      if (editingExpense) {
        await updateExpense.mutateAsync({
          laId,
          expenseId: editingExpense.id,
          data: payload,
        });
        toast.success("Pengeluaran berhasil diupdate");
      } else {
        await createExpense.mutateAsync({ laId, data: payload });
        toast.success("Pengeluaran berhasil dicatat");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(`Gagal: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (expenseId: number) => {
    try {
      await deleteExpense.mutateAsync({ laId, expenseId });
      toast.success("Pengeluaran berhasil dihapus");
      setDeleteConfirm(null);
    } catch (err: any) {
      toast.error(`Gagal menghapus: ${err.message}`);
    }
  };

  if (summaryLoading || expensesLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" />
      </div>
    );
  }

  const categoryBreakdown = summary?.categoryBreakdown || {};
  const sortedCategories = Object.entries(categoryBreakdown).sort(
    ([, a], [, b]) => b.total - a.total
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Harga LA */}
        <Card className="border border-zinc-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Total Harga LA
              </span>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-zinc-600" />
              </div>
            </div>
            <p className="text-xl font-bold text-zinc-900 tracking-tight">
              {formatCurrency(summary?.totalAmountSAR || 0)}
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">Harga jual ke client</p>
          </CardContent>
        </Card>

        {/* Uang Masuk */}
        <Card className="border border-emerald-200 bg-emerald-50/30 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">
                Uang Masuk
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-xl font-bold text-emerald-700 tracking-tight">
              {formatCurrency(summary?.totalIncome || 0)}
            </p>
            <p className="text-[11px] text-emerald-500 mt-1">
              Pembayaran dari client
            </p>
          </CardContent>
        </Card>

        {/* Uang Keluar */}
        <Card className="border border-red-200 bg-red-50/30 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-red-600 uppercase tracking-wide">
                Uang Keluar
              </span>
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <ArrowUpCircle className="w-4 h-4 text-red-600" />
              </div>
            </div>
            <p className="text-xl font-bold text-red-700 tracking-tight">
              {formatCurrency(summary?.totalExpensesPaid || 0)}
            </p>
            <p className="text-[11px] text-red-500 mt-1">
              {summary?.totalExpensesPending
                ? `+ ${formatCurrency(summary.totalExpensesPending)} pending`
                : "Dibayar ke supplier"}
            </p>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card
          className={`border shadow-none ${
            (summary?.projectedProfit || 0) >= 0
              ? "border-blue-200 bg-blue-50/30"
              : "border-orange-200 bg-orange-50/30"
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-xs font-medium uppercase tracking-wide ${
                  (summary?.projectedProfit || 0) >= 0
                    ? "text-blue-600"
                    : "text-orange-600"
                }`}
              >
                Proyeksi Profit
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  (summary?.projectedProfit || 0) >= 0
                    ? "bg-blue-100"
                    : "bg-orange-100"
                }`}
              >
                {(summary?.projectedProfit || 0) >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-orange-600" />
                )}
              </div>
            </div>
            <p
              className={`text-xl font-bold tracking-tight ${
                (summary?.projectedProfit || 0) >= 0
                  ? "text-blue-700"
                  : "text-orange-700"
              }`}
            >
              {formatCurrency(summary?.projectedProfit || 0)}
            </p>
            <p
              className={`text-[11px] mt-1 ${
                (summary?.projectedProfit || 0) >= 0
                  ? "text-blue-500"
                  : "text-orange-500"
              }`}
            >
              Margin: {summary?.profitMarginPercent || "0"}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Category Breakdown */}
        <Card className="lg:col-span-1 border border-zinc-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-zinc-900">
              Breakdown Per Kategori
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedCategories.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-4">
                Belum ada pengeluaran tercatat
              </p>
            ) : (
              sortedCategories.map(([cat, data]) => {
                const catInfo = getCategoryInfo(cat);
                const CatIcon = catInfo.icon;
                const percentage =
                  (summary?.totalExpensesAll || 0) > 0
                    ? (data.total / (summary?.totalExpensesAll || 1)) * 100
                    : 0;

                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded ${catInfo.color} flex items-center justify-center`}
                        >
                          <CatIcon className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-zinc-700">
                          {catInfo.label}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          ({data.count}x)
                        </span>
                      </div>
                      <span className="text-xs font-bold text-zinc-900">
                        {formatCurrency(data.total)}
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-1.5">
                      <div
                        className={`${catInfo.color} h-1.5 rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Lunas: {formatCurrency(data.paid)}</span>
                      {data.pending > 0 && (
                        <span className="text-amber-500">
                          Pending: {formatCurrency(data.pending)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right: Expense List */}
        <Card className="lg:col-span-2 border border-zinc-200 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-zinc-900">
                Daftar Pengeluaran
              </CardTitle>
              <Button
                onClick={openCreateModal}
                className="bg-zinc-900 hover:bg-zinc-800 text-white h-8 px-3 text-xs font-semibold rounded-md shadow-none"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                Tambah Pengeluaran
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!expenses || expenses.length === 0 ? (
              <div className="text-center py-12">
                <ArrowUpCircle className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-500">
                  Belum ada pengeluaran tercatat
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Klik "Tambah Pengeluaran" untuk mencatat pembayaran ke supplier
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {expenses.map((exp) => {
                  const catInfo = getCategoryInfo(exp.category);
                  const CatIcon = catInfo.icon;

                  return (
                    <div
                      key={exp.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 hover:bg-zinc-50/50 transition-colors group"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg ${catInfo.color} flex items-center justify-center flex-shrink-0`}
                      >
                        <CatIcon className="w-4 h-4 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-zinc-900 truncate">
                            {exp.supplierName}
                          </span>
                          {getStatusBadge(exp.status)}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                          <span className="font-medium text-zinc-500">
                            {catInfo.label}
                          </span>
                          {exp.description && (
                            <>
                              <span>·</span>
                              <span className="truncate">{exp.description}</span>
                            </>
                          )}
                          {exp.paymentDate && (
                            <>
                              <span>·</span>
                              <span>
                                {new Date(exp.paymentDate).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-zinc-900">
                          {formatCurrency(exp.amount)}
                        </p>
                        {exp.paymentMethod && (
                          <p className="text-[10px] text-zinc-400 capitalize">
                            {exp.paymentMethod}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(exp)}
                          className="p-1.5 rounded-md hover:bg-zinc-200 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-zinc-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(exp.id)}
                          className="p-1.5 rounded-md hover:bg-red-100 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Expense Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Edit Pengeluaran" : "Tambah Pengeluaran"}
            </DialogTitle>
            <DialogDescription>
              {editingExpense
                ? "Update detail pengeluaran ke supplier"
                : "Catat pembayaran baru ke supplier"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 mb-1.5 block">
                Kategori <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  const selected = formData.category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, category: cat.value }))
                      }
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                        selected
                          ? `${cat.color} text-white border-transparent shadow-sm`
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300 bg-white"
                      }`}
                    >
                      <CatIcon className="w-3.5 h-3.5" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Supplier Name */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 mb-1.5 block">
                Nama Supplier <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.supplierName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, supplierName: e.target.value }))
                }
                placeholder="Contoh: Hotel Al Haram, Naqaba Visa..."
                className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
              />
            </div>

            {/* Amount & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 mb-1.5 block">
                  Jumlah (SAR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 mb-1.5 block">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: e.target.value as "pending" | "paid" | "cancelled",
                    }))
                  }
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 bg-white"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Lunas (Paid)</option>
                  <option value="cancelled">Batal</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 mb-1.5 block">
                Keterangan
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Detail pengeluaran..."
                className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
              />
            </div>

            {/* Payment Date & Method */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 mb-1.5 block">
                  Tanggal Bayar
                </label>
                <input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      paymentDate: e.target.value,
                    }))
                  }
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 mb-1.5 block">
                  Metode Bayar
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      paymentMethod: e.target.value,
                    }))
                  }
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 bg-white"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reference Number */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 mb-1.5 block">
                No. Referensi / Bukti Transfer
              </label>
              <input
                type="text"
                value={formData.referenceNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    referenceNumber: e.target.value,
                  }))
                }
                placeholder="Nomor referensi transaksi..."
                className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 mb-1.5 block">
                Catatan
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Catatan tambahan..."
                rows={2}
                className="w-full px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="h-9 text-xs font-semibold"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-zinc-900 hover:bg-zinc-800 text-white h-9 px-4 text-xs font-semibold shadow-none"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {editingExpense ? "Update" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Pengeluaran</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus catatan pengeluaran ini? Tindakan ini
              tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="h-9 text-xs font-semibold"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700 text-white h-9 px-4 text-xs font-semibold shadow-none"
            >
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
