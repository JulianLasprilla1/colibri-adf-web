'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ResumenOrdenes = {
  total: number
  alistado: number
  despachado: number
  facturado: number
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [resumen, setResumen] = useState<ResumenOrdenes>({
    total: 0,
    alistado: 0,
    despachado: 0,
    facturado: 0,
  })

  const router = useRouter()

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.push('/login')
        return
      }

      setUserEmail(sessionData.session.user.email ?? null)

      // ✅ Consultar resumen de órdenes
      const { data: ordenes, error } = await supabase.from('ordenes').select('*')
      if (!error && ordenes) {
        setResumen({
          total: ordenes.length,
          alistado: ordenes.filter(o => o.estado === 'alistado').length,
          despachado: ordenes.filter(o => o.estado === 'despachado').length,
          facturado: ordenes.filter(o => o.estado === 'facturado').length,
        })
      }

      setLoading(false)
    }

    checkUserAndFetchData()
  }, [router])

  if (loading) return <p className="text-center mt-10">Cargando...</p>

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar email={userEmail} />

      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Panel de Resumen</h1>
        <p className="mb-6 text-gray-700">Aquí tienes un resumen general de tus módulos:</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{resumen.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Órdenes en Alistado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{resumen.alistado}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Órdenes Despachadas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{resumen.despachado}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Órdenes Facturadas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{resumen.facturado}</p>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-xl font-semibold mb-4">Módulos Disponibles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/ordenes">
            <Card className="cursor-pointer hover:shadow-lg transition">
              <CardHeader>
                <CardTitle>Órdenes</CardTitle>
              </CardHeader>
              <CardContent>
                Crear y gestionar órdenes de compra.
              </CardContent>
            </Card>
          </Link>

          <Card className="opacity-50">
            <CardHeader>
              <CardTitle>Alistamiento</CardTitle>
            </CardHeader>
            <CardContent>Próximamente.</CardContent>
          </Card>

          <Card className="opacity-50">
            <CardHeader>
              <CardTitle>Despacho y Facturación</CardTitle>
            </CardHeader>
            <CardContent>Próximamente.</CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
