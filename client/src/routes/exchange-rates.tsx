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
} from 'lucide-react'
import {
  fetchExchangeRateStatus,
  refreshExchangeRate,
  setManualExchangeRate,
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
  const [status, setStatus] = useState<ExchangeRateStatusResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualRate, setManualRate] = useState('')
  const [settingManual, setSettingManual] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetchExchangeRateStatus()
      if (response.success) {
        setStatus(response.data)
      } else {
        setError('Gagal memuat data kurs')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data kurs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      const response = await refreshExchangeRate()
      if (response.success) {
        toast.success('Kurs berhasil diperbarui dari BCA')
        await loadStatus()
      } else {
        toast.error('Gagal memperbarui kurs')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui kurs dari BCA')
    } finally {
      setRefreshing(false)
    }
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

  const getStatusBadge = () => {
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
          Stale (Menggunakan Cache)
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

  if (loading) {
    return (
      <PageLayout title="Kurs BCA" description="Kurs SAR → IDR BCA Bank Notes Sell">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Memuat data kurs...</span>
        </div>
      </PageLayout>
    )
  }

  if (error && !status) {
    return (
      <PageLayout title="Kurs BCA" description="Kurs SAR → IDR BCA Bank Notes Sell">
        <Card className="p-8 text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadStatus}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Coba Lagi
          </Button>
        </Card>
      </PageLayout>
    )
  }

  const currentRate = status?.currentRate
  const rate = currentRate?.rate

  return (
    <PageLayout 
      title="Kurs BCA" 
      description="Kurs SAR → IDR BCA Bank Notes Sell"
      actions={
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Memperbarui...' : 'Refresh Kurs'}
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Main Rate Card */}
        <Card className="md:col-span-2 lg:col-span-2 p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 opacity-80" />
                <span className="text-sm font-medium opacity-80">SAR → IDR</span>
              </div>
              {getStatusBadge()}
            </div>
            
            <div className="space-y-1">
              <p className="text-sm opacity-70">1 SAR =</p>
              <p className="text-4xl font-bold tracking-tight">
                {rate ? `Rp ${formatRate(rate)}` : '—'}
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
                  {currentRate?.source?.startsWith('MANUAL') ? (
                    <span className="text-blue-700">{currentRate.source}</span>
                  ) : (
                    'BCA Bank Notes Sell'
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Tipe</p>
                <p className="text-sm font-semibold text-gray-800">{currentRate?.rateType || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Update BCA</p>
                <p className="text-sm font-semibold text-gray-800">
                  {formatDateTime(currentRate?.sourceUpdatedAt || null)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Terakhir Diperiksa</p>
                <p className="text-sm font-semibold text-gray-800">
                  {formatDateTime(currentRate?.fetchedAt || null)}
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

        {/* Service Status Card */}
        <Card className="p-6 space-y-5">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Status Layanan</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              {getStatusBadge()}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Auto-Refresh</span>
              <span className="text-sm font-medium text-gray-800">
                Setiap {status?.refreshIntervalMinutes || 30} menit
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Gagal Berturut</span>
              <span className={`text-sm font-medium ${(status?.consecutiveFailures || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {status?.consecutiveFailures || 0}
              </span>
            </div>
            
            <div>
              <span className="text-sm text-gray-500">Terakhir Dicoba</span>
              <p className="text-sm font-medium text-gray-800 mt-0.5">
                {formatDateTime(status?.lastRefreshAttempt || null)}
              </p>
            </div>
          </div>

          {status?.stale && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Perhatian</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Kurs yang ditampilkan mungkin sudah tidak terbaru. Coba klik "Refresh Kurs" atau input kurs manual.
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Manual Rate Input Card */}
        <Card className="md:col-span-2 lg:col-span-3 p-6">
          <div className="flex items-center gap-2 mb-4">
            <PenLine className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Input Kurs Manual</h3>
            <span className="text-xs text-gray-400 ml-auto">Fallback jika fetch BCA gagal</span>
          </div>
          
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="text-xs text-gray-500 mb-1 block">1 SAR = Rp</label>
              <Input
                type="number"
                placeholder="Contoh: 4839"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
                min="1000"
                max="20000"
                step="0.01"
                className="text-lg font-semibold"
              />
            </div>
            <Button
              onClick={async () => {
                const rateNum = parseFloat(manualRate)
                if (!Number.isFinite(rateNum) || rateNum <= 0) {
                  toast.error('Masukkan kurs yang valid')
                  return
                }
                if (rateNum < 1000 || rateNum > 20000) {
                  toast.error('Kurs harus antara 1.000 - 20.000')
                  return
                }
                try {
                  setSettingManual(true)
                  const response = await setManualExchangeRate(rateNum)
                  if (response.success) {
                    toast.success(response.message || 'Kurs manual berhasil disimpan')
                    setManualRate('')
                    await loadStatus()
                  } else {
                    toast.error('Gagal menyimpan kurs manual')
                  }
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Gagal menyimpan kurs manual')
                } finally {
                  setSettingManual(false)
                }
              }}
              disabled={settingManual || !manualRate}
              className="gap-2"
            >
              {settingManual ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {settingManual ? 'Menyimpan...' : 'Simpan Kurs Manual'}
            </Button>
          </div>
          
          {currentRate?.source?.startsWith('MANUAL') && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-blue-800">Kurs Manual Aktif</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Saat ini menggunakan kurs manual yang diinput oleh {currentRate.source.replace('MANUAL (', '').replace(')', '')}. 
                    Klik "Refresh Kurs" untuk kembali menggunakan kurs otomatis dari BCA.
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Conversion Example Card */}
        {rate && (
          <Card className="md:col-span-2 lg:col-span-3 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Contoh Konversi</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[100, 500, 1000, 2500].map((sar) => {
                const idr = Math.round(sar * rate)
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
            
            <div className="mt-4 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-xs text-gray-400">
                Konversi menggunakan kurs BCA Bank Notes Sell terbaru. Kurs diperbarui otomatis setiap {status?.refreshIntervalMinutes || 30} menit.
              </p>
            </div>
          </Card>
        )}
      </div>
    </PageLayout>
  )
}
