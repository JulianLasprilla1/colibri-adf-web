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
import { useState } from 'react'
import Image from 'next/image'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
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
  const [successMsg, setSuccessMsg] = useState('')

  const onSubmit = async (data: FormValues) => {
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })

    if (error) {
      setErrorMsg(error.message)
    } else {
      setSuccessMsg('Registro exitoso. Revisa tu correo para confirmar la cuenta.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 px-4 py-10">
      <Card className="w-full max-w-md border-gray-200/70 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-3 pb-2">
          <div className="mx-auto h-14 w-14 rounded-xl bg-white ring-1 ring-gray-200 flex items-center justify-center shadow-sm overflow-hidden">
            <Image
              src="/logo.png"
              alt="Logo"
              width={56}
              height={56}
              className="object-contain"
            />
          </div>
          <CardTitle className="text-center text-2xl font-semibold tracking-tight text-gray-800">
            Registrarse
          </CardTitle>
          <p className="text-center text-sm text-gray-500">
            Crea tu cuenta para comenzar
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-medium tracking-wide text-gray-600 uppercase"
              >
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="nombre@empresa.com"
                {...register('email')}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs text-rose-600 font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-medium tracking-wide text-gray-600 uppercase"
              >
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="text-xs text-rose-600 font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>
            {errorMsg && (
              <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>
            )}
            {successMsg && (
              <p className="text-xs text-emerald-600 font-medium">{successMsg}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrarse'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
