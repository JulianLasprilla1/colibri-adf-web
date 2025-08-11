'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ResumenOrdenes = {
  total: number;
  por_alistar: number;
  por_empacar: number;
  por_despachar: number;
  por_facturar: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [resumen, setResumen] = useState<ResumenOrdenes>({
    total: 0,
    por_alistar: 0,
    por_empacar: 0,
    por_despachar: 0,
    por_facturar: 0,
  })

  const router = useRouter()

  // Verifica la sesión del usuario y obtiene los datos de la orden
  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login')  // Redirige al login si no está autenticado
        return
      }

      setUserEmail(sessionData.session.user.email ?? null)

      // Consultar resumen de órdenes
      const { data: ordenes, error } = await supabase.from('ordenes').select('*').is('deleted_at', null);
      if (!error && ordenes) {
        type OrdenRow = { estado?: string };
        setResumen({
          total: ordenes.length,
          por_alistar: ordenes.filter((o: OrdenRow) => o.estado === 'por alistar').length,
          por_empacar: ordenes.filter((o: OrdenRow) => o.estado === 'por empacar').length,
          por_despachar: ordenes.filter((o: OrdenRow) => o.estado === 'por despachar').length,
          por_facturar: ordenes.filter((o: OrdenRow) => o.estado === 'por facturar').length,
        });
      }

      setLoading(false)
    }

    checkUserAndFetchData()
  }, [router])

  return (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#efe9fb]/60">
      <Navbar email={userEmail} />
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-12 space-y-10">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Panel de Resumen</h1>
            <p className="text-sm text-gray-500 mt-1">Visión general de actividad y módulos disponibles.</p>
          </div>
          {!userEmail && loading && (
            <div className="h-6 w-40 rounded-md bg-gray-200 animate-pulse" />
          )}
        </section>

        {/* Resumen de tarjetas (limpio) */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200/60 p-5 animate-pulse">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gray-200 to-gray-100" />
                  <div className="space-y-3">
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                    <div className="h-8 w-12 bg-gray-200 rounded" />
                  </div>
                </div>
              ))
            ) : (
              [
                { label: 'Órdenes Totales', value: resumen.total, color: 'from-[#a489dd] to-[#8f74d6]' },
                { label: 'Por Alistar', value: resumen.por_alistar, color: 'from-amber-500 to-amber-600' },
                { label: 'Por Empacar', value: resumen.por_empacar, color: 'from-fuchsia-500 to-fuchsia-600' },
                { label: 'Por Despachar', value: resumen.por_despachar, color: 'from-blue-500 to-blue-600' },
                { label: 'Por Facturar', value: resumen.por_facturar, color: 'from-emerald-500 to-emerald-600' }
              ].map(card => (
                <div key={card.label} className="relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200/60 hover:shadow-md transition group">
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.color}`} />
                  <div className="p-5 flex flex-col gap-2">
                    <span className="text-xs font-medium tracking-wide text-gray-500 uppercase">{card.label}</span>
                    <span className="text-3xl font-semibold text-gray-800 leading-tight">{card.value}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight text-gray-900">Módulos Disponibles</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-white shadow-sm ring-1 ring-gray-200/60 p-5 animate-pulse space-y-4">
                  <div className="h-5 w-32 bg-gray-200 rounded" />
                  <div className="h-4 w-48 bg-gray-200 rounded" />
                  <div className="h-4 w-40 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link href="/ordenes" className="group">
                <div className="h-full rounded-xl bg-white shadow-sm ring-1 ring-gray-200/60 p-5 hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-[#a489dd] transition">Órdenes</h3>
                    <p className="mt-2 text-sm text-gray-500">Crear y gestionar órdenes de compra.</p>
                  </div>
                  <div className="mt-4 text-sm font-medium text-[#6c56a3] group-hover:underline">Ir al módulo →</div>
                </div>
              </Link>
              <div className="h-full rounded-xl bg-white/70 shadow-sm ring-1 ring-gray-200/40 p-5 backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-gray-400">Alistamiento</h3>
                  <p className="mt-2 text-sm text-gray-400">Próximamente.</p>
                </div>
                <div className="mt-4 text-xs tracking-wide text-gray-300 uppercase">En desarrollo</div>
              </div>
              <div className="h-full rounded-xl bg-white/70 shadow-sm ring-1 ring-gray-200/40 p-5 backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-gray-400">Despacho y Facturación</h3>
                  <p className="mt-2 text-sm text-gray-400">Próximamente.</p>
                </div>
                <div className="mt-4 text-xs tracking-wide text-gray-300 uppercase">En desarrollo</div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}