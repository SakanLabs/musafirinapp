import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router';
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
} from 'lucide-react';
import { authService } from '@/lib/auth';
import { formatCurrency, formatSAR } from '@/lib/utils';
import { useUpcomingArrivals, type ArrivalItem, type ArrivalsFilterParams } from '@/lib/queries/arrivals';
import { getOperationalDateString, formatOperationalDate, getDaysUntilArrival } from '@/lib/date';

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
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch upcoming arrivals
  const queryFilters: ArrivalsFilterParams = {
    from: fromDate,
    to: toDate,
    city: cityFilter,
    hotel: hotelFilter,
    paymentStatus: paymentStatusFilter,
    voucherStatus: voucherStatusFilter,
    search: searchQuery,
  };

  const { data, isLoading, error, refetch, isFetching } = useUpcomingArrivals(queryFilters);

  const arrivals = data?.data || [];
  const summary = data?.summary;

  // Additional in-memory filtering for HCN status if applied
  const displayedArrivals = useMemo(() => {
    if (hcnStatusFilter === 'all') return arrivals;
    if (hcnStatusFilter === 'missing') return arrivals.filter(a => a.isHcnMissing);
    if (hcnStatusFilter === 'urgent_missing') return arrivals.filter(a => a.isHcnUrgent);
    if (hcnStatusFilter === 'available') return arrivals.filter(a => !a.isHcnMissing);
    return arrivals;
  }, [arrivals, hcnStatusFilter]);

  const hasActiveFilters = Boolean(
    fromDate !== defaultToday ||
    toDate !== defaultEndDate ||
    cityFilter !== 'all' ||
    hotelFilter.trim() ||
    paymentStatusFilter !== 'all' ||
    voucherStatusFilter !== 'all' ||
    hcnStatusFilter !== 'all' ||
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
      title="Kedatangan 14 Hari Ke Depan"
      subtitle="Monitoring kedatangan tamu & kesiapan operasional hotel Musafirin"
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
              Upcoming Hotel Arrival Manifest
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
          <div>Total Kedatangan: <span className="font-bold text-black">{displayedArrivals.length}</span> reservasi</div>
          <div>Kedatangan Hari Ini: <span className="font-bold text-black">{summary?.todayArrivals || 0}</span></div>
          <div>3 Hari Ke Depan: <span className="font-bold text-black">{summary?.next3DaysArrivals || 0}</span></div>
          <div>Belum Ada HCN: <span className="font-bold text-rose-700">{summary?.missingHcnCount || 0}</span></div>
          <div>Voucher Belum Terkirim: <span className="font-bold text-amber-700">{summary?.voucherNotSentCount || 0}</span></div>
          <div>Pembayaran Belum Lunas: <span className="font-bold text-rose-700">{summary?.paymentIncompleteCount || 0}</span></div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* SUMMARY CARDS (Screen only) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
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
                  placeholder="Cari ID Booking, HCN, Nama Tamu/Klien, Hotel, No. HP..."
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
                Menampilkan <strong className="text-zinc-900">{displayedArrivals.length}</strong> reservasi
              </div>
            </div>
          </div>
        </Card>

        {/* ========================================================================= */}
        {/* ARRIVALS TABLE */}
        {/* ========================================================================= */}
        <div className="border border-[#e5e7eb] rounded-xl overflow-hidden bg-white shadow-none print:border-black print:rounded-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-[#e5e7eb] text-zinc-600 font-bold uppercase tracking-wider text-[11px] print:bg-zinc-100 print:text-black print:border-black">
                  <th className="py-3 px-4 whitespace-nowrap">Jadwal & Urgensi</th>
                  <th className="py-3 px-4 whitespace-nowrap">Booking & HCN</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tamu / Klien</th>
                  <th className="py-3 px-4 whitespace-nowrap">Hotel & Kamar</th>
                  <th className="py-3 px-4 whitespace-nowrap text-center">Pembayaran</th>
                  <th className="py-3 px-4 whitespace-nowrap text-center">Voucher</th>
                  <th className="py-3 px-4 whitespace-nowrap">Kontak</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right print:hidden">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] print:divide-zinc-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin text-zinc-400" />
                        <span>Memuat data kedatangan...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayedArrivals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <CalendarCheck className="h-8 w-8 text-zinc-300 stroke-1" />
                        <span className="font-semibold text-zinc-700">Tidak ada kedatangan dalam periode ini</span>
                        <span className="text-zinc-400 text-xs">Coba sesuaikan filter atau rentang tanggal</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedArrivals.map((arrival) => {
                    const isUrgent = arrival.isHcnUrgent || (arrival.daysUntilArrival <= 3 && arrival.paymentStatus !== 'paid');

                    return (
                      <tr
                        key={arrival.id}
                        className={`hover:bg-zinc-50/60 transition-colors ${
                          isUrgent ? 'bg-rose-50/20' : ''
                        } print:text-black print:hover:bg-transparent`}
                      >
                        {/* 1. Jadwal & Urgensi */}
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="font-bold text-zinc-900 print:text-black">
                            {formatOperationalDate(arrival.checkIn, 'short')}
                          </div>
                          <div className="text-[11px] text-zinc-500 print:text-zinc-600 mt-0.5">
                            s.d. {formatOperationalDate(arrival.checkOut, 'short')}
                          </div>
                          <div className="mt-1.5 print:hidden">
                            {renderUrgencyBadge(arrival.daysUntilArrival)}
                          </div>
                        </td>

                        {/* 2. Booking ID & HCN */}
                        <td className="py-3 px-4 align-top">
                          <Link
                            to="/booking-detail"
                            search={{ id: String(arrival.id) }}
                            className="font-bold text-zinc-900 hover:text-black hover:underline flex items-center gap-1"
                          >
                            <span>{arrival.code}</span>
                            <ExternalLink className="h-3 w-3 text-zinc-400 print:hidden" />
                          </Link>

                          {/* HCN Display with Visual Urgency */}
                          <div className="mt-1">
                            {arrival.hotelConfirmationNo ? (
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
                            <span>{arrival.pax} Pax &bull; {arrival.totalRooms} Kamar</span>
                          </div>
                        </td>

                        {/* 4. Hotel & Kamar */}
                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-zinc-900 print:text-black flex items-center gap-1">
                            <Building className="h-3.5 w-3.5 text-zinc-400 print:hidden shrink-0" />
                            <span>{arrival.hotelName}</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">
                            {arrival.city} &bull; {arrival.roomSummary}
                          </div>
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
                            onClick={() => navigate({ to: '/booking-detail', search: { id: String(arrival.id) } })}
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
    </PageLayout>
  );
}
