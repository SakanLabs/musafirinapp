import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { Mail, Shield, Calendar, Building2, Save, MapPin, Phone, User as UserIcon } from 'lucide-react'

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

  // Address default state
  const [addressData, setAddressData] = useState({
    recipientName: '',
    recipientPhone: '',
    shippingAddress: '',
    province: '',
    city: '',
    postalCode: ''
  })
  const [isEditingAddress, setIsEditingAddress] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("musafirin_user_address")
      if (saved) {
        setAddressData(JSON.parse(saved))
      }
    } catch {
      // Silent catch
    }
  }, [])

  const handleSaveAddress = () => {
    try {
      localStorage.setItem("musafirin_user_address", JSON.stringify(addressData))
      toast.success("Alamat pengiriman default berhasil disimpan")
      setIsEditingAddress(false)
    } catch {
      toast.error("Gagal menyimpan alamat")
    }
  }

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

        {/* Default Shipping Address Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#fb923c]" />
              Alamat Pengiriman Default (Indonesia)
            </h3>
            {!isEditingAddress ? (
              <Button size="sm" onClick={() => setIsEditingAddress(true)} className="bg-black hover:bg-gray-800 text-white text-xs h-8 px-3">
                Edit Alamat
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsEditingAddress(false)} className="text-xs h-8 px-3 animate-none">
                  Batal
                </Button>
                <Button size="sm" onClick={handleSaveAddress} className="bg-black hover:bg-gray-800 text-white text-xs h-8 px-3">
                  Simpan
                </Button>
              </div>
            )}
          </div>
          
          <div className="p-6">
            {isEditingAddress ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="recipientName">Nama Penerima</Label>
                    <Input 
                      id="recipientName" 
                      value={addressData.recipientName} 
                      onChange={e => setAddressData({ ...addressData, recipientName: e.target.value })} 
                      placeholder="Nama lengkap penerima"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="recipientPhone">No. WhatsApp</Label>
                    <Input 
                      id="recipientPhone" 
                      value={addressData.recipientPhone} 
                      onChange={e => setAddressData({ ...addressData, recipientPhone: e.target.value })} 
                      placeholder="Contoh: 08123456789"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="shippingAddress">Alamat Lengkap</Label>
                  <textarea
                    id="shippingAddress"
                    className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] bg-white resize-none"
                    value={addressData.shippingAddress}
                    onChange={e => setAddressData({ ...addressData, shippingAddress: e.target.value })}
                    placeholder="Nama jalan, nomor rumah, kelurahan, kecamatan"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="province">Provinsi</Label>
                    <Input 
                      id="province" 
                      value={addressData.province} 
                      onChange={e => setAddressData({ ...addressData, province: e.target.value })} 
                      placeholder="Provinsi"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="city">Kota / Kab</Label>
                    <Input 
                      id="city" 
                      value={addressData.city} 
                      onChange={e => setAddressData({ ...addressData, city: e.target.value })} 
                      placeholder="Kota/Kabupaten"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="postalCode">Kode Pos</Label>
                    <Input 
                      id="postalCode" 
                      value={addressData.postalCode} 
                      onChange={e => setAddressData({ ...addressData, postalCode: e.target.value })} 
                      placeholder="60111"
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              addressData.recipientName ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3 text-xs leading-relaxed text-slate-700">
                  <MapPin className="w-5 h-5 text-[#fb923c] shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="font-extrabold text-slate-900">{addressData.recipientName} ({addressData.recipientPhone})</p>
                    <p className="font-semibold text-slate-500">
                      {addressData.shippingAddress}, {addressData.city}, {addressData.province}, {addressData.postalCode}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400 font-semibold select-none">
                  Belum ada alamat pengiriman default yang disimpan.
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
