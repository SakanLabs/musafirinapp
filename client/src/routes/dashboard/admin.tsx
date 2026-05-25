import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import {
  Calendar,
  FileText,
  Ticket,
  Users,
  TrendingUp,
  Eye,
  Share,
  Plus,
  Loader2,
  Car,
  Plane,
  Activity,
  ArrowRight,
  TrendingDown,
  Building,
  ClipboardList
} from "lucide-react"

import { formatCurrency, formatDate, getBookingStatusColor, shareToWhatsApp, generateBookingWhatsAppMessage } from "@/lib/utils"
import { useDashboardSummary } from "@/lib/queries"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/dashboard/admin")({
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: AdminDashboard
})

function AdminDashboard() {
  const navigate = useNavigate();
  const { data: dashboardData, isLoading, error } = useDashboardSummary();
  const [activeChartMetric, setActiveChartMetric] = useState<"revenue" | "bookings">("revenue");
  const [hoveredChartIndex, setHoveredChartIndex] = useState<number | null>(null);

  // Show loading state
  if (isLoading) {
    return (
      <PageLayout title="Dashboard" subtitle="Musafirin Bookings Management System Overview">
        <div className="flex flex-col items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-[#111111] mb-3" />
          <span className="text-sm font-medium text-[#6b7280]">Synchronizing live operational metrics...</span>
        </div>
      </PageLayout>
    );
  }

  // Show error state
  if (error) {
    return (
      <PageLayout title="Dashboard" subtitle="Musafirin Bookings Management System Overview">
        <div className="flex items-center justify-center h-64">
          <div className="text-center p-8 bg-white border border-[#e5e7eb] rounded-xl max-w-md shadow-xs">
            <TrendingDown className="h-10 w-10 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#111111] tracking-[-0.03em]">Failed to sync dashboard metrics</h3>
            <p className="text-sm text-gray-500 mt-2 mb-6">We encountered a temporary network or API communication error while fetching operational summaries.</p>
            <Button className="bg-[#111111] hover:bg-[#242424] text-white" onClick={() => window.location.reload()}>
              Retry Connection
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Ensure dashboardData exists
  if (!dashboardData) {
    return (
      <PageLayout title="Dashboard" subtitle="Musafirin Bookings Management System Overview">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">No dashboard metrics available</p>
        </div>
      </PageLayout>
    );
  }

  const handleShareWhatsApp = (booking: typeof dashboardData.recentBookings[0]) => {
    const message = generateBookingWhatsAppMessage({
      code: booking.id,
      clientName: booking.guestName,
      hotelName: booking.roomType,
      checkIn: booking.checkInDate,
      checkOut: booking.checkInDate, // Using checkInDate as placeholder since checkOut is not in the API response
      totalAmount: booking.totalAmount.toString(),
      currency: 'SAR'
    })

    shareToWhatsApp({ message })
  }

  // Define columns for recent bookings table
  const bookingColumns: Column<typeof dashboardData.recentBookings[0]>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      width: 'w-24',
      render: (booking) => (
        <span className="font-mono text-xs font-semibold text-[#111111]">
          #{booking.id}
        </span>
      )
    },
    {
      key: 'guestName',
      header: 'Guest / Client',
      sortable: true,
      render: (booking) => (
        <div>
          <div className="font-medium text-[#111111] text-sm">{booking.guestName}</div>
          <div className="text-xs text-gray-400 mt-0.5">Primary Guest</div>
        </div>
      )
    },
    {
      key: 'roomType',
      header: 'Booking Details',
      sortable: true,
      render: (booking) => (
        <div>
          <div className="font-medium text-[#374151] text-xs flex items-center gap-1.5">
            <Building className="h-3 w-3 text-gray-400" />
            {booking.roomType || 'N/A Room'}
          </div>
        </div>
      )
    },
    {
      key: 'checkInDate',
      header: 'Check-in',
      render: (booking) => (
        <span className="text-xs font-medium text-[#374151] bg-[#f8f9fa] border border-[#e5e7eb] px-2 py-1 rounded-md">
          {formatDate(booking.checkInDate)}
        </span>
      ),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'totalAmount',
      header: 'Total Value',
      render: (booking) => (
        <span className="font-semibold text-sm text-[#111111]">
          {formatCurrency(booking.totalAmount.toString(), 'SAR')}
        </span>
      ),
      sortable: true,
      width: 'w-32'
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => {
        const rawStatus = booking.status.toLowerCase();
        let variantColor = "bg-[#f3f4f6] text-gray-800 border-gray-200";
        if (rawStatus === 'confirmed') variantColor = "bg-[#ecfdf5] text-[#047857] border-[#d1fae5]";
        if (rawStatus === 'pending') variantColor = "bg-[#fffbeb] text-[#d97706] border-[#fef3c7]";
        if (rawStatus === 'cancelled') variantColor = "bg-[#fef2f2] text-[#b91c1c] border-[#fee2e2]";
        if (rawStatus === 'completed') variantColor = "bg-[#eff6ff] text-[#1d4ed8] border-[#dbeafe]";

        return (
          <Badge className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${variantColor}`}>
            {booking.status}
          </Badge>
        )
      },
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (booking) => (
        <div className="flex space-x-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-full border border-transparent hover:border-[#e5e7eb] hover:bg-[#f8f9fa] transition-all"
            onClick={() => navigate({ to: "/booking-detail", search: { id: booking.id.toString() } })}
            title="View Details"
          >
            <Eye className="h-3.5 w-3.5 text-[#374151]" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-full border border-transparent hover:border-[#e5e7eb] hover:bg-[#f8f9fa] transition-all"
            onClick={() => handleShareWhatsApp(booking)}
            title="Share via WhatsApp"
          >
            <Share className="h-3.5 w-3.5 text-[#10b981]" />
          </Button>
        </div>
      ),
      width: 'w-24'
    }
  ]

  // SVG Chart points calculation helper
  const chartData = dashboardData.monthlyRevenue || [];
  const chartWidth = 600;
  const chartHeight = 220;
  const paddingX = 50;
  const paddingY = 30;

  const getChartPoints = () => {
    if (chartData.length === 0) return [];
    const values = chartData.map(item => activeChartMetric === 'revenue' ? item.revenue : item.bookings);
    const maxVal = Math.max(...values, 1);
    const minVal = 0; // standard floor to show real metrics contrast
    const range = maxVal - minVal;

    return chartData.map((item, idx) => {
      const x = paddingX + (idx / (chartData.length - 1 || 1)) * (chartWidth - paddingX * 2);
      const val = activeChartMetric === 'revenue' ? item.revenue : item.bookings;
      const y = chartHeight - paddingY - ((val - minVal) / range) * (chartHeight - paddingY * 2);
      return { x, y, val, item, idx };
    });
  };

  const points = getChartPoints();
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : '';

  // Max value of room stats for horizontal bars
  const maxRoomTypeBookings = Math.max(...(dashboardData.roomTypeStats || []).map(r => r.bookings), 1);

  return (
    <PageLayout
      title="System Dashboard"
      subtitle="Hotel Bookings & Travel Operations Summary"
      actions={
        <Button 
          onClick={() => navigate({ to: "/create-booking" })}
          className="bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold px-4 h-9 rounded-md transition-all shadow-xs flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Booking
        </Button>
      }
    >
      <div className="space-y-8 max-w-[1400px] mx-auto pb-12">
        {/* Editorial Greeting Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#e5e7eb] gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.04em] text-[#111111] font-sans">
              Operations Overview
            </h2>
            <p className="text-[#6b7280] text-sm mt-1">
              Platform summary syncing hotel bookings, client CRM, and invoices in real-time.
            </p>
          </div>
          <div className="flex items-center space-x-2 self-start md:self-center">
            <div className="flex items-center space-x-1.5 bg-[#f8f9fa] border border-[#e5e7eb] px-3 py-1.5 rounded-full text-xs font-semibold text-[#374151]">
              <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>Operations Live</span>
            </div>
          </div>
        </div>

        {/* 4 Premium High-Contrast KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Revenue */}
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Gross Revenue</span>
              <div className="h-2.5 w-2.5 rounded-full bg-[#fb923c]" title="Pastel Highlight" />
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-[#111111] tracking-[-0.04em]">
                {formatCurrency(dashboardData.totalRevenue.toString(), 'SAR')}
              </h3>
              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#10b981]"></span>
                Total accrued platform billing
              </p>
            </div>
            {/* Visual Mini Progress */}
            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-[#374151]">
              <span>Invoiced Receivables</span>
              <span className="font-semibold">{dashboardData.totalInvoices} Invoices</span>
            </div>
          </div>

          {/* Card 2: Bookings Count */}
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Active Bookings</span>
              <div className="h-2.5 w-2.5 rounded-full bg-[#ec4899]" />
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-[#111111] tracking-[-0.04em]">
                {dashboardData.totalBookings} <span className="text-xs text-gray-400 font-normal">Bookings</span>
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-semibold bg-[#ecfdf5] text-[#047857] px-1.5 py-0.5 rounded border border-[#d1fae5]">
                  {dashboardData.confirmedBookings} Confirmed
                </span>
                <span className="text-[10px] font-semibold bg-[#eff6ff] text-[#1d4ed8] px-1.5 py-0.5 rounded border border-[#dbeafe]">
                  {dashboardData.completedBookings} Done
                </span>
              </div>
            </div>
            {/* Mini visual list */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-[#6b7280]">
              <span>Pending: {dashboardData.pendingBookings}</span>
              <span>Cancelled: {dashboardData.cancelledBookings}</span>
            </div>
          </div>

          {/* Card 3: Invoicing Status */}
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Invoice Tracking</span>
              <div className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" />
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-[#111111] tracking-[-0.04em]">
                {dashboardData.paidInvoices} <span className="text-xs text-gray-400 font-normal">Paid</span>
              </h3>
              <p className="text-xs text-[#6b7280] mt-1.5 flex items-center justify-between">
                <span>Total invoices raised</span>
                <span className="font-semibold text-[#111111]">{dashboardData.totalInvoices}</span>
              </p>
            </div>
            {/* Collections Percentage */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium text-[#374151]">
                <span>Collections Rate</span>
                <span>{Math.round((dashboardData.paidInvoices / (dashboardData.totalInvoices || 1)) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#111111] rounded-full" 
                  style={{ width: `${(dashboardData.paidInvoices / (dashboardData.totalInvoices || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: Voucher Utilization */}
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Voucher Registry</span>
              <div className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-[#111111] tracking-[-0.04em]">
                {dashboardData.totalVouchers} <span className="text-xs text-gray-400 font-normal">Vouchers</span>
              </h3>
              <p className="text-xs text-[#6b7280] mt-1.5 flex items-center justify-between">
                <span>Used / Redeemed</span>
                <span className="font-semibold text-[#111111]">{dashboardData.usedVouchers} Used</span>
              </p>
            </div>
            {/* Redemptions progress bar */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium text-[#374151]">
                <span>Utilization Rate</span>
                <span>{Math.round((dashboardData.usedVouchers / (dashboardData.totalVouchers || 1)) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#34d399] rounded-full" 
                  style={{ width: `${(dashboardData.usedVouchers / (dashboardData.totalVouchers || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Large Performance Trend Chart Card (Product UI Fragment) */}
        <div className="bg-white border border-[#e5e7eb] rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#f3f4f6]">
            <div>
              <h3 className="text-lg font-bold tracking-[-0.03em] text-[#111111]">
                Platform Metrics Trend
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Visualizing operational capacity and billing velocity month-over-month.
              </p>
            </div>
            {/* Custom Nav-Pill-Group Switcher */}
            <div className="bg-[#f8f9fa] border border-[#e5e7eb] p-1 rounded-full inline-flex self-start sm:self-center">
              <button
                onClick={() => { setActiveChartMetric('revenue'); setHoveredChartIndex(null); }}
                className={`px-4 py-1 rounded-full text-xs font-semibold transition-all ${
                  activeChartMetric === 'revenue'
                    ? 'bg-[#ffffff] text-[#111111] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                    : 'text-gray-400 hover:text-[#111111]'
                }`}
              >
                Revenue (SAR)
              </button>
              <button
                onClick={() => { setActiveChartMetric('bookings'); setHoveredChartIndex(null); }}
                className={`px-4 py-1 rounded-full text-xs font-semibold transition-all ${
                  activeChartMetric === 'bookings'
                    ? 'bg-[#ffffff] text-[#111111] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                    : 'text-gray-400 hover:text-[#111111]'
                }`}
              >
                Bookings Count
              </button>
            </div>
          </div>

          {/* Interactive Chart Container */}
          <div className="relative mt-8 select-none">
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] text-gray-400">
                <Activity className="h-8 w-8 mb-2 animate-pulse text-gray-300" />
                <span className="text-xs">No metrics recorded for the active period.</span>
              </div>
            ) : (
              <>
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-[220px] overflow-visible"
                  style={{ contentVisibility: 'auto' }}
                >
                  <defs>
                    <linearGradient id="chartLineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#111111" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#111111" stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guidelines */}
                  {Array.from({ length: 4 }).map((_, i) => {
                    const yVal = paddingY + (i / 3) * (chartHeight - paddingY * 2);
                    return (
                      <line
                        key={i}
                        x1={paddingX}
                        y1={yVal}
                        x2={chartWidth - paddingX}
                        y2={yVal}
                        stroke="#f3f4f6"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                    );
                  })}

                  {/* Area fill */}
                  {areaPath && (
                    <path
                      d={areaPath}
                      fill="url(#chartLineGrad)"
                    />
                  )}

                  {/* Bold line stroke */}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#111111"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Data Points */}
                  {points.map((p, idx) => (
                    <g key={idx}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={hoveredChartIndex === idx ? 6 : 4}
                        fill={hoveredChartIndex === idx ? "#111111" : "#ffffff"}
                        stroke="#111111"
                        strokeWidth="2.5"
                        className="transition-all duration-150"
                      />
                      {/* Label on points */}
                      <text
                        x={p.x}
                        y={chartHeight - 8}
                        textAnchor="middle"
                        className="text-[10px] font-semibold fill-gray-400"
                      >
                        {p.item.month}
                      </text>
                    </g>
                  ))}

                  {/* Hover guideline */}
                  {hoveredChartIndex !== null && points[hoveredChartIndex] && (
                    <line
                      x1={points[hoveredChartIndex].x}
                      y1={paddingY}
                      x2={points[hoveredChartIndex].x}
                      y2={chartHeight - paddingY}
                      stroke="#111111"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Invisible broad hover grids for easy interactive touches */}
                  {points.map((p, idx) => {
                    const colWidth = (chartWidth - paddingX * 2) / (points.length - 1 || 1);
                    return (
                      <rect
                        key={idx}
                        x={p.x - colWidth / 2}
                        y={0}
                        width={colWidth}
                        height={chartHeight}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredChartIndex(idx)}
                        onMouseLeave={() => setHoveredChartIndex(null)}
                      />
                    );
                  })}
                </svg>

                {/* Floating Tooltip HTML Popup */}
                {hoveredChartIndex !== null && points[hoveredChartIndex] && (
                  <div
                    className="absolute bg-[#111111] text-[#ffffff] text-xs p-3 rounded-lg shadow-lg pointer-events-none z-10 border border-gray-800 transition-all duration-150"
                    style={{
                      left: `${((points[hoveredChartIndex].x - paddingX) / (chartWidth - paddingX * 2)) * 100}%`,
                      marginLeft: `${paddingX}px`,
                      top: `${(points[hoveredChartIndex].y / chartHeight) * 100}%`,
                      transform: 'translate(-50%, -125%)',
                    }}
                  >
                    <div className="font-semibold text-gray-400 uppercase tracking-wider text-[9px]">
                      {points[hoveredChartIndex].item.month}
                    </div>
                    <div className="mt-1 font-bold text-sm text-white">
                      {activeChartMetric === 'revenue'
                        ? formatCurrency(points[hoveredChartIndex].val.toString(), 'SAR')
                        : `${points[hoveredChartIndex].val} Bookings`
                      }
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {activeChartMetric === 'revenue' 
                        ? `${points[hoveredChartIndex].item.bookings} bookings processed`
                        : `${formatCurrency(points[hoveredChartIndex].item.revenue.toString(), 'SAR')} accrued`
                      }
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Breakdown split grid (2-Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Room Type Distribution Widget */}
          <div className="lg:col-span-2 bg-white border border-[#e5e7eb] rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-md font-bold tracking-[-0.03em] text-[#111111] mb-2">
              Room Type Distribution
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              Listing popular booking packages alongside corresponding volume.
            </p>

            <div className="space-y-4">
              {(!dashboardData.roomTypeStats || dashboardData.roomTypeStats.length === 0) ? (
                <p className="text-xs text-gray-400 text-center py-6">No package stats recorded.</p>
              ) : (
                dashboardData.roomTypeStats.slice(0, 5).map((stat, idx) => {
                  const percentage = (stat.bookings / maxRoomTypeBookings) * 100;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#374151] flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#111111]"></span>
                          {stat.roomType || 'N/A Option'}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400">{stat.bookings} bookings</span>
                          <span className="text-[#111111]">{formatCurrency(stat.revenue.toString(), 'SAR')}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#111111] rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pending Invoices Receivables Widget (flips to Surface Card style) */}
          <div className="bg-[#f5f5f5] rounded-xl p-6 border border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <h3 className="text-md font-bold tracking-[-0.03em] text-[#111111] mb-1">
                Outstanding Accounts
              </h3>
              <p className="text-xs text-gray-500 mb-6">
                Monitoring pending invoices against complete collections.
              </p>

              <div className="space-y-5">
                <div className="p-4 bg-white rounded-lg border border-[#e5e7eb]">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Unpaid / Outstanding</span>
                  <div className="text-xl font-bold text-[#111111] tracking-[-0.03em] mt-1">
                    {dashboardData.pendingInvoices} <span className="text-xs text-[#6b7280] font-normal">Pending Invoices</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/60 rounded-lg">
                    <span className="text-[9px] font-semibold text-gray-400 uppercase">Paid Items</span>
                    <div className="text-sm font-bold text-[#047857] mt-0.5">{dashboardData.paidInvoices}</div>
                  </div>
                  <div className="p-3 bg-white/60 rounded-lg">
                    <span className="text-[9px] font-semibold text-gray-400 uppercase">Total Items</span>
                    <div className="text-sm font-bold text-[#111111] mt-0.5">{dashboardData.totalInvoices}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-gray-200">
              <Button 
                onClick={() => navigate({ to: "/invoices" })}
                className="w-full bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold h-9 rounded-md transition-all flex items-center justify-center gap-1"
              >
                Manage Invoices
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Polished Recent Bookings Section */}
        <div className="bg-white border border-[#e5e7eb] rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between pb-6 border-b border-[#f3f4f6] mb-6">
            <div>
              <h3 className="text-lg font-bold tracking-[-0.03em] text-[#111111]">
                Recent Bookings
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                A real-time list of the most recent hotel reservations added.
              </p>
            </div>
            <Button 
              variant="outline" 
              className="text-xs font-semibold px-4 h-8 border-[#e5e7eb] hover:bg-[#f8f9fa] rounded-md transition-all text-[#374151]"
              onClick={() => navigate({ to: "/bookings" })}
            >
              View All Bookings
            </Button>
          </div>

          <DataTable
            data={dashboardData.recentBookings}
            columns={bookingColumns}
            emptyMessage="No bookings records found on the system."
          />
        </div>

        {/* Premium Quick Actions Menu */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            System Shortcuts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Shortcut 1 */}
            <div className="bg-white rounded-xl border border-[#e5e7eb] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-gray-300 transition-all flex flex-col justify-between h-[150px]">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-[#111111]">All Bookings</h4>
                  <Calendar className="h-4 w-4 text-[#111111]" />
                </div>
                <p className="text-xs text-gray-400">View and filter hotel reservations registry.</p>
              </div>
              <Button 
                variant="link" 
                className="p-0 text-xs font-semibold text-[#111111] hover:underline flex items-center justify-start gap-1 mt-4 self-start"
                onClick={() => navigate({ to: "/bookings" })}
              >
                Open Bookings
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>

            {/* Shortcut 2 */}
            <div className="bg-white rounded-xl border border-[#e5e7eb] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-gray-300 transition-all flex flex-col justify-between h-[150px]">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-[#111111]">Client CRM</h4>
                  <Users className="h-4 w-4 text-[#111111]" />
                </div>
                <p className="text-xs text-gray-400">Manage client contact database and history.</p>
              </div>
              <Button 
                variant="link" 
                className="p-0 text-xs font-semibold text-[#111111] hover:underline flex items-center justify-start gap-1 mt-4 self-start"
                onClick={() => navigate({ to: "/clients" })}
              >
                Open CRM
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>

            {/* Shortcut 3 */}
            <div className="bg-white rounded-xl border border-[#e5e7eb] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-gray-300 transition-all flex flex-col justify-between h-[150px]">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-[#111111]">Transportation</h4>
                  <Car className="h-4 w-4 text-[#111111]" />
                </div>
                <p className="text-xs text-gray-400">Track transport schedules and vehicle allocations.</p>
              </div>
              <Button 
                variant="link" 
                className="p-0 text-xs font-semibold text-[#111111] hover:underline flex items-center justify-start gap-1 mt-4 self-start"
                onClick={() => navigate({ to: "/transportation-bookings" })}
              >
                Open Transport
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>

            {/* Shortcut 4 */}
            <div className="bg-white rounded-xl border border-[#e5e7eb] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-gray-300 transition-all flex flex-col justify-between h-[150px]">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-[#111111]">Muthowifs Master</h4>
                  <ClipboardList className="h-4 w-4 text-[#111111]" />
                </div>
                <p className="text-xs text-gray-400">Manage muthowifs guides database.</p>
              </div>
              <Button 
                variant="link" 
                className="p-0 text-xs font-semibold text-[#111111] hover:underline flex items-center justify-start gap-1 mt-4 self-start"
                onClick={() => navigate({ to: "/dashboard/muthowifs" })}
              >
                Open Muthowifs
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}