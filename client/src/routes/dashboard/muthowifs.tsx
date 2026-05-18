import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageLayout } from '@/components/layout/PageLayout'
import { apiClient } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DataTable, Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Plus, Users } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/dashboard/muthowifs')({
  component: MuthowifsPage,
})

// Types
interface Muthowif {
  id: number;
  name: string;
  phone: string;
  iqamaOrPassportNo: string | null;
  visaStatus: 'umrah' | 'ziarah' | 'student' | 'worker' | 'resident';
  residenceLocation: string | null;
  lastEducation: string | null;
  status: 'idle' | 'assigned' | 'unavailable';
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

import { Link } from '@tanstack/react-router'

const columns: Column<Muthowif>[] = [
  { 
    header: 'Nama', 
    key: 'name',
    render: (row) => (
      <Link to="/dashboard/muthowifs/$id" params={{ id: row.id.toString() }} className="text-primary font-medium hover:underline">
        {row.name}
      </Link>
    )
  },
  { header: 'Telepon', key: 'phone' },
  { 
    header: 'Tipe / Visa', 
    key: 'visaStatus',
    render: (row) => `${row.residentType.toUpperCase()} - ${row.visaStatus.toUpperCase()}`
  },
  {
    header: 'Status',
    key: 'status',
    render: (row) => {
      const status = row.status as string;
      return (
        <Badge variant={status === 'idle' ? 'success' : status === 'assigned' ? 'destructive' : 'secondary'}>
          {status.toUpperCase()}
        </Badge>
      )
    }
  }
];

function MuthowifsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    iqamaOrPassportNo: '',
    visaStatus: 'student',
    residentType: 'mahasiswa',
    residenceLocation: '',
    lastEducation: '',
    notes: ''
  });

  const { data, isLoading } = useQuery<{ muthowifs: Muthowif[] }>({
    queryKey: ['muthowifs'],
    queryFn: () => apiClient.get('/api/muthowifs')
  });

  const muthowifs = data?.muthowifs || [];

  const createMutation = useMutation({
    mutationFn: (newMuthowif: typeof formData) => apiClient.post('/api/muthowifs', newMuthowif),
    onSuccess: () => {
      toast.success('Muthowif berhasil ditambahkan');
      queryClient.invalidateQueries({ queryKey: ['muthowifs'] });
      setIsDialogOpen(false);
      setFormData({
        name: '', phone: '', iqamaOrPassportNo: '', visaStatus: 'student', 
        residentType: 'mahasiswa', residenceLocation: '', lastEducation: '', notes: ''
      });
    },
    onError: (error: any) => {
      toast.error(`Gagal menambahkan Muthowif: ${error.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <PageLayout
      title="Manajemen Muthowif"
      description="Kelola data tim pendamping, visa, dan ketersediaan mereka"
      icon={<Users className="h-6 w-6" />}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Data Master Muthowif</CardTitle>
            <CardDescription>Daftar seluruh muthowif aktif di sistem</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Tambah Muthowif</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Tambah Muthowif Baru</DialogTitle>
                <DialogDescription>
                  Masukkan detail informasi muthowif baru.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nama Lengkap</Label>
                    <Input id="name" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">No HP (WhatsApp)</Label>
                    <Input id="phone" required value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Tipe Residen</Label>
                      <Select value={formData.residentType} onValueChange={(v) => setFormData({...formData, residentType: v as any})}>
                        <SelectTrigger><SelectValue placeholder="Pilih Tipe" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mahasiswa">Mahasiswa</SelectItem>
                          <SelectItem value="mukimin">Mukimin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Status Visa</Label>
                      <Select value={formData.visaStatus} onValueChange={(v) => setFormData({...formData, visaStatus: v as any})}>
                        <SelectTrigger><SelectValue placeholder="Pilih Visa" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="umrah">Umrah</SelectItem>
                          <SelectItem value="ziarah">Ziarah</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="worker">Worker</SelectItem>
                          <SelectItem value="resident">Resident</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="residence">Lokasi Tinggal</Label>
                      <Input id="residence" placeholder="Makkah/Madinah" value={formData.residenceLocation} onChange={(e) => setFormData({...formData, residenceLocation: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="education">Pendidikan Terakhir</Label>
                      <Input id="education" placeholder="S1 Syariah, LIPIA, dll" value={formData.lastEducation} onChange={(e) => setFormData({...formData, lastEducation: e.target.value})} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Menyimpan...' : 'Simpan Data'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading data...</div>
          ) : (
            <DataTable 
              data={muthowifs} 
              columns={columns} 
            />
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
