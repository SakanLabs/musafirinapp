import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react"
import { authService } from "@/lib/auth"
import { toast } from "sonner"

const resetPasswordSearchSchema = z.object({
  token: z.string().optional().catch(""),
})

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search) => resetPasswordSearchSchema.parse(search),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!token) {
      setError("Token reset password tidak ditemukan. Silakan kirim ulang tautan reset password.")
      return
    }

    if (password.length < 8) {
      setError("Kata sandi harus minimal 8 karakter.")
      return
    }

    if (password !== confirmPassword) {
      setError("Kata sandi dan konfirmasi kata sandi tidak cocok.")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const result = await authService.resetPassword(password, token)
      
      if (result.success) {
        setIsSuccess(true)
        toast.success("Kata sandi Anda telah berhasil diubah!")
        setTimeout(() => {
          navigate({ to: "/login" })
        }, 3000)
      } else {
        setError(result.error || "Gagal mengatur ulang kata sandi. Token mungkin kadaluarsa atau tidak valid.")
      }
    } catch {
      setError("Terjadi kesalahan yang tidak terduga.")
    } finally {
      setIsLoading(false)
    }
  }

  // If token is missing completely
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold text-red-600 flex items-center justify-center gap-2">
              <AlertCircle className="w-6 h-6" />
              Token Tidak Valid
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Tautan reset password ini tidak valid atau telah kadaluarsa.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Silakan kembali ke halaman lupa kata sandi untuk meminta tautan baru.
            </p>
            <Link to="/forgot-password">
              <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium py-2">
                Minta Tautan Baru
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali ke Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold text-green-600 flex items-center justify-center gap-2">
              <CheckCircle className="w-6 h-6" />
              Berhasil Diubah
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Kata sandi Anda telah berhasil diatur ulang.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Anda akan diarahkan ke halaman masuk (login) dalam beberapa detik...
            </p>
            <Link to="/login">
              <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-2">
                Masuk Sekarang
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Atur Ulang Sandi
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Masukkan kata sandi baru untuk akun Anda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Password Baru */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Kata Sandi Baru
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Konfirmasi Password */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Konfirmasi Kata Sandi Baru
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Ketik ulang kata sandi baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2.5 transition-all duration-200 transform hover:scale-[1.02]"
              disabled={isLoading}
            >
              {isLoading ? "Memproses..." : "Atur Ulang Kata Sandi"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium inline-flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Kembali ke Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
