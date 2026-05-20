import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { Mail, Shield, Calendar, Building2, Save } from 'lucide-react'

interface ProfileData {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  userType: string
  createdAt: string
  updatedAt: string
}

export const Route = createFileRoute('/profile')({
  component: ProfilePage
})

function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({ name: '', userType: '' })

  const fetchProfile = async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.get<any>('/api/profile/me')
      if (response.success) {
        setProfile(response.data)
        setFormData({ name: response.data.name, userType: response.data.userType })
      } else {
        toast.error('Gagal memuat profil')
      }
    } catch {
      toast.error('Gagal memuat profil')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleUpdate = async () => {
    try {
      const response = await apiClient.patch<any>('/api/profile/me', formData)
      if (response.success) {
        toast.success('Profil berhasil diperbarui')
        setIsEditing(false)
        fetchProfile()
      } else {
        toast.error('Gagal memperbarui profil')
      }
    } catch {
      toast.error('Gagal memperbarui profil')
    }
  }

  if (isLoading) return <PageLayout title="Profil"><div className="flex items-center justify-center h-64 text-slate-400">Memuat...</div></PageLayout>
  if (!profile) return <PageLayout title="Profil"><div className="flex items-center justify-center h-64 text-red-500">Gagal memuat profil.</div></PageLayout>

  const roleBadgeColors: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    finance: 'bg-emerald-100 text-emerald-700',
    user: 'bg-slate-100 text-slate-600',
  }

  const userTypeLabels: Record<string, string> = {
    direct: 'Direct',
    agent: 'Agent',
  }

  return (
    <PageLayout
      title="Profil Saya"
      showBackButton
      actions={
        !isEditing ? (
          <Button onClick={() => setIsEditing(true)} className="bg-black hover:bg-gray-800 text-white">
            Edit Profil
          </Button>
        ) : (
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => { setIsEditing(false); setFormData({ name: profile.name, userType: profile.userType }) }}>
              Batal
            </Button>
            <Button onClick={handleUpdate} className="bg-black hover:bg-gray-800 text-white">
              <Save className="w-4 h-4 mr-2" /> Simpan
            </Button>
          </div>
        )
      }
    >
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-slate-800 to-slate-600" />
          <div className="px-6 pb-6">
            <div className="flex justify-center -mt-12 mb-4">
              <Avatar
                src={profile.image || undefined}
                fallback={profile.name}
                size="lg"
                className="ring-4 ring-white shadow-md"
              />
            </div>

            {isEditing ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Lengkap</Label>
                  <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userType">Tipe Pengguna</Label>
                  <select
                    id="userType"
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={formData.userType}
                    onChange={e => setFormData({ ...formData, userType: e.target.value })}
                  >
                    <option value="direct">Direct</option>
                    <option value="agent">Agent</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{profile.name}</h2>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${roleBadgeColors[profile.role] || 'bg-slate-100 text-slate-600'}`}>
                      {profile.role.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {userTypeLabels[profile.userType] || profile.userType}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3 border-t border-slate-100 pt-6">
              <div className="flex items-center text-sm text-slate-600">
                <Mail className="w-4 h-4 mr-3 text-slate-400" />
                {profile.email}
              </div>
              <div className="flex items-center text-sm text-slate-600">
                <Shield className="w-4 h-4 mr-3 text-slate-400" />
                Role: <span className="ml-1 capitalize">{profile.role}</span>
              </div>
              <div className="flex items-center text-sm text-slate-600">
                <Building2 className="w-4 h-4 mr-3 text-slate-400" />
                Tipe: <span className="ml-1 capitalize">{userTypeLabels[profile.userType] || profile.userType}</span>
              </div>
              <div className="flex items-center text-sm text-slate-600">
                <Calendar className="w-4 h-4 mr-3 text-slate-400" />
                Bergabung sejak: {new Date(profile.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
