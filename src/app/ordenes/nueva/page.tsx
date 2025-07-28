'use client'

import { useForm, SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

// ✅ Definimos primero el esquema
const schema = z.object({
  cliente: z.string().min(1, 'El nombre del cliente es obligatorio'),
  producto: z.string().min(1, 'El producto es obligatorio'),
  cantidad: z.coerce.number().min(1, 'Debe ser al menos 1'),
  precio: z.coerce.number().min(0, 'El precio debe ser mayor o igual a 0'),
})

// ✅ Luego extraemos el tipo directamente del esquema
type FormValues = z.infer<typeof schema>

export default function NuevaOrdenPage() {
  // ✅ Aquí usamos el tipo FormValues en useForm
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any, // 👈 este cast evita el error de incompatibilidad
  })

  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // ✅ Tipamos explícitamente onSubmit
  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setLoading(true)
    setMsg('')

    const { error } = await supabase.from('ordenes').insert({
      cliente: data.cliente,
      producto: data.producto,
      cantidad: data.cantidad,
      precio: data.precio,
    })

    if (error) {
      setMsg('Error al guardar la orden: ' + error.message)
    } else {
      setMsg('✅ Orden registrada con éxito')
      setTimeout(() => router.push('/dashboard'), 1500)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl">Registrar Nueva Orden</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="cliente">Cliente</Label>
              <Input id="cliente" {...register('cliente')} />
              {errors.cliente && (
                <p className="text-sm text-red-500">{errors.cliente.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="producto">Producto</Label>
              <Input id="producto" {...register('producto')} />
              {errors.producto && (
                <p className="text-sm text-red-500">{errors.producto.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input id="cantidad" type="number" {...register('cantidad')} />
              {errors.cantidad && (
                <p className="text-sm text-red-500">{errors.cantidad.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="precio">Precio Unitario</Label>
              <Input id="precio" type="number" step="0.01" {...register('precio')} />
              {errors.precio && (
                <p className="text-sm text-red-500">{errors.precio.message}</p>
              )}
            </div>
            {msg && <p className="text-center text-sm">{msg}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Orden'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
