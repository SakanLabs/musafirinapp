import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { PageLayout } from '@/components/layout/PageLayout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authService } from '@/lib/auth'
import {
  RefreshCw,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
  Info,
  TrendingUp,
  PenLine,
  Save,
  DollarSign,
} from 'lucide-react'
import {
  fetchExchangeRateStatus,
  refreshExchangeRate,
  setManualExchangeRate,
  fetchUsdExchangeRateStatus,
  refreshUsdExchangeRate,
  setManualUsdExchangeRate,
  type ExchangeRateStatusResponse,
} from '@/lib/exchange-rate'

export const Route = createFileRoute('/exchange-rates')({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: '/login' })
    }
    const isAdmin = await authService.isAdmin()
    if (!isAdmin) {
      throw redirect({ to: '/dashboard/admin' })
    }
  },
  component: ExchangeRatesPage,
})

function ExchangeRatesPage() {
  // SAR state
  const [sarStatus, setSarStatus] = useState<ExchangeRateStatusResponse['data'] | null>(null)
  const [sarLoading, setSarLoading] = useState(true)
  const [sarRefreshing, setSarRefreshing] = useState(false)
  const [sarManualRate, setSarManualRate] = useState('')
  const [sarSettingManual, setSarSettingManual] = useState(false)

  // USD state
  const [usdStatus, setUsdStatus] = useState<ExchangeRateStatusResponse['data'] | null>(null)
  const [usdLoading, setUsdLoading] = useState(true)
  const [usdRefreshing, setUsdRefreshing] = useState(false)
  const [usdManualRate, setUsdManualRate] = useState('')
  const [usdSettingManual, setUsdSettingManual] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const loadStatuses = useCallback(async () => {
    try {
      setSarLoading(true)
      setUsdLoading(true)
      setError(null)

      const [sarRes, usdRes] = await Promise.allSettled([
        fetchExchangeRateStatus(),
        fetchUsdExchangeRateStatus(),
      ])

      if (sarRes.status === 'fulfilled' && sarRes.value.success) {
        setSarStatus(sarRes.value.data)
      }
      if (usdRes.status === 'fulfilled' && usdRes.value.success) {
        setUsdStatus(usdRes.value.data)
      }

      if (sarRes.status === 'rejected' && usdRes.status === 'rejected') {
        setError('Gagal memuat data kurs')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data kurs')
    } finally {
      setSarLoading(false)
      setUsdLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatuses()
  }, [loadStatuses])

  const handleSarRefresh = async () => {
    try {
      setSarRefreshing(true)
      const response = await refreshExchangeRate()
      if (response.success) {
        toast.success('Kurs SAR berhasil diperbarui dari BCA')
        await loadStatuses()
      } else {
        toast.error('Gagal memperbarui kurs SAR')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui kurs SAR dari BCA')
    } finally {
      setSarRefreshing(false)
    }
  }

  const handleUsdRefresh = async () => {
    try {
      setUsdRefreshing(true)
      const response = await refreshUsdExchangeRate()
      if (response.success) {
        toast.success('Kurs USD berhasil diperbarui dari BCA')
        await loadStatuses()
      } else {
        toast.error('Gagal memperbarui kurs USD')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui kurs USD dari BCA')
    } finally {
      setUsdRefreshing(false)
    }
  }

  const handleRefreshAll = async () => {
    setSarRefreshing(true)
    setUsdRefreshing(true)
    await Promise.allSettled([handleSarRefresh(), handleUsdRefresh()])
  }

  const formatRate = (rate: number) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(rate)
  }

  const formatDateTime = (isoStr: string | null) => {
    if (!isoStr) return '-'
    try {
      const date = new Date(isoStr)
      return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    } catch {
      return isoStr
    }
  }

  const getStatusBadge = (status: ExchangeRateStatusResponse['data'] | null) => {
    if (!status?.hasRate) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
          <XCircle className="h-3.5 w-3.5" />
          Tidak Tersedia
        </span>
      )
    }
    if (status.stale) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          Stale (Cache)
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Aktif
      </span>
    )
  }

  const loading = sarLoading || usdLoading

  if (loading) {
    return (
      <PageLayout title="Kurs BCA" description="Kurs SAR & USD → IDR BCA Bank Notes Sell">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Memuat data kurs...</span>
        </div>
      </PageLayout>
    )
  }

  if (error && !sarStatus && !usdStatus) {
    return (
      <PageLayout title="Kurs BCA" description="Kurs SAR & USD → IDR BCA Bank Notes Sell">
        <Card className="p-8 text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadStatuses}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Coba Lagi
          </Button>
        </Card>
      </PageLayout>
    )
  }

  const sarCurrentRate = sarStatus?.currentRate
  const sarRate = sarCurrentRate?.rate
  const usdCurrentRate = usdStatus?.currentRate
  const usdRate = usdCurrentRate?.rate

  return (
    <PageLayout 
      title="Kurs BCA" 
      description="Kurs SAR & USD → IDR BCA Bank Notes Sell"
      actions={
        <Button 
          onClick={handleRefreshAll} 
          disabled={sarRefreshing || usdRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${(sarRefreshing || usdRefreshing) ? 'animate-spin' : ''}`} />
          {(sarRefreshing || usdRefreshing) ? 'Memperbarui...' : 'Refresh Semua Kurs'}
        </Button>
      }
    >
      {/* ═══════ SAR Section ═══════ */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-xl">﷼</span> SAR → IDR
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* SAR Main Rate Card */}
          <Card className="md:col-span-2 lg:col-span-2 p-0 overflow-hidden">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 opacity-80" />
                  <span className="text-sm font-medium opacity-80">SAR → IDR</span>
                </div>
                {getStatusBadge(sarStatus)}
              </div>
              
              <div className="space-y-1">
                <p className="text-sm opacity-70">1 SAR =</p>
                <p className="text-4xl font-bold tracking-tight">
                  {sarRate ? `Rp ${formatRate(sarRate)}` : '—'}
                </p>
                <p className="text-sm opacity-70">BCA Bank Notes — Sell</p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Rate Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Sumber</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {sarCurrentRate?.source?.startsWith('MANUAL') ? (
                      <span className="text-blue-700">{sarCurrentRate.source}</span>
                    ) : (
                      'BCA Bank Notes Sell'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Tipe</p>
                  <p className="text-sm font-semibold text-gray-800">{sarCurrentRate?.rateType || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Update BCA</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {formatDateTime(sarCurrentRate?.sourceUpdatedAt || null)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Terakhir Diperiksa</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {formatDateTime(sarCurrentRate?.fetchedAt || null)}
                  </p>
                </div>
              </div>
              
              {/* Source attribution */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <Info className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">
                  Kurs referensi: BCA Bank Notes Sell
                </span>
                <a
                  href="https://www.bca.co.id/en/informasi/kurs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 ml-auto"
                >
                  Lihat di BCA
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </Card>

          {/* SAR Service Status Card */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Status SAR</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSarRefresh}
                disabled={sarRefreshing}
                className="gap-1.5 h-8 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${sarRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                {getStatusBadge(sarStatus)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Auto-Refresh</span>
                <span className="text-sm font-medium text-gray-800">
                  Setiap {sarStatus?.refreshIntervalMinutes || 30} menit
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Gagal Berturut</span>
                <span className={`text-sm font-medium ${(sarStatus?.consecutiveFailures || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {sarStatus?.consecutiveFailures || 0}
                </span>
              </div>
              
              <div>
                <span className="text-sm text-gray-500">Terakhir Dicoba</span>
                <p className="text-sm font-medium text-gray-800 mt-0.5">
                  {formatDateTime(sarStatus?.lastRefreshAttempt || null)}
                </p>
              </div>
            </div>

            {sarStatus?.stale && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Perhatian</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Kurs SAR mungkin sudah tidak terbaru. Coba klik "Refresh" atau input kurs manual.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* SAR Manual Rate */}
          <Card className="md:col-span-2 lg:col-span-3 p-6">
            <div className="flex items-center gap-2 mb-4">
              <PenLine className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Input Kurs SAR Manual</h3>
              <span className="text-xs text-gray-400 ml-auto">Fallback jika fetch BCA gagal</span>
            </div>
            
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-xs">
                <label className="text-xs text-gray-500 mb-1 block">1 SAR = Rp</label>
                <Input
                  type="number"
                  placeholder="Contoh: 4839"
                  value={sarManualRate}
                  onChange={(e) => setSarManualRate(e.target.value)}
                  min="1000"
                  max="20000"
                  step="0.01"
                  className="text-lg font-semibold"
                />
              </div>
              <Button
                onClick={async () => {
                  const rateNum = parseFloat(sarManualRate)
                  if (!Number.isFinite(rateNum) || rateNum <= 0) {
                    toast.error('Masukkan kurs SAR yang valid')
                    return
                  }
                  if (rateNum < 1000 || rateNum > 20000) {
                    toast.error('Kurs SAR harus antara 1.000 - 20.000')
                    return
                  }
                  try {
                    setSarSettingManual(true)
                    const response = await setManualExchangeRate(rateNum)
                    if (response.success) {
                      toast.success(response.message || 'Kurs SAR manual berhasil disimpan')
                      setSarManualRate('')
                      await loadStatuses()
                    } else {
                      toast.error('Gagal menyimpan kurs SAR manual')
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Gagal menyimpan kurs SAR manual')
                  } finally {
                    setSarSettingManual(false)
                  }
                }}
                disabled={sarSettingManual || !sarManualRate}
                className="gap-2"
              >
                {sarSettingManual ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {sarSettingManual ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
            
            {sarCurrentRate?.source?.startsWith('MANUAL') && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-800">Kurs SAR Manual Aktif</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Saat ini menggunakan kurs manual yang diinput oleh {sarCurrentRate.source.replace('MANUAL (', '').replace(')', '')}. 
                      Klik "Refresh" untuk kembali menggunakan kurs otomatis dari BCA.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* SAR Conversion Examples */}
          {sarRate && (
            <Card className="md:col-span-2 lg:col-span-3 p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Contoh Konversi SAR</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[100, 500, 1000, 2500].map((sar) => {
                  const idr = Math.round(sar * sarRate)
                  return (
                    <div key={sar} className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">{sar.toLocaleString('en-US')} SAR</p>
                      <p className="text-lg font-bold text-gray-800">
                        Rp {new Intl.NumberFormat('id-ID').format(idr)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 mb-8" />

      {/* ═══════ USD Section ═══════ */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" /> USD → IDR
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* USD Main Rate Card */}
          <Card className="md:col-span-2 lg:col-span-2 p-0 overflow-hidden">
            <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 opacity-80" />
                  <span className="text-sm font-medium opacity-80">USD → IDR</span>
                </div>
                {getStatusBadge(usdStatus)}
              </div>
              
              <div className="space-y-1">
                <p className="text-sm opacity-70">1 USD =</p>
                <p className="text-4xl font-bold tracking-tight">
                  {usdRate ? `Rp ${formatRate(usdRate)}` : '—'}
                </p>
                <p className="text-sm opacity-70">BCA Bank Notes — Sell</p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Rate Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Sumber</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {usdCurrentRate?.source?.startsWith('MANUAL') ? (
                      <span className="text-green-700">{usdCurrentRate.source}</span>
                    ) : (
                      'BCA Bank Notes Sell'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Tipe</p>
                  <p className="text-sm font-semibold text-gray-800">{usdCurrentRate?.rateType || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Update BCA</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {formatDateTime(usdCurrentRate?.sourceUpdatedAt || null)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Terakhir Diperiksa</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {formatDateTime(usdCurrentRate?.fetchedAt || null)}
                  </p>
                </div>
              </div>
              
              {/* Source attribution */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <Info className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">
                  Kurs referensi: BCA Bank Notes Sell
                </span>
                <a
                  href="https://www.bca.co.id/en/informasi/kurs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-600 hover:underline inline-flex items-center gap-1 ml-auto"
                >
                  Lihat di BCA
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </Card>

          {/* USD Service Status Card */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Status USD</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUsdRefresh}
                disabled={usdRefreshing}
                className="gap-1.5 h-8 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${usdRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                {getStatusBadge(usdStatus)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Auto-Refresh</span>
                <span className="text-sm font-medium text-gray-800">
                  Setiap {usdStatus?.refreshIntervalMinutes || 30} menit
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Gagal Berturut</span>
                <span className={`text-sm font-medium ${(usdStatus?.consecutiveFailures || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {usdStatus?.consecutiveFailures || 0}
                </span>
              </div>
              
              <div>
                <span className="text-sm text-gray-500">Terakhir Dicoba</span>
                <p className="text-sm font-medium text-gray-800 mt-0.5">
                  {formatDateTime(usdStatus?.lastRefreshAttempt || null)}
                </p>
              </div>
            </div>

            {usdStatus?.stale && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Perhatian</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Kurs USD mungkin sudah tidak terbaru. Coba klik "Refresh" atau input kurs manual.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* USD Manual Rate */}
          <Card className="md:col-span-2 lg:col-span-3 p-6">
            <div className="flex items-center gap-2 mb-4">
              <PenLine className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Input Kurs USD Manual</h3>
              <span className="text-xs text-gray-400 ml-auto">Fallback jika fetch BCA gagal</span>
            </div>
            
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-xs">
                <label className="text-xs text-gray-500 mb-1 block">1 USD = Rp</label>
                <Input
                  type="number"
                  placeholder="Contoh: 16000"
                  value={usdManualRate}
                  onChange={(e) => setUsdManualRate(e.target.value)}
                  min="12000"
                  max="25000"
                  step="0.01"
                  className="text-lg font-semibold"
                />
              </div>
              <Button
                onClick={async () => {
                  const rateNum = parseFloat(usdManualRate)
                  if (!Number.isFinite(rateNum) || rateNum <= 0) {
                    toast.error('Masukkan kurs USD yang valid')
                    return
                  }
                  if (rateNum < 12000 || rateNum > 25000) {
                    toast.error('Kurs USD harus antara 12.000 - 25.000')
                    return
                  }
                  try {
                    setUsdSettingManual(true)
                    const response = await setManualUsdExchangeRate(rateNum)
                    if (response.success) {
                      toast.success(response.message || 'Kurs USD manual berhasil disimpan')
                      setUsdManualRate('')
                      await loadStatuses()
                    } else {
                      toast.error('Gagal menyimpan kurs USD manual')
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Gagal menyimpan kurs USD manual')
                  } finally {
                    setUsdSettingManual(false)
                  }
                }}
                disabled={usdSettingManual || !usdManualRate}
                className="gap-2"
              >
                {usdSettingManual ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {usdSettingManual ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
            
            {usdCurrentRate?.source?.startsWith('MANUAL') && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-green-800">Kurs USD Manual Aktif</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      Saat ini menggunakan kurs manual yang diinput oleh {usdCurrentRate.source.replace('MANUAL (', '').replace(')', '')}. 
                      Klik "Refresh" untuk kembali menggunakan kurs otomatis dari BCA.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* USD Conversion Examples */}
          {usdRate && (
            <Card className="md:col-span-2 lg:col-span-3 p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Contoh Konversi USD</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[50, 100, 500, 1000].map((usd) => {
                  const idr = Math.round(usd * usdRate)
                  return (
                    <div key={usd} className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">${usd.toLocaleString('en-US')}</p>
                      <p className="text-lg font-bold text-gray-800">
                        Rp {new Intl.NumberFormat('id-ID').format(idr)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-6 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-gray-400" />
        <p className="text-xs text-gray-400">
          Semua kurs diperbarui otomatis setiap {sarStatus?.refreshIntervalMinutes || 30} menit dari BCA Bank Notes Sell.
        </p>
      </div>
    </PageLayout>
  )
}
