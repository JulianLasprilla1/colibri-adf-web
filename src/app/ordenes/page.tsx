'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { DateRangePicker } from '@/components/ui/date-range-picker'

type Orden = {
  id?: string
  cliente: string
  producto: string
  cantidad: number
  precio: number
  estado: string
  created_at?: string
}

const schema = z.object({
  cliente: z.string().min(2, 'El cliente debe tener mínimo 2 caracteres'),
  producto: z.string().min(2, 'El producto debe tener mínimo 2 caracteres'),
  cantidad: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  precio: z.number().min(0, 'El precio no puede ser negativo'),
  estado: z.enum(['nueva orden', 'por alistar']),
})

type FormValues = z.infer<typeof schema>
const ITEMS_POR_PAGINA = 5

export default function OrdenesPage() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [estadoFiltro, setEstadoFiltro] = useState<string | null>(null)

  const [abrirDialogo, setAbrirDialogo] = useState(false)
  const [ordenEditando, setOrdenEditando] = useState<Orden | null>(null)

  const estadosResumen = ['nueva orden', 'por alistar', 'por empacar', 'por facturar']

  // 🔹 Configurar rango de hoy al iniciar
  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0]
    setFechaInicio(hoy)
    setFechaFin(hoy)
  }, [])

  const fetchOrdenes = async () => {
    const { data } = await supabase
      .from('ordenes')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setOrdenes(data)
  }

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return
      setUserEmail(sessionData.session.user.email ?? null)

      await fetchOrdenes()
      setLoading(false)

      const channel = supabase
        .channel('ordenes-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, fetchOrdenes)
        .subscribe()

      return () => supabase.removeChannel(channel)
    }
    init()
  }, [])

  const eliminarOrden = async (id?: string) => {
    if (!id) return
    if (!confirm('¿Eliminar esta orden?')) return

    setProcesando(true)
    const { error } = await supabase.from('ordenes').delete().eq('id', id)
    setProcesando(false)

    if (error) toast.error('Error al eliminar la orden')
    else toast.success('Orden eliminada correctamente')

    await fetchOrdenes()
  }

  const abrirModalNueva = () => {
    setOrdenEditando(null)
    setAbrirDialogo(true)
    reset({
      cliente: '',
      producto: '',
      cantidad: 1,
      precio: 0,
      estado: 'nueva orden',
    })
  }

  const abrirModalEdicion = (orden: Orden) => {
    setOrdenEditando(orden)
    setAbrirDialogo(true)
    reset({
      cliente: orden.cliente,
      producto: orden.producto,
      cantidad: orden.cantidad,
      precio: orden.precio,
      estado: orden.estado as 'nueva orden' | 'por alistar',
    })
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { cliente: '', producto: '', cantidad: 1, precio: 0, estado: 'nueva orden' },
  })

  const guardarOrden = async (data: FormValues) => {
    setProcesando(true)

    if (ordenEditando?.id) {
      const { error } = await supabase
        .from('ordenes')
        .update({ ...data, estado: data.estado })
        .eq('id', ordenEditando.id)
      if (error) toast.error('Error al actualizar la orden')
      else toast.success('Orden actualizada correctamente')
    } else {
      const { error } = await supabase.from('ordenes').insert([{ ...data, estado: 'nueva orden' }])
      if (error) toast.error('Error al crear la orden')
      else toast.success('Orden creada correctamente')
    }

    setProcesando(false)
    setAbrirDialogo(false)
    await fetchOrdenes()
  }

  const descargarPlantilla = async () => {
    setProcesando(true)
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Plantilla')
    sheet.addRow(['Cliente', 'Producto', 'Cantidad', 'Precio'])
    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), 'plantilla_ordenes.xlsx')
    setProcesando(false)
    toast.info('Plantilla descargada')
  }

  const cargarExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setProcesando(true)
    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]

    const header = sheet.getRow(1).values as string[]
    const required = ['Cliente', 'Producto', 'Cantidad', 'Precio']
    if (required.some((col) => !header.includes(col))) {
      setProcesando(false)
      toast.warning('El archivo no tiene las columnas correctas')
      return
    }

    const rows: Orden[] = []
    sheet.eachRow((row, i) => {
      if (i === 1) return
      const [_, cliente, producto, cantidad, precio] = row.values as any[]
      rows.push({
        cliente,
        producto,
        cantidad: Number(cantidad),
        precio: Number(precio),
        estado: 'nueva orden',
      })
    })

    const { error } = await supabase.from('ordenes').insert(rows)
    setProcesando(false)

    if (error) toast.error('Error al cargar el archivo')
    else toast.success('Órdenes cargadas correctamente')

    await fetchOrdenes()
  }

  const descargarExcel = async () => {
    setProcesando(true)

    const filtradas = ordenesFiltradas()
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Órdenes')
    sheet.addRow(['Cliente', 'Producto', 'Cantidad', 'Precio', 'Estado', 'Fecha'])
    filtradas.forEach((o) =>
      sheet.addRow([o.cliente, o.producto, o.cantidad, o.precio, o.estado, o.created_at]),
    )

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), 'ordenes.xlsx')

    setProcesando(false)
    toast.info('Órdenes exportadas')
  }

  // 🔹 Filtrado de órdenes
  const ordenesFiltradas = () => {
    return ordenes.filter((o) => {
      const fecha = new Date(o.created_at!).toISOString().split('T')[0]
      const coincideFecha =
        (!fechaInicio || !fechaFin) || (fecha >= fechaInicio && fecha <= fechaFin)
      const coincideEstado = !estadoFiltro || o.estado === estadoFiltro
      const coincideBusqueda =
        o.cliente.toLowerCase().includes(busqueda.toLowerCase()) ||
        o.producto.toLowerCase().includes(busqueda.toLowerCase())

      return coincideFecha && coincideEstado && coincideBusqueda
    })
  }

  const limpiarFiltros = () => {
    const hoy = new Date().toISOString().split('T')[0]
    setFechaInicio(hoy)
    setFechaFin(hoy)
    setEstadoFiltro(null)
    setBusqueda('')
    setPagina(1)
  }

  const totalPaginas = Math.ceil(ordenesFiltradas().length / ITEMS_POR_PAGINA)
  const inicio = (pagina - 1) * ITEMS_POR_PAGINA
  const ordenesPaginadas = ordenesFiltradas().slice(inicio, inicio + ITEMS_POR_PAGINA)

  if (loading) return <p className="text-center mt-10">Cargando...</p>

  return (
    <div className="min-h-screen bg-gray-100 relative">
      <Navbar email={userEmail} />

      {procesando && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Gestión de Órdenes</h1>
          <Button onClick={abrirModalNueva} className="bg-blue-600 hover:bg-blue-700">
            Nueva Orden
          </Button>
        </div>

        {/* Resumen de estados */}
        <div className="flex gap-4 mb-4">
          {estadosResumen.map((estado) => (
            <button
              key={estado}
              onClick={() => {
                setEstadoFiltro(estadoFiltro === estado ? null : estado)
                setPagina(1)
              }}
              className={`px-4 py-2 rounded-lg shadow flex flex-col items-center w-36 
                ${estadoFiltro === estado ? 'bg-blue-200' : 'bg-white'}`}
            >
              <p className="text-sm font-medium capitalize">{estado}</p>
              <p className="text-xl font-bold">
                {ordenes.filter((o) => o.estado === estado).length}
              </p>
            </button>
          ))}
        </div>

        {/* Barra de acciones */}
        <div className="bg-white shadow rounded-lg p-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPagina(1)
            }}
            className="border rounded px-3 py-2 flex-1"
          />

          <DateRangePicker
            onUpdate={(range) => {
              if (range.range?.from && range.range?.to) {
                setFechaInicio(range.range.from.toISOString().split('T')[0])
                setFechaFin(range.range.to.toISOString().split('T')[0])
              }
            }}
            initialDate={{
              from: new Date(fechaInicio),
              to: new Date(fechaFin),
            }}
          />

          <Button variant="secondary" onClick={descargarPlantilla}>
            Plantilla
          </Button>

          <label className="cursor-pointer border rounded px-3 py-2 bg-gray-50 hover:bg-gray-100">
            Subir Excel
            <input type="file" accept=".xlsx" onChange={cargarExcel} className="hidden" />
          </label>

          <Button onClick={descargarExcel}>Descargar</Button>

          <Button variant="outline" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        </div>

        {/* Tabla */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {ordenesPaginadas.length === 0 ? (
            <p className="p-6 text-gray-500">No hay órdenes.</p>
          ) : (
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-200 text-left">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Cantidad</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesPaginadas.map((orden) => (
                  <tr key={orden.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{orden.cliente}</td>
                    <td className="px-4 py-3">{orden.producto}</td>
                    <td className="px-4 py-3">{orden.cantidad}</td>
                    <td className="px-4 py-3">${orden.precio}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold
                          ${orden.estado === 'nueva orden' ? 'bg-gray-200 text-gray-800' : ''}
                          ${orden.estado === 'por alistar' ? 'bg-blue-100 text-blue-800' : ''}
                          ${orden.estado === 'por empacar' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${orden.estado === 'por facturar' ? 'bg-green-100 text-green-800' : ''}`}
                      >
                        {orden.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => abrirModalEdicion(orden)}>
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => eliminarOrden(orden.id)}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="self-center">
              Página {pagina} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              disabled={pagina === totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={abrirDialogo} onOpenChange={setAbrirDialogo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ordenEditando ? 'Editar Orden' : 'Nueva Orden'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(guardarOrden)} className="space-y-3 mt-3">
            <div>
              <input {...register('cliente')} className="border p-2 rounded w-full" placeholder="Cliente" />
              {errors.cliente && <p className="text-red-500 text-sm">{errors.cliente.message}</p>}
            </div>

            <div>
              <input {...register('producto')} className="border p-2 rounded w-full" placeholder="Producto" />
              {errors.producto && <p className="text-red-500 text-sm">{errors.producto.message}</p>}
            </div>

            <div>
              <input type="number" {...register('cantidad', { valueAsNumber: true })} className="border p-2 rounded w-full" placeholder="Cantidad" />
              {errors.cantidad && <p className="text-red-500 text-sm">{errors.cantidad.message}</p>}
            </div>

            <div>
              <input type="number" {...register('precio', { valueAsNumber: true })} className="border p-2 rounded w-full" placeholder="Precio" />
              {errors.precio && <p className="text-red-500 text-sm">{errors.precio.message}</p>}
            </div>

            <div>
              <select
                {...register('estado')}
                className="border p-2 rounded w-full"
                disabled={ordenEditando?.estado === 'por alistar'}
              >
                <option value="nueva orden">Nueva Orden</option>
                <option value="por alistar">Por Alistar</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button type="button" variant="outline" onClick={() => setAbrirDialogo(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
