import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Calendar,
  CalendarCheck,
  Search,
  Filter,
  Printer,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  Phone,
  Mail,
  ExternalLink,
  Users,
  Ticket,
  DollarSign,
  AlertCircle,
  RefreshCw,
  MessageCircle,
  Car,
  UserCheck,
  MapPin,
  Layers,
  FileStack,
  Loader2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MergeInvoiceModal } from '@/components/modals/MergeInvoiceModal';
import { usePrepareMergeFromBookings, type Invoice } from '@/lib/queries/invoices';
import { authService } from '@/lib/auth';
import { formatCurrency, formatSAR } from '@/lib/utils';
import { useUpcomingArrivals, type ArrivalItem, type ArrivalServiceType, type ArrivalsFilterParams } from '@/lib/queries/arrivals';
import { getOperationalDateString, formatOperationalDate, getDaysUntilArrival, OPERATIONAL_TIMEZONE } from '@/lib/date';

const SERVICE_META: Record<ArrivalServiceType, { label: string; icon: typeof Building; badgeClass: string }> = {
  hotel: { label: 'Hotel', icon: Building, badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
  muthowif: { label: 'Muthowif', icon: UserCheck, badgeClass: 'bg-violet-50 text-violet-700 border-violet-200' },
  transportation: { label: 'Transportasi', icon: Car, badgeClass: 'bg-teal-50 text-teal-700 border-teal-200' },
};

function formatOperationalTime(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: OPERATIONAL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export const Route = createFileRoute('/upcoming-arrivals')({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: UpcomingArrivalsPage,
});

function UpcomingArrivalsPage() {
  const navigate = useNavigate();

  // Operational default date window: today to today + 14 days in Asia/Riyadh
  const defaultToday = getOperationalDateString();
  const defaultEndDate = useMemo(() => {
    const d = new Date(`${defaultToday}T00:00:00.000+03:00`);
    const target = new Date(d.getTime() + 14 * 24 * 60 * 60 * 1000);
    return getOperationalDateString(target);
  }, [defaultToday]);

  // Filters state
  const [fromDate, setFromDate] = useState(defaultToday);
  const [toDate, setToDate] = useState(defaultEndDate);
  const [cityFilter, setCityFilter] = useState('all');
  const [hotelFilter, setHotelFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [voucherStatusFilter, setVoucherStatusFilter] = useState('all');
  const [hcnStatusFilter, setHcnStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<'all' | ArrivalServiceType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Combined bill: bookings picked from this board, keyed by `${serviceType}-${id}`
  const queryClient = useQueryClient();
  const [selectedBookings, setSelectedBookings] = useState<Map<string, ArrivalItem>>(new Map());
  const [mergeInvoices, setMergeInvoices] = useState<Invoice[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const { mutate: prepareMerge, isPending: isPreparingMerge } = usePrepareMergeFromBookings();

  // Fetch upcoming arrivals
  const queryFilters: ArrivalsFilterParams = {
    from: fromDate,
    to: toDate,
    city: cityFilter,
    hotel: hotelFilter,
    paymentStatus: paymentStatusFilter,
    voucherStatus: voucherStatusFilter,
    search: searchQuery,
    serviceType: serviceTypeFilter,
  };

  const { data, isLoading, error, refetch, isFetching } = useUpcomingArrivals(queryFilters);

  const arrivals = data?.data || [];
  const summary = data?.summary;

  // Additional in-memory filtering for HCN (hotel only) and muthowif/driver assignment
  const displayedArrivals = useMemo(() => {
    let list = arrivals;
    if (hcnStatusFilter !== 'all') {
      list = list.filter(a => a.serviceType === 'hotel');
      if (hcnStatusFilter === 'missing') list = list.filter(a => a.isHcnMissing);
      if (hcnStatusFilter === 'urgent_missing') list = list.filter(a => a.isHcnUrgent);
      if (hcnStatusFilter === 'available') list = list.filter(a => !a.isHcnMissing);
    }
    if (assigneeFilter === 'missing') list = list.filter(a => a.isAssigneeMissing);
    return list;
  }, [arrivals, hcnStatusFilter, assigneeFilter]);

  const serviceCounts = summary?.countsByServiceType;
  const serviceTabs: { value: 'all' | ArrivalServiceType; label: string; icon: typeof Building; count?: number }[] = [
    {
      value: 'all',
      label: 'Semua Layanan',
      icon: Layers,
      count: serviceCounts ? serviceCounts.hotel + serviceCounts.muthowif + serviceCounts.transportation : undefined,
    },
    ...(Object.keys(SERVICE_META) as ArrivalServiceType[]).map((type) => ({
      value: type,
      label: SERVICE_META[type].label,
      icon: SERVICE_META[type].icon,
      count: serviceCounts?.[type],
    })),
  ];

  const bookingKey = (arrival: ArrivalItem) => `${arrival.serviceType}-${arrival.id}`;

  const toggleBookingSelection = (arrival: ArrivalItem) => {
    setSelectedBookings((prev) => {
      const next = new Map(prev);
      const key = bookingKey(arrival);
      if (next.has(key)) next.delete(key);
      else next.set(key, arrival);
      return next;
    });
  };

  const selectedList = Array.from(selectedBookings.values());
  const selectedClientNames = Array.from(new Set(selectedList.map((a) => a.clientName)));

  const handleCreateCombinedBill = () => {
    prepareMerge(
      selectedList.map((a) => ({ serviceType: a.serviceType, id: a.id })),
      {
        onSuccess: (result) => {
          result.warnings.forEach((w) => toast.warning(w));
          if (result.createdCount > 0) {
            toast.info(`${result.createdCount} invoice draft dibuat otomatis untuk booking yang belum punya invoice`);
          }
          if (result.invoices.length < 2) {
            toast.error('Minimal 2 invoice dibutuhkan untuk tagihan gabungan');
            return;
          }
          setMergeInvoices(result.invoices);
          setIsMergeModalOpen(true);
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.error || err?.message || 'Gagal menyiapkan tagihan gabungan');
        },
      }
    );
  };

  const goToDetail = (arrival: ArrivalItem) => {
    if (arrival.serviceType === 'muthowif') {
      navigate({ to: '/muthowif-booking-detail/$id', params: { id: String(arrival.id) } });
    } else if (arrival.serviceType === 'transportation') {
      navigate({
        to: '/transportation-booking-detail/$transportationBookingId',
        params: { transportationBookingId: String(arrival.id) },
      });
    } else {
      navigate({ to: '/booking-detail', search: { id: String(arrival.id) } });
    }
  };

  const hasActiveFilters = Boolean(
    fromDate !== defaultToday ||
    toDate !== defaultEndDate ||
    cityFilter !== 'all' ||
    hotelFilter.trim() ||
    paymentStatusFilter !== 'all' ||
    voucherStatusFilter !== 'all' ||
    hcnStatusFilter !== 'all' ||
    assigneeFilter !== 'all' ||
    serviceTypeFilter !== 'all' ||
    searchQuery.trim()
  );

  const handleResetFilters = () => {
    setFromDate(defaultToday);
    setToDate(defaultEndDate);
    setCityFilter('all');
    setHotelFilter('');
    setPaymentStatusFilter('all');
    setVoucherStatusFilter('all');
    setHcnStatusFilter('all');
    setAssigneeFilter('all');
    setServiceTypeFilter('all');
    setSearchQuery('');
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper for urgency badge
  const renderUrgencyBadge = (days: number) => {
    if (days < 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
          LEWAT ({Math.abs(days)} HARI)
        </span>
      );
    }
    if (days === 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
          HARI INI
        </span>
      );
    }
    if (days === 1) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          BESOK
        </span>
      );
    }
    if (days <= 3) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          {days} HARI LAGI
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-50 text-zinc-600 border border-zinc-200">
        {days} hari lagi
      </span>
    );
  };

  return (
    <PageLayout
      title="Kedatangan & Jadwal Layanan"
      subtitle="Monitoring kedatangan tamu hotel, jadwal muthowif & penjemputan transportasi dalam satu tampilan"
      actions={
        <div className="flex items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 px-3 text-xs border-[#e5e7eb] hover:bg-zinc-50 text-zinc-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handlePrint}
            className="h-9 px-4 text-xs font-semibold bg-[#111111] hover:bg-zinc-800 text-white shadow-sm flex items-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Cetak Daftar Kedatangan
          </Button>
        </div>
      }
    >
      {/* ========================================================================= */}
      {/* PRINT-ONLY HEADER MANIFEST (Hidden on screen, visible during window.print) */}
      {/* ========================================================================= */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-black">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black tracking-tight text-black uppercase">
              MUSAFIRIN &bull; DAFTAR KEDATANGAN OPERASIONAL
            </h1>
            <p className="text-xs font-semibold text-zinc-700 mt-1">
              Upcoming Arrival Manifest &bull; {serviceTypeFilter === 'all' ? 'Hotel, Muthowif & Transportasi' : SERVICE_META[serviceTypeFilter].label}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-black">
              Periode: {formatOperationalDate(fromDate, 'long')} &ndash; {formatOperationalDate(toDate, 'long')}
            </p>
            <p className="text-zinc-600 mt-0.5">
              Dicetak pada: {formatOperationalDate(new Date(), 'datetime')} (Waktu Arab Saudi)
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-zinc-200 flex gap-6 text-xs font-semibold text-zinc-800">
          <div>Total Jadwal: <span className="font-bold text-black">{displayedArrivals.length}</span></div>
          <div>Kedatangan Hari Ini: <span className="font-bold text-black">{summary?.todayArrivals || 0}</span></div>
          <div>3 Hari Ke Depan: <span className="font-bold text-black">{summary?.next3DaysArrivals || 0}</span></div>
          <div>Belum Ada HCN: <span className="font-bold text-rose-700">{summary?.missingHcnCount || 0}</span></div>
          <div>Voucher Belum Terkirim: <span className="font-bold text-amber-700">{summary?.voucherNotSentCount || 0}</span></div>
          <div>Pembayaran Belum Lunas: <span className="font-bold text-rose-700">{summary?.paymentIncompleteCount || 0}</span></div>
          <div>Belum Ada Muthowif/Driver: <span className="font-bold text-rose-700">{summary?.missingAssigneeCount || 0}</span></div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* SERVICE TYPE TABS (Screen only) */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {serviceTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = serviceTypeFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setServiceTypeFilter(tab.value)}
                className={`h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#111111] border-[#111111] text-white'
                    : 'bg-white border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-0.5 px-1.5 rounded text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* SUMMARY CARDS (Screen only) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 print:hidden">
          {/* Card 1: Total Arrivals */}
          <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Total Kedatangan</span>
              <Calendar className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 mt-2">
              {summary?.totalArrivals ?? arrivals.length}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Dalam periode dipilih</div>
          </Card>

          {/* Card 2: Today Arrivals */}
          <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Hari Ini</span>
              <Clock className="h-4 w-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-2">
              {summary?.todayArrivals ?? 0}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Kedatangan hari ini</div>
          </Card>

          {/* Card 3: Next 3 Days */}
          <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">3 Hari Depan</span>
              <CalendarCheck className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-2">
              {summary?.next3DaysArrivals ?? 0}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Segera tiba</div>
          </Card>

          {/* Card 4: Urgent Missing HCN */}
          <Card 
            className={`border rounded-xl shadow-none p-3.5 cursor-pointer transition-colors ${
              hcnStatusFilter === 'urgent_missing' 
                ? 'border-rose-400 bg-rose-50/30' 
                : 'border-[#e5e7eb] bg-white hover:bg-zinc-50'
            }`}
            onClick={() => setHcnStatusFilter(hcnStatusFilter === 'urgent_missing' ? 'all' : 'urgent_missing')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">HCN Segera</span>
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-700 mt-2">
              {summary?.urgentMissingHcnCount ?? 0}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">&le; 3 hari tanpa HCN</div>
          </Card>

          {/* Card 5: Voucher Not Sent */}
          <Card 
            className={`border rounded-xl shadow-none p-3.5 cursor-pointer transition-colors ${
              voucherStatusFilter === 'ready_not_sent' 
                ? 'border-amber-400 bg-amber-50/30' 
                : 'border-[#e5e7eb] bg-white hover:bg-zinc-50'
            }`}
            onClick={() => setVoucherStatusFilter(voucherStatusFilter === 'ready_not_sent' ? 'all' : 'ready_not_sent')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Voucher Belum Kirim</span>
              <Ticket className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-2">
              {summary?.voucherNotSentCount ?? 0}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Belum terkirim ke klien</div>
          </Card>

          {/* Card 6: Payment Incomplete */}
          <Card 
            className={`border rounded-xl shadow-none p-3.5 cursor-pointer transition-colors ${
              paymentStatusFilter === 'unpaid' 
                ? 'border-rose-400 bg-rose-50/30' 
                : 'border-[#e5e7eb] bg-white hover:bg-zinc-50'
            }`}
            onClick={() => setPaymentStatusFilter(paymentStatusFilter === 'unpaid' ? 'all' : 'unpaid')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Belum Lunas</span>
              <DollarSign className="h-4 w-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-2">
              {summary?.paymentIncompleteCount ?? 0}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Unpaid / Partial</div>
          </Card>

          {/* Card 7: Muthowif / Driver not assigned */}
          <Card
            className={`border rounded-xl shadow-none p-3.5 cursor-pointer transition-colors ${
              assigneeFilter === 'missing'
                ? 'border-violet-400 bg-violet-50/30'
                : 'border-[#e5e7eb] bg-white hover:bg-zinc-50'
            }`}
            onClick={() => setAssigneeFilter(assigneeFilter === 'missing' ? 'all' : 'missing')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">Petugas Kosong</span>
              <UserCheck className="h-4 w-4 text-violet-600" />
            </div>
            <div className="text-2xl font-bold text-violet-700 mt-2">
              {summary?.missingAssigneeCount ?? 0}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              Muthowif / driver belum ada{summary?.urgentMissingAssigneeCount ? ` • ${summary.urgentMissingAssigneeCount} segera` : ''}
            </div>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* SEARCH & FILTERS BAR (Screen only) */}
        {/* ========================================================================= */}
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white p-4 print:hidden">
          <div className="space-y-3">
            {/* Top row: search + date range */}
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                <Input
                  placeholder="Cari ID Booking, HCN, Nama Tamu/Klien, Hotel, Muthowif/Driver, Lokasi, No. HP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111]"
                />
              </div>

              {/* Date Window Pickers */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-500">Dari:</span>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-10 px-2.5 border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 w-36 shadow-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-500">Sampai:</span>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-10 px-2.5 border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 w-36 shadow-none"
                  />
                </div>
              </div>
            </div>

            {/* Bottom row: dropdown filters */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
              {/* City Filter */}
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="h-9 px-3 border border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 focus:outline-none focus:border-[#111111]"
                title="Filter Kota"
              >
                <option value="all">Kota: Semua</option>
                <option value="Makkah">Makkah</option>
                <option value="Madinah">Madinah</option>
                <option value="Jeddah">Jeddah</option>
              </select>

              {/* Payment Filter */}
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="h-9 px-3 border border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 focus:outline-none focus:border-[#111111]"
                title="Filter Status Pembayaran"
              >
                <option value="all">Pembayaran: Semua</option>
                <option value="paid">Lunas (Paid)</option>
                <option value="partial">Sebagian (Partial)</option>
                <option value="unpaid">Belum Bayar (Unpaid)</option>
              </select>

              {/* Voucher Filter */}
              <select
                value={voucherStatusFilter}
                onChange={(e) => setVoucherStatusFilter(e.target.value)}
                className="h-9 px-3 border border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 focus:outline-none focus:border-[#111111]"
                title="Filter Status Voucher"
              >
                <option value="all">Voucher: Semua</option>
                <option value="sent">Sudah Terkirim</option>
                <option value="ready_not_sent">Siap / Belum Kirim</option>
                <option value="not_ready">Belum Dibuat</option>
              </select>

              {/* HCN Filter */}
              <select
                value={hcnStatusFilter}
                onChange={(e) => setHcnStatusFilter(e.target.value)}
                className="h-9 px-3 border border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 focus:outline-none focus:border-[#111111]"
                title="Filter Status HCN"
              >
                <option value="all">HCN: Semua</option>
                <option value="urgent_missing">Perlu Segera (&le; 3 Hari Tanpa HCN)</option>
                <option value="missing">Belum Ada HCN</option>
                <option value="available">Sudah Ada HCN</option>
              </select>

              {/* Reset Filter Button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-9 px-2.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 text-xs font-semibold"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Reset Filter
                </Button>
              )}

              <div className="ml-auto text-xs text-zinc-400">
                Menampilkan <strong className="text-zinc-900">{displayedArrivals.length}</strong> jadwal
              </div>
            </div>
          </div>
        </Card>

        {/* ========================================================================= */}
        {/* COMBINED BILL SELECTION BAR (Screen only) */}
        {/* ========================================================================= */}
        {selectedList.length > 0 && (
          <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-[#111111] bg-white px-4 py-3 shadow-sm print:hidden">
            <FileStack className="h-4 w-4 text-zinc-700" />
            <div className="text-xs text-zinc-700">
              <strong className="text-zinc-900">{selectedList.length} booking</strong> dipilih untuk tagihan gabungan
              {selectedClientNames.length > 1 && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  Berbeda klien: {selectedClientNames.join(', ')}
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedBookings(new Map())}
                className="h-8 px-2.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleCreateCombinedBill}
                disabled={selectedList.length < 2 || isPreparingMerge}
                className="h-8 px-3 text-xs font-semibold bg-[#111111] hover:bg-zinc-800 text-white"
              >
                {isPreparingMerge ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileStack className="h-3.5 w-3.5 mr-1.5" />}
                Buat Tagihan Gabungan
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ARRIVALS TABLE */}
        {/* ========================================================================= */}
        <div className="border border-[#e5e7eb] rounded-xl overflow-hidden bg-white shadow-none print:border-black print:rounded-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-[#e5e7eb] text-zinc-600 font-bold uppercase tracking-wider text-[11px] print:bg-zinc-100 print:text-black print:border-black">
                  <th className="py-3 pl-4 pr-0 w-8 print:hidden" title="Pilih untuk tagihan gabungan">
                    <FileStack className="h-3.5 w-3.5 text-zinc-400" />
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">Jadwal & Urgensi</th>
                  <th className="py-3 px-4 whitespace-nowrap">Booking & Kesiapan</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tamu / Klien</th>
                  <th className="py-3 px-4 whitespace-nowrap">Layanan & Detail</th>
                  <th className="py-3 px-4 whitespace-nowrap text-center">Pembayaran</th>
                  <th className="py-3 px-4 whitespace-nowrap text-center">Voucher</th>
                  <th className="py-3 px-4 whitespace-nowrap">Kontak</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right print:hidden">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] print:divide-zinc-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin text-zinc-400" />
                        <span>Memuat data kedatangan...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayedArrivals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <CalendarCheck className="h-8 w-8 text-zinc-300 stroke-1" />
                        <span className="font-semibold text-zinc-700">Tidak ada jadwal dalam periode ini</span>
                        <span className="text-zinc-400 text-xs">Coba sesuaikan filter atau rentang tanggal</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedArrivals.map((arrival) => {
                    const isHotel = arrival.serviceType === 'hotel';
                    const service = SERVICE_META[arrival.serviceType];
                    const ServiceIcon = service.icon;
                    const isSoon = arrival.daysUntilArrival >= 0 && arrival.daysUntilArrival <= 3;
                    const isUrgent = arrival.isHcnUrgent || (isSoon && (arrival.paymentStatus !== 'paid' || arrival.isAssigneeMissing));

                    return (
                      <tr
                        key={arrival.uid}
                        className={`hover:bg-zinc-50/60 transition-colors ${
                          isUrgent ? 'bg-rose-50/20' : ''
                        } print:text-black print:hover:bg-transparent`}
                      >
                        {/* 0. Combined bill selection */}
                        <td className="py-3 pl-4 pr-0 align-top print:hidden">
                          <input
                            type="checkbox"
                            checked={selectedBookings.has(bookingKey(arrival))}
                            onChange={() => toggleBookingSelection(arrival)}
                            className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-[#111111]"
                            aria-label={`Pilih ${arrival.code} untuk tagihan gabungan`}
                          />
                        </td>

                        {/* 1. Jadwal & Urgensi */}
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="font-bold text-zinc-900 print:text-black">
                            {formatOperationalDate(arrival.checkIn, 'short')}
                          </div>
                          <div className="text-[11px] text-zinc-500 print:text-zinc-600 mt-0.5">
                            {isHotel && arrival.checkOut
                              ? `s.d. ${formatOperationalDate(arrival.checkOut, 'short')}`
                              : `Pukul ${formatOperationalTime(arrival.checkIn)}`}
                          </div>
                          <div className="mt-1.5 print:hidden">
                            {renderUrgencyBadge(arrival.daysUntilArrival)}
                          </div>
                        </td>

                        {/* 2. Booking ID & HCN */}
                        <td className="py-3 px-4 align-top">
                          <button
                            type="button"
                            onClick={() => goToDetail(arrival)}
                            className="font-bold text-zinc-900 hover:text-black hover:underline flex items-center gap-1"
                          >
                            <span>{arrival.code}</span>
                            <ExternalLink className="h-3 w-3 text-zinc-400 print:hidden" />
                          </button>

                          {/* HCN (hotel) or Muthowif/Driver assignment, with visual urgency */}
                          <div className="mt-1">
                            {!isHotel ? (
                              arrival.assigneeName ? (
                                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 print:border-none print:p-0">
                                  <span>{arrival.serviceType === 'muthowif' ? 'Muthowif:' : 'Driver:'}</span>
                                  <span>{arrival.assigneeName}</span>
                                </div>
                              ) : isSoon ? (
                                <div className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded border border-rose-300 animate-pulse print:animate-none">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>⚠ {arrival.serviceType === 'muthowif' ? 'BUTUH MUTHOWIF' : 'BUTUH DRIVER'} SEGERA</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  <span>{arrival.serviceType === 'muthowif' ? 'Belum ada muthowif' : 'Belum ada driver'}</span>
                                </div>
                              )
                            ) : arrival.hotelConfirmationNo ? (
                              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 print:border-none print:p-0">
                                <span>HCN:</span>
                                <span className="font-mono">{arrival.hotelConfirmationNo}</span>
                              </div>
                            ) : arrival.isHcnUrgent ? (
                              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded border border-rose-300 animate-pulse print:animate-none">
                                <AlertTriangle className="h-3 w-3" />
                                <span>⚠ BUTUH HCN SEGERA</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <span>Belum ada HCN</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. Tamu / Klien */}
                        <td className="py-3 px-4 align-top">
                          <div className="font-bold text-zinc-900 print:text-black">
                            {arrival.guestName || arrival.clientName}
                          </div>
                          {arrival.guestName && arrival.clientName && arrival.guestName !== arrival.clientName && (
                            <div className="text-[11px] text-zinc-500 mt-0.5">
                              Agen/Klien: {arrival.clientName}
                            </div>
                          )}
                          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
                            <Users className="h-3 w-3 text-zinc-400" />
                            <span>
                              {arrival.serviceType === 'hotel'
                                ? `${arrival.pax} Pax • ${arrival.totalRooms} Kamar`
                                : arrival.serviceType === 'muthowif'
                                  ? `${arrival.pax} Pax`
                                  : 'Transportasi'}
                            </span>
                          </div>
                        </td>

                        {/* 4. Layanan & Detail */}
                        <td className="py-3 px-4 align-top">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 mb-1 text-[9px] font-bold uppercase tracking-wider rounded border ${service.badgeClass}`}>
                            <ServiceIcon className="h-2.5 w-2.5" />
                            {service.label}
                          </span>
                          {isHotel ? (
                            <>
                              <div className="font-semibold text-zinc-900 print:text-black flex items-center gap-1.5 flex-wrap">
                                <span>{arrival.hotelName}</span>
                                {arrival.source && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-medium bg-zinc-100 text-zinc-700 rounded border border-zinc-200 print:hidden">
                                    via {arrival.source}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-500 mt-0.5">
                                {arrival.city} &bull; {arrival.roomSummary}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-semibold text-zinc-900 print:text-black flex items-start gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-zinc-400 print:hidden shrink-0 mt-0.5" />
                                <span>{arrival.location}</span>
                              </div>
                              {arrival.serviceDetail && (
                                <div className="text-[11px] text-zinc-500 mt-0.5">{arrival.serviceDetail}</div>
                              )}
                              {arrival.assigneePhone && (
                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                  {arrival.serviceType === 'muthowif' ? 'HP Muthowif' : 'HP Driver'}: {arrival.assigneePhone}
                                </div>
                              )}
                            </>
                          )}
                          {arrival.notes && (
                            <div className="text-[10px] text-amber-800 bg-amber-50/60 p-1 rounded mt-1 line-clamp-1 print:line-clamp-none">
                              Catatan: {arrival.notes}
                            </div>
                          )}
                        </td>

                        {/* 5. Pembayaran */}
                        <td className="py-3 px-4 align-top text-center whitespace-nowrap">
                          {arrival.paymentStatus === 'paid' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ Lunas
                            </span>
                          ) : arrival.paymentStatus === 'partial' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              ⚠ Sebagian
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              ✕ Belum Bayar
                            </span>
                          )}
                          <div className="text-[10px] text-zinc-500 font-mono mt-1">
                            {formatCurrency(arrival.totalAmount, 'SAR')}
                          </div>
                        </td>

                        {/* 6. Voucher */}
                        <td className="py-3 px-4 align-top text-center whitespace-nowrap">
                          {arrival.voucherStatus === 'sent' ? (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ Terkirim
                              </span>
                              {arrival.voucherNumber && (
                                <div className="text-[9px] text-zinc-400 font-mono mt-0.5">
                                  {arrival.voucherNumber}
                                </div>
                              )}
                            </div>
                          ) : arrival.voucherStatus === 'issued' ? (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ Diterbitkan
                              </span>
                              {arrival.voucherNumber && (
                                <div className="text-[9px] text-zinc-400 font-mono mt-0.5">
                                  {arrival.voucherNumber}
                                </div>
                              )}
                            </div>
                          ) : arrival.voucherStatus === 'ready_not_sent' ? (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                ⚠ Belum Kirim
                              </span>
                              <div className="text-[9px] text-zinc-400 mt-0.5">Voucher siap</div>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                                ✕ Belum Siap
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 7. Kontak */}
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          {arrival.guestPhone || arrival.clientPhone ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
                              <Phone className="h-3 w-3 text-zinc-400 print:hidden" />
                              <span>{arrival.guestPhone || arrival.clientPhone}</span>
                              {(arrival.guestPhone || arrival.clientPhone) && (
                                <a
                                  href={`https://wa.me/${(arrival.guestPhone || arrival.clientPhone).replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 hover:text-emerald-700 print:hidden ml-0.5"
                                  title="Chat WhatsApp"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-zinc-400">-</span>
                          )}
                          {arrival.guestEmail || arrival.clientEmail ? (
                            <div className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[140px]">
                              {arrival.guestEmail || arrival.clientEmail}
                            </div>
                          ) : null}
                        </td>

                        {/* 8. Aksi (Screen only) */}
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap print:hidden">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToDetail(arrival)}
                            className="h-8 px-2.5 text-xs border-[#e5e7eb] hover:bg-zinc-50 text-zinc-700 font-semibold"
                          >
                            Kelola &rarr;
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <MergeInvoiceModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        selectedInvoices={mergeInvoices}
        onSuccess={(merged) => {
          setIsMergeModalOpen(false);
          setSelectedBookings(new Map());
          queryClient.invalidateQueries({ queryKey: ['arrivals'] });
          navigate({ to: `/create-manual-invoice?id=${merged.id}` as any });
        }}
      />
    </PageLayout>
  );
}
