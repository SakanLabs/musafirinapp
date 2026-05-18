import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PageLayout } from '@/components/layout/PageLayout'
import { apiClient } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, User, Phone, MapPin, GraduationCap, Calendar, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const Route = createFileRoute('/dashboard/muthowifs/$id')({
  component: MuthowifDetailPage,
})

function MuthowifDetailPage() {
  const { id } = Route.useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ['muthowif', id],
    queryFn: () => apiClient.get(`/api/muthowifs/${id}`)
  })

  if (isLoading) {
    return <PageLayout title="Loading..."><div className="text-center py-10">Memuat data...</div></PageLayout>
  }

  if (error || !data) {
    return <PageLayout title="Error"><div className="text-center py-10 text-red-500">Gagal memuat data Muthowif.</div></PageLayout>
  }

  const { muthowif, assignments } = data as any

  return (
    <PageLayout
      title={`Detail Muthowif: ${muthowif.name}`}
      description="Informasi profil dan riwayat penugasan muthowif"
      icon={<User className="h-6 w-6" />}
    >
      <div className="space-y-6">
        <div>
          <Link to="/dashboard/muthowifs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Profil Muthowif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500">Nama Lengkap</label>
                <p className="text-sm font-semibold">{muthowif.name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Status Saat Ini</label>
                <div className="mt-1">
                  <Badge variant={muthowif.status === 'idle' ? 'success' : muthowif.status === 'assigned' ? 'destructive' : 'secondary'}>
                    {muthowif.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-sm">{muthowif.phone}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-sm">{muthowif.residenceLocation || '-'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <GraduationCap className="h-4 w-4 text-gray-400" />
                <span className="text-sm">{muthowif.lastEducation || 'Tidak ada data'}</span>
              </div>
              
              <div className="pt-4 border-t">
                <label className="text-xs font-medium text-gray-500">Tipe / Visa</label>
                <p className="text-sm capitalize">{muthowif.residentType} - {muthowif.visaStatus}</p>
              </div>
            </CardContent>
          </Card>

          {/* Assignments Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Riwayat Penugasan</CardTitle>
            </CardHeader>
            <CardContent>
              {assignments && assignments.length > 0 ? (
                <div className="space-y-4">
                  {assignments.map((assignment: any) => (
                    <div key={assignment.id} className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>
                            {assignment.status === 'active' ? 'Sedang Bertugas' : 'Selesai'}
                          </Badge>
                          <span className="ml-2 text-xs font-medium text-gray-500 capitalize">
                            Tipe: {assignment.referenceType.replace('_', ' ')}
                          </span>
                        </div>
                        <Link 
                          to={
                            assignment.referenceType === 'booking' 
                              ? '/booking-detail' 
                              : assignment.referenceType === 'custom_la' 
                                ? '/custom-la-detail/$id'
                                : '/service-order-detail/$serviceOrderId'
                          } 
                          search={assignment.referenceType === 'booking' ? { id: assignment.referenceId } : undefined}
                          params={
                            assignment.referenceType === 'custom_la' 
                              ? { id: assignment.referenceId.toString() } 
                              : assignment.referenceType === 'service_order'
                                ? { serviceOrderId: assignment.referenceId.toString() }
                                : {} as any
                          }
                          className="text-primary hover:underline text-sm font-medium flex items-center"
                        >
                          Lihat Rombongan <ArrowLeft className="h-3 w-3 ml-1 rotate-135" />
                        </Link>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div className="flex items-start space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-500">Mulai</p>
                            <p className="text-sm font-medium">{formatDate(assignment.startDate)}</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <CheckCircle className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-500">Selesai</p>
                            <p className="text-sm font-medium">{formatDate(assignment.endDate)}</p>
                          </div>
                        </div>
                      </div>
                      
                      {assignment.taskDescription && (
                        <div className="mt-3 bg-white p-3 rounded border text-sm text-gray-700">
                          <strong>Catatan:</strong> {assignment.taskDescription}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                  <p>Belum ada riwayat penugasan.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  )
}
