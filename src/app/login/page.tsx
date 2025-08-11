'use client'

import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import AnimatedLogo from '@/components/AnimatedLogo'
import { Eye, EyeOff } from 'lucide-react'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Si ya está logueado, redirigir fuera del login
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/dashboard')
      }
    })
  }, [router])

  const onSubmit = async (data: FormValues) => {
    setLoading(true)
    setErrorMsg('')

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      setErrorMsg(error.message)
    } else if (!signInData.session?.user?.email_confirmed_at) {
      setErrorMsg('Debes confirmar tu correo electrónico antes de ingresar.')
      await supabase.auth.signOut()
    } else {
      const search = new URLSearchParams(window.location.search)
      const redirectTo = search.get('redirectTo') || '/dashboard'
      router.push(redirectTo)
    }

    setLoading(false)
  }

  // Paleta
  const accent = '#a489dd'
  const dark = '#353455'
  const accentRing = 'focus-visible:ring-[3px] focus-visible:ring-[#a489dd66] focus-visible:border-[#a489dd]' 

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Fondo con degradé y textura */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(164,137,221,0.25),transparent_60%),radial-gradient(circle_at_80%_70%,rgba(53,52,85,0.35),transparent_65%)]" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#353455] via-[#413c64] to-[#a489dd] opacity-[0.18] mix-blend-overlay" />
      <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:"repeating-linear-gradient(45deg,rgba(255,255,255,.04)_0_8px,transparent_8px_16px)",opacity:.35}} />
  <div className="relative flex flex-col items-center justify-center gap-6 px-4 sm:px-6 lg:px-8 py-8 min-h-screen overflow-hidden">
        <div className="flex flex-col items-center gap-4 w-full max-w-xl lg:max-w-2xl lg:-ml-20 transition-all">
          <AnimatedLogo
            fallback="/logo.png"
            frames={[ '/anim/frame_01.png','/anim/frame_02.png','/anim/frame_03.png','/anim/frame_04.png','/anim/frame_05.png','/anim/frame_06.png','/anim/frame_07.png','/anim/frame_08.png','/anim/frame_09.png' ]}
            size={130}
            interval={140}
            playing
            loop
            mode="bounce"
            fade={false}
            circle
            className="mx-auto"
          />
          <h1 className="text-4xl font-semibold tracking-tight text-center" style={{color:dark}}>Colibrí <span style={{color:accent}}>ADF</span></h1>
          <p className="text-sm font-medium text-center max-w-sm" style={{color: dark+'cc'}}>Centraliza y acelera tu flujo operativo con una visión clara y accionable.</p>
        </div>
  <div className="flex flex-col justify-center w-full max-w-md flex-shrink-0 lg:-ml-20 transition-all">
          <Card className="shadow-xl border-0 ring-1 ring-white/10 bg-white/80 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/30 to-white/40" />
            <CardHeader className="space-y-5 relative">
              <CardTitle className="text-center text-2xl font-semibold tracking-tight" style={{color:dark}}>
                Iniciar Sesión
              </CardTitle>
              <p className="text-center text-sm" style={{color: dark+'99'}}>Accede a la plataforma Colibrí ADF</p>
            </CardHeader>
            <CardContent className="relative">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[11px] font-semibold tracking-wide uppercase" style={{color: dark+ 'cc'}}>
                    Correo electrónico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@empresa.com"
                    {...register('email')}
                    aria-invalid={!!errors.email}
                    className={accentRing + ' bg-white/60 backdrop-blur-sm border-white/50 placeholder:text-gray-400'}
                  />
                  {errors.email && <p className="text-xs text-rose-600 font-medium">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[11px] font-semibold tracking-wide uppercase" style={{color: dark+ 'cc'}}>
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      {...register('password')}
                      aria-invalid={!!errors.password}
                      className={accentRing + ' pr-10 bg-white/60 backdrop-blur-sm border-white/50 placeholder:text-gray-400'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-rose-600 font-medium">{errors.password.message}</p>}
                </div>
                {errorMsg && <p className="text-xs text-rose-600 font-medium -mt-2">{errorMsg}</p>}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full relative overflow-hidden group font-medium tracking-wide text-sm"
                  style={{background: dark, borderColor: dark, color:'#fff'}}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-[#4a4671] via-[#353455] to-[#4a4671] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative flex items-center justify-center gap-2">
                    {loading && <span className="h-2.5 w-2.5 rounded-full bg-[#a489dd] animate-ping" />}
                    {loading ? 'Ingresando…' : 'Ingresar'}
                  </span>
                </Button>
              </form>
              <p className="mt-8 text-center text-sm" style={{color: dark+'99'}}>
                ¿No tienes cuenta?{' '}
                <Link href="/register" className="font-semibold" style={{color: accent}}>
                  Regístrate aquí
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
