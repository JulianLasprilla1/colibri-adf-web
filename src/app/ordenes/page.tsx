"use client";

import React, { useState, useEffect, Fragment, useRef, useMemo } from "react";
import { useOrders, OrdenAgrupada } from "@/hooks/useOrders";
import { ordersService } from "@/services/ordersService";
import { transportadorasService, Transportadora } from "@/services/transportadorasService";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogActions } from "@mui/material";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useForm, Controller, Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { TextField, MenuItem } from "@mui/material";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil, Trash2, RotateCcw, ArrowUpDown } from "lucide-react";
import { cn, formatBogotaDate, formatBogotaDateTime } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import BulkImportOrders from "@/components/BulkImportOrders";

// Actualiza el esquema para incluir el ID del item
const schema = z.object({
  canal_id: z.string().min(1, "Debes seleccionar un canal"),
  codigo_orden: z.string().min(2, "El código de orden es obligatorio"),
  cliente: z.object({
    nombre: z.string().min(2, "El nombre es obligatorio"),
    documento: z.string().optional(),
    ciudad: z.string().optional(),
    departamento: z.string().optional(),
    correo: z.string().email("El correo debe ser válido").optional(),
    celular: z.string().regex(/^\d+$/, "El celular debe contener solo números").optional(),
  direccion: z.string().optional(),
  }),
  estado: z.string().min(1, "El estado es obligatorio"),
  item_id: z.string().optional(),
  sku: z.string().min(1, "El SKU es obligatorio"),
  producto: z.string().min(2, "El producto es obligatorio"),
  cantidad: z.coerce.number().min(1, "La cantidad debe ser mayor a 0"),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo"),
  flete: z.coerce.number().min(0, "El flete no puede ser negativo"),
  guia_numero: z.string().optional().nullable(),
  transportadora_id: z.string().optional().nullable(),
});

// Actualiza el tipo FormValues
type FormValues = z.infer<typeof schema>;

// Tipo extendido para edición que incluye ID de la orden y del item principal
type OrdenEditando = FormValues & { id?: string };

type Canal = {
  id: string;
  nombre: string;
};

type ItemInput = {
  sku: string;
  producto: string;
  cantidad: number | string;
  precio: number | string;
  flete: number | string;
};


export default function OrdenesPage() {
  const [refreshKey] = useState(0);
  const [extraItems, setExtraItems] = useState<ItemInput[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [abrirImportar, setAbrirImportar] = useState(false);
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [estadoFiltro, setEstadoFiltro] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState<string>('');
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('asc');
  const [rangoFechas, setRangoFechas] = useState<DateRange | undefined>(()=>({ from: new Date(new Date().setDate(new Date().getDate()-7)), to: new Date() }));
  const [horaInicio, setHoraInicio] = useState<string>('00:00');
  const [horaFin, setHoraFin] = useState<string>('23:59');
  
  // Usa el hook con el refreshKey
  const { ordenesAgrupadas, loading, error, fetchOrdenes } = useOrders(refreshKey);
  const estadosOrden = ['nueva orden','por alistar','por empacar','por despachar','por facturar','cancelada','restaurada'];
  const counts = useMemo(()=>{
    const c: Record<string, number> = {};
    ordenesAgrupadas.forEach(o => { c[o.estado] = (c[o.estado]||0)+1; });
    return c;
  }, [ordenesAgrupadas]);
  const ordenesFiltradas = useMemo(()=> {
    let base = estadoFiltro ? ordenesAgrupadas.filter(o=>o.estado===estadoFiltro) : ordenesAgrupadas;
    // Filtro por rango de fechas + horas
    if (rangoFechas?.from && rangoFechas?.to) {
      const startDay = new Date(rangoFechas.from);
      const endDay = new Date(rangoFechas.to);
      // Normalizamos horas
      const [hI,mI] = horaInicio.split(':').map(Number);
      const [hF,mF] = horaFin.split(':').map(Number);
      const start = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), hI||0, mI||0, 0, 0).getTime();
      const end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), hF||23, mF||59, 59, 999).getTime();
      base = base.filter(o => {
        const t = new Date(o.created_at).getTime();
        return t>=start && t<=end;
      });
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      base = base.filter(o => {
        const matchCodigo = o.codigo_orden?.toLowerCase().includes(q);
        const matchCliente = (o.cliente_nombre||'').toLowerCase().includes(q);
        const matchProductos = o.items?.some(it => (it.producto||'').toLowerCase().includes(q) || (it.sku||'').toLowerCase().includes(q));
        return matchCodigo || matchCliente || matchProductos;
      });
    }
    // Orden final según dirección seleccionada (hook entrega ascendente ya, reforzamos por seguridad)
    const sorted = [...base].sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return orderDirection === 'asc' ? sorted : sorted.reverse();
  }, [ordenesAgrupadas, estadoFiltro, busqueda, rangoFechas, horaInicio, horaFin, orderDirection]);

  const toggleOrderDirection = () => setOrderDirection(d => d === 'asc' ? 'desc' : 'asc');
  const [canales, setCanales] = useState<Canal[]>([]);
  const [abrirDialogo, setAbrirDialogo] = useState(false);
  const [ordenEditando, setOrdenEditando] = useState<OrdenEditando | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const cargarTransportadoras = async () => {
    const res = await transportadorasService.listar();
    if (res.success && res.data) {
      setTransportadoras(res.data);
    }
  };
  const addTransportadora = async (nombre: string) => {
    const res = await transportadorasService.crear(nombre);
    if (res.success && res.data) {
      setTransportadoras(prev => [...prev, res.data!]);
      setValue('transportadora_id', res.data.id);
      toast.success('Transportadora creada');
    } else if (res.error) {
      toast.error(res.error);
    }
  };

  // 1. Mejora los valores por defecto para asegurar que nunca sean undefined
  const { register, handleSubmit, formState: { errors, isDirty }, reset, control, setValue, getValues, watch } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      canal_id: "",
      codigo_orden: "",
      cliente: {
        nombre: "",
        documento: "",
        ciudad: "",
        departamento: "",
        correo: "",
  celular: "",
  direccion: "",
      },
  estado: "nueva orden",
      sku: "",
      producto: "",
      cantidad: 1,
      precio: 0,
      flete: 0,
      guia_numero: "",
  transportadora_id: ""
    },
  });

  // Función mejorada para manejar Nueva Orden
  // Guardamos snapshot original para revertir si se cancela
  // Snapshot que incluye formulario + items extra para revertir cambios al cancelar
  type Snapshot = { form: FormValues; extraItems: ItemInput[] } | null;
  const originalValuesRef = useRef<Snapshot>(null);
  const savedRef = useRef(false); // para omitir confirm al cerrar tras guardar

  // Componente barra de progreso del flujo de estado
  const FlujoProgreso = ({ estado, onChange, className = '' }: { estado: string; onChange: (v: string)=>void; className?: string }) => {
    const pasos = [
      { v: 'nueva orden', label: 'Nueva', active: { circle: 'bg-sky-600 border-sky-600 text-white', text: 'text-sky-600', ring: 'ring-sky-400/40' } },
      { v: 'por alistar', label: 'Alistar', active: { circle: 'bg-amber-600 border-amber-600 text-white', text: 'text-amber-600', ring: 'ring-amber-400/40' } },
      { v: 'por empacar', label: 'Empacar', active: { circle: 'bg-fuchsia-600 border-fuchsia-600 text-white', text: 'text-fuchsia-600', ring: 'ring-fuchsia-400/40' } },
      { v: 'por despachar', label: 'Despachar', active: { circle: 'bg-blue-600 border-blue-600 text-white', text: 'text-blue-600', ring: 'ring-blue-400/40' } },
      { v: 'por facturar', label: 'Facturar', active: { circle: 'bg-emerald-600 border-emerald-600 text-white', text: 'text-emerald-600', ring: 'ring-emerald-400/40' } }
    ];
    const idx = Math.max(0, pasos.findIndex(p=>p.v===estado));
    const currentColor = pasos[idx]?.active || pasos[0].active;
    const lineColorClass = currentColor.circle.split(' ').find(c=>c.startsWith('bg-')) || 'bg-sky-600';
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center justify-between">
          {pasos.map((p,i)=>{
            const isActive = i<=idx;
            const isCurrent = i===idx; // paso actual
      const circleActive = currentColor.circle; // todos los pasos activos toman el color del paso actual
      const textActive = currentColor.text;
            return (
              <button
                key={p.v}
                type="button"
                onClick={()=>onChange(p.v)}
                className="group flex-1 flex flex-col items-center focus:outline-none"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border relative z-10
                  transition-all duration-300 ease-out origin-center
                  ${isActive ? circleActive + ' shadow' : 'bg-white text-gray-500 border-gray-300 group-hover:border-gray-400'}
                  ${isCurrent ? `scale-110 ring-4 ${p.active.ring}` : isActive ? 'scale-105' : 'scale-95'}`}>{i+1}
                  {isCurrent && (
        <span className={`absolute inset-0 rounded-full animate-ping ${currentColor.ring?.replace('ring-','bg-').replace('/40','/30')}`} />
                  )}
                </div>
                <span className={`mt-1 text-[10px] font-medium tracking-wide uppercase ${isActive ? textActive : 'text-gray-400 group-hover:text-gray-500'}`}>{p.label}</span>
              </button>
            );
          })}
        </div>
  {/* Base line */}
  <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-0" />
  {/* Single unified progress bar with current color */}
  <div className={`absolute top-4 left-0 h-0.5 -z-0 transition-all duration-500 ease-out ${lineColorClass}`} style={{ width: ((idx)/(pasos.length-1))*100 + '%' }} />
      </div>
    );
  };

  const nuevaOrden = () => {
    setOrdenEditando(null);
    reset({
      canal_id: "",
      codigo_orden: "",
      cliente: { nombre: "", documento: "", ciudad: "", departamento: "", correo: "", celular: "", direccion: "" },
      estado: "nueva orden",
      sku: "",
      producto: "",
      cantidad: 1,
      precio: 0,
      flete: 0,
      guia_numero: "",
      transportadora_id: ""
    });
    setExtraItems([]);
    // snapshot inicial
    originalValuesRef.current = { form: getValues(), extraItems: [] };
    setAbrirDialogo(true);
  };

  useEffect(() => {
    const fetchCanales = async () => {
      try {
        const { data, error } = await supabase.from("canales_venta").select("*");
        if (!error && data) {
          setCanales(data);
        } else if (error) {
          throw error;
        }
      } catch (error) {
        console.error("Error al cargar canales:", error);
        toast.error("Error al cargar canales");
      }
    };
    fetchCanales();
    cargarTransportadoras();
  }, []);

  useEffect(() => {
    async function getUserEmail() {
      const { data } = await supabase.auth.getUser();
      // Usa el operador ?? para convertir undefined a null
      setUserEmail(data?.user?.email ?? null);
    }
    getUserEmail();
  }, []);

  useEffect(() => {
    fetchOrdenes();
    (async () => {
      const { data, error } = await supabase.from('ordenes').select('codigo_orden');
      if (!error && data) setExistingCodes(new Set(data.map(d => d.codigo_orden)));
    })();
  }, []);

  // 4. Modificar la función de editar orden para evitar valores undefined
  const editarOrden = async (orden: OrdenAgrupada) => {
    const item = (orden.items && orden.items[0]) ? orden.items[0] : {};
    const ordenData: OrdenEditando = {
      id: orden.id,
      canal_id: orden.canal_id || "",
      codigo_orden: orden.codigo_orden || "",
  estado: orden.estado || "nueva orden",
      cliente: {
        nombre: orden.cliente_nombre || "",
        documento: orden.cliente_documento || "",
        ciudad: orden.cliente_ciudad || "",
        departamento: orden.cliente_departamento || "",
        correo: orden.cliente_correo || "",
        celular: orden.cliente_celular || "",
        direccion: (orden as any).cliente_direccion || "",
      },
      item_id: item.id || "",
      sku: item.sku || "",
      producto: item.producto || "",
      cantidad: Number(item.cantidad) || 1,
      precio: Number(item.precio) || 0,
      flete: Number(item.flete) || 0,
      guia_numero: orden.guia_numero || "",
      transportadora_id: (() => {
        if (!orden.transportadora) return "";
        const encontrada = transportadoras.find(t => t.nombre === orden.transportadora);
        return encontrada ? encontrada.id : "";
      })()
    };
    setOrdenEditando(ordenData);

    reset();
    setValue("canal_id", ordenData.canal_id);
    setValue("codigo_orden", ordenData.codigo_orden);
    setValue("estado", ordenData.estado);
    setValue("cliente.nombre", ordenData.cliente.nombre);
    setValue("cliente.documento", ordenData.cliente.documento || "");
    setValue("cliente.ciudad", ordenData.cliente.ciudad || "");
    setValue("cliente.departamento", ordenData.cliente.departamento || "");
    setValue("cliente.correo", ordenData.cliente.correo || "");
    setValue("cliente.celular", ordenData.cliente.celular || "");
  setValue("cliente.direccion", ordenData.cliente.direccion || "");
    setValue("item_id", ordenData.item_id || "");
    setValue("sku", ordenData.sku);
    setValue("producto", ordenData.producto);
    setValue("cantidad", ordenData.cantidad);
    setValue("precio", ordenData.precio);
    setValue("flete", ordenData.flete);
    setValue("guia_numero", ordenData.guia_numero || "");
  setValue("transportadora_id", ordenData.transportadora_id || "");

    const rest = (orden.items || []).slice(1).map(it => ({
      sku: it.sku || "",
      producto: it.producto || "",
      cantidad: Number(it.cantidad) || 1,
      precio: Number(it.precio) || 0,
      flete: Number(it.flete) || 0,
    }));
    setExtraItems(rest);
    // snapshot de valores originales para revertir
    originalValuesRef.current = {
      form: {
        canal_id: ordenData.canal_id,
        codigo_orden: ordenData.codigo_orden,
        cliente: { ...ordenData.cliente },
        estado: ordenData.estado,
        sku: ordenData.sku,
        producto: ordenData.producto,
        cantidad: ordenData.cantidad,
        precio: ordenData.precio,
        flete: ordenData.flete,
        guia_numero: ordenData.guia_numero || '',
        transportadora_id: ordenData.transportadora_id || ''
      },
      extraItems: rest
    };
    setAbrirDialogo(true);
  };

  // Modifica la función guardarOrden para garantizar actualizaciones correctas
  // Reemplaza COMPLETA tu función guardarOrden por esta
  const guardarOrden = async (data: FormValues) => {
    if (!window.confirm("¿Estás seguro de guardar los cambios?")) return;
    setGuardando(true);
  savedRef.current = false;
    const firstItem = {
      sku: data.sku || "",
      producto: data.producto || "",
      cantidad: Number(data.cantidad) || 1,
      precio: Number(data.precio) || 0,
      flete: Number(data.flete) || 0,
    };
    const extras = extraItems
      .filter(it => (String(it.sku || "").trim() || String(it.producto || "").trim()))
      .map(it => ({
        sku: it.sku || "",
        producto: it.producto || "",
        cantidad: Number(it.cantidad) || 1,
        precio: Number(it.precio) || 0,
        flete: Number(it.flete) || 0,
      }));
    const itemsArray = [firstItem, ...extras];
    try {
      if (ordenEditando?.id) {
        const payload = {
          p_canal_id: data.canal_id,
          p_codigo_orden: data.codigo_orden || "",
          p_estado: data.estado || "nueva orden",
          p_cliente: { ...data.cliente },
          p_items: itemsArray,
          p_orden_id: ordenEditando.id,
          p_guia_numero: data.guia_numero || null,
          p_transportadora_id: data.transportadora_id || null,
        };
  const result = await ordersService.actualizarOrdenCompleta(payload, userEmail || undefined);
        if (result?.error || result?.success === false) {
          toast.error(result?.error || result?.message || "No se pudo actualizar");
        } else {
          toast.success("Orden actualizada correctamente");
          await fetchOrdenes();
          savedRef.current = true; // marcar guardado exitoso
          cerrarDialogo();
        }
      } else {
        const payload = {
          canal_id: data.canal_id,
            codigo_orden: data.codigo_orden || "",
            cliente: data.cliente,
            items: itemsArray,
            guia_numero: data.guia_numero || null,
            transportadora_id: data.transportadora_id || null,
        };
  const result = await ordersService.crearOrdenCompleta(payload, userEmail || undefined);
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success("Orden creada correctamente");
          await fetchOrdenes();
          savedRef.current = true;
          cerrarDialogo();
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Error en guardarOrden:", e);
      toast.error(`Error: ${e.message || "Error desconocido"}`);
    } finally {
      setGuardando(false);
    }
  };



  const eliminarOrden = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar esta orden?")) return;
    try {
      const result = await ordersService.eliminarOrden(id);
      if (result?.error || result?.success === false) {
        toast.error(result?.error || result?.message || "No se pudo eliminar");
        return;
      }
      toast.success("Orden eliminada correctamente");
      await fetchOrdenes();
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(`Error inesperado: ${e.message || "Error desconocido"}`);
    }
  };


  // Corrige la función en OrdenesPage
  const eliminarItem = async (itemId: string) => {
    if (!itemId || !window.confirm("¿Estás seguro de eliminar este ítem?")) return;
    try {
      const result = await ordersService.eliminarItem(itemId);
      if (result?.error) {
        toast.error(`Error: ${result.error}`);
      } else {
        toast.success("Ítem eliminado correctamente");
        await fetchOrdenes();
      }
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(`Error inesperado: ${e.message || "Error desconocido"}`);
    }
  };

  const addExtraItem = () => {
    setExtraItems(prev => [...prev, { sku: "", producto: "", cantidad: 1, precio: 0, flete: 0 }]);
  };

  const updateExtraItem = (index: number, field: keyof ItemInput, value: string | number) => {
    setExtraItems(prev =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  };

  const removeExtraItem = (index: number) => {
    setExtraItems(prev => prev.filter((_, i) => i !== index));
  };

  const exportarExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Órdenes");

    worksheet.columns = [
      { header: "Código", key: "codigo", width: 15 },
      { header: "Cliente", key: "cliente", width: 30 },
      { header: "Producto", key: "producto", width: 30 },
      { header: "Cantidad", key: "cantidad", width: 10 },
      { header: "Precio", key: "precio", width: 15 },
      { header: "Flete", key: "flete", width: 15 },
      { header: "Estado", key: "estado", width: 15 },
      { header: "Fecha", key: "fecha", width: 20 },
    ];

    ordenesAgrupadas.forEach(orden => {
      orden.items.forEach(item => {
        worksheet.addRow({
          codigo: orden.codigo_orden,
          cliente: orden.cliente_nombre,
          producto: item.producto,
          cantidad: item.cantidad,
          precio: item.precio,
          flete: item.flete,
          estado: orden.estado,
          fecha: formatBogotaDate(orden.created_at),
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `ordenes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Modern skeleton similar al dashboard
  const renderLoading = () => (
    <div className="mt-6 bg-white rounded-xl border border-gray-200/60 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-gray-200 rounded-md animate-pulse" />
          <div className="h-9 w-32 bg-gray-200 rounded-md animate-pulse" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500/80">
            <tr>
              {['Código','Cliente','Productos','Estado','Fecha','Acciones'].map(h => (
                <th key={h} className="py-3 px-4 font-medium text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="py-3 px-4"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
                <td className="py-3 px-4"><div className="h-4 w-40 bg-gray-200 rounded" /></td>
                <td className="py-3 px-4 space-y-2">
                  <div className="h-4 w-56 bg-gray-200 rounded" />
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                </td>
                <td className="py-3 px-4"><div className="h-6 w-20 bg-gray-200 rounded-full" /></td>
                <td className="py-3 px-4"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
                <td className="py-3 px-4 flex gap-2">
                  <div className="h-8 w-16 bg-gray-200 rounded-md" />
                  <div className="h-8 w-16 bg-gray-200 rounded-md" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Navbar email={userEmail} />
        <div className="bg-red-100 p-4 rounded-md mt-4">
          <p>Error al cargar las órdenes: {error}</p>
          <Button onClick={() => fetchOrdenes()} className="mt-2">Reintentar</Button>
        </div>
      </div>
    );
  }

  // Añade esta definición de función
  const cerrarDialogo = () => {
    const snapshot = originalValuesRef.current;
    // Calcular cambios sin hooks
    let extraItemsDirty: boolean;
    if (!snapshot) {
      extraItemsDirty = extraItems.length > 0; // no había snapshot inicial
    } else {
      extraItemsDirty = JSON.stringify(snapshot.extraItems) !== JSON.stringify(extraItems);
    }
    const formDirty = isDirty;
    const anyDirty = formDirty || extraItemsDirty;

    if (savedRef.current) {
      savedRef.current = false;
    } else if (anyDirty) {
      const confirma = window.confirm('Hay cambios sin guardar. ¿Deseas descartarlos?');
      if (!confirma) return; // Mantener abierto
      if (snapshot) {
        reset(snapshot.form);
        setExtraItems(snapshot.extraItems);
      } else {
        reset();
        setExtraItems([]);
      }
    }
    setAbrirDialogo(false);
    setTimeout(() => {
      setOrdenEditando(null);
      setExtraItems([]);
      originalValuesRef.current = null;
    }, 150);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const statusBadge = (estado: string) => {
    const styles: Record<string, string> = {
  'por alistar': 'bg-gradient-to-r from-amber-500/10 to-amber-600/10 text-amber-700 ring-amber-600/30',
  'por empacar': 'bg-gradient-to-r from-fuchsia-500/10 to-fuchsia-600/10 text-fuchsia-700 ring-fuchsia-600/30',
  'por despachar': 'bg-gradient-to-r from-blue-500/10 to-blue-600/10 text-blue-700 ring-blue-600/30',
  'por facturar': 'bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 text-emerald-700 ring-emerald-600/30',
  'cancelada': 'bg-gradient-to-r from-rose-500/10 to-rose-600/10 text-rose-700 ring-rose-600/30',
  'eliminada': 'bg-gradient-to-r from-gray-400/10 to-gray-500/10 text-gray-600 ring-gray-500/30 line-through',
  'restaurada': 'bg-gradient-to-r from-[#a489dd]/10 to-[#8f74d6]/10 text-[#4f3d78] ring-[#a489dd]/30',
  // legacy
  'nueva orden': 'bg-gradient-to-r from-sky-400/10 to-sky-500/10 text-sky-700 ring-sky-600/30',
  'en proceso': 'bg-gradient-to-r from-amber-400/10 to-amber-500/10 text-amber-700 ring-amber-600/30',
  'completada': 'bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 text-emerald-700 ring-emerald-600/30'
    };
    const dotColors: Record<string,string> = {
      'nueva orden': 'bg-sky-500',
      'por alistar': 'bg-amber-500',
      'por empacar': 'bg-fuchsia-500',
      'por despachar': 'bg-blue-500',
      'por facturar': 'bg-emerald-500',
      'cancelada': 'bg-rose-500',
      'eliminada': 'bg-gray-400',
  'restaurada': 'bg-[#a489dd]',
      'en proceso': 'bg-amber-500',
      'completada': 'bg-emerald-500'
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-inset backdrop-blur-sm ${styles[estado] || 'bg-gray-50 text-gray-600 ring-gray-400/30'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotColors[estado] || 'bg-gray-400'}`} />
        {estado}
      </span>
    );
  };

  const statusStyles: Record<string, string> = {
  'por alistar': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'por empacar': 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20',
  'por despachar': 'bg-blue-50 text-blue-700 ring-blue-600/20',
  'por facturar': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'cancelada': 'bg-rose-50 text-rose-700 ring-rose-600/20',
  'eliminada': 'bg-gray-100 text-gray-500 ring-gray-400/30 line-through',
  'restaurada': 'bg-[#efe9fb] text-[#4f3d78] ring-[#a489dd]/25',
  // legacy
  'nueva orden': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  'en proceso': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'completada': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
  };

  const renderCards = () => (
    <div className="mt-6">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {ordenesFiltradas.map(orden => {
          const productos = orden.items;
          const abiertos = expanded.has(orden.id);
          const visibles = abiertos ? productos : productos.slice(0,3);
          const restantes = productos.length - visibles.length;
          return (
            <div key={orden.id} className={`group relative rounded-2xl border bg-white/60 border-gray-200/70 backdrop-blur-sm shadow-sm hover:shadow-md transition-all overflow-hidden ${orden.estado === 'eliminada' ? 'opacity-70' : ''}`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent pointer-events-none" />
              <div className="relative p-4 flex flex-col h-full">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 tracking-tight text-sm truncate">{orden.codigo_orden}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{orden.cliente_nombre || 'Sin cliente'}</p>
                  </div>
                  {statusBadge(orden.estado)}
                </div>
                <div className="space-y-2 mb-3">
                  {visibles.map((p, idx) => (
                    <div key={p.id || idx} className="flex items-start justify-between gap-2 rounded-lg border border-gray-100 bg-white/80 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate" title={p.producto}>{p.producto}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5 flex flex-wrap gap-2">
                          <span>Cant: <span className="font-semibold text-gray-700">{p.cantidad}</span></span>
                          {p.precio != null && <span>Precio: <span className="font-semibold text-gray-700">${p.precio}</span></span>}
                          {p.flete != null && <span>Flete: <span className="font-semibold text-gray-700">${p.flete}</span></span>}
                        </p>
                      </div>
                      {productos.length > 1 && p.id && (
                        <button onClick={() => eliminarItem(p.id!)} className="text-[10px] font-medium text-rose-600 hover:text-rose-700 px-1 py-0.5 rounded-md hover:bg-rose-50 transition">X</button>
                      )}
                    </div>
                  ))}
                  {restantes > 0 && !abiertos && (
                    <button onClick={() => toggleExpand(orden.id)} className="w-full text-[11px] font-medium text-sky-600 hover:text-sky-700 bg-sky-50/50 hover:bg-sky-50 rounded-md py-1 transition">Ver +{restantes} productos</button>
                  )}
                  {abiertos && productos.length > 3 && (
                    <button onClick={() => toggleExpand(orden.id)} className="w-full text-[11px] font-medium text-gray-600 hover:text-gray-700 bg-gray-50/60 hover:bg-gray-100 rounded-md py-1 transition">Mostrar menos</button>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-dashed border-gray-200">
                  <span>{formatBogotaDateTime(orden.created_at)}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 border text-[10px] font-medium ${orden.transportadora ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}> 
                    {orden.transportadora ? orden.transportadora : 'Sin transportadora'}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => editarOrden(orden)}>Editar</Button>
                    {orden.estado === 'eliminada' ? (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => ordersService.restaurarOrden(orden.id).then(() => fetchOrdenes())}>Restaurar</Button>
                    ) : (
                      <Button size="sm" variant="destructive" className="h-7 px-2 text-[11px]" onClick={() => eliminarOrden(orden.id)}>Eliminar</Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTable = () => (
    <div className="mt-6 bg-white rounded-xl border border-gray-200/60 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500/80 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="py-3 px-2 w-6" />
              <th className="py-3 px-3 text-left font-medium">Código</th>
              <th className="py-3 px-3 text-left font-medium">Cliente</th>
              <th className="py-3 px-3 text-left font-medium">Resumen</th>
              <th className="py-3 px-3 text-left font-medium">Envío</th>
              <th className="py-3 px-3 text-left font-medium">Estado</th>
              <th className="py-3 px-3 text-left font-medium">Fecha</th>
              <th className="py-3 px-3 text-center font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {ordenesFiltradas.map(orden => {
              const productos = orden.items;
              const totalCantidad = productos.reduce((acc,p)=>acc+(p.cantidad||0),0);
              const totalValor = productos.reduce((acc,p)=>acc+((p.precio||0)*(p.cantidad||0)),0);
              const isExpanded = expanded.has(orden.id);
              const toggle = () => toggleExpand(orden.id);
              const totalPrecio = productos.reduce((acc,p)=>acc+(p.precio||0)*(p.cantidad||1),0);
              const totalFlete = productos.reduce((acc,p)=>acc+(p.flete||0),0);
              return (
                <Fragment key={orden.id}>
                  <tr className={`group transition-colors border-t first:border-t-0 border-gray-100 hover:bg-gray-50/60 ${orden.estado === 'eliminada' ? 'opacity-70' : ''}`}> 
                    <td className="py-3 px-2 align-middle">
                      <button
                        type="button"
                        onClick={toggle}
                        aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                        className="h-6 w-6 flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-xs transition"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="py-3 px-3 font-medium text-gray-800 whitespace-nowrap">{orden.codigo_orden}</td>
                    <td className="py-3 px-3 text-gray-700 min-w-[160px]">{orden.cliente_nombre || <span className='text-gray-400 italic'>Sin cliente</span>}</td>
                    <td className="py-3 px-3 text-gray-600 w-[260px]">
                      <div className="flex flex-col gap-1">
                        <div className="text-[12px] font-medium text-gray-800">
                          {productos.length} producto{productos.length!==1 && 's'} · {totalCantidad} uds
                        </div>
                        <div className="text-[11px] text-gray-500 flex flex-wrap gap-2">
                          <span>Total valor: <span className="font-semibold text-gray-700">${totalValor}</span></span>
                          <span>Flete: <span className="font-semibold text-gray-700">${totalFlete}</span></span>
                        </div>
                        {productos[0] && (
                          <div className="text-[11px] text-gray-400 truncate" title={productos[0].producto}>
                            1er: {productos[0].producto}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-600 w-[200px]">
                      <div className="flex flex-col gap-1">
                        {orden.guia_numero ? (
                          <div className="text-xs font-medium text-gray-700">Guía {orden.guia_numero}</div>
                        ) : <span className="text-[11px] text-gray-400 italic">Sin guía</span>}
                        <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 border text-[10px] font-medium ${orden.transportadora ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          {orden.transportadora ? orden.transportadora : 'Sin transportadora'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">{statusBadge(orden.estado)}</td>
                    <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{formatBogotaDateTime(orden.created_at)}</td>
                    <td className="py-3 px-3">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => editarOrden(orden)}
                          aria-label="Editar orden"
                          className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {orden.estado === 'eliminada' ? (
                          <button
                            type="button"
                            onClick={() => ordersService.restaurarOrden(orden.id).then(fetchOrdenes)}
                            aria-label="Restaurar orden"
                            className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 bg-white text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => eliminarOrden(orden.id)}
                            aria-label="Eliminar orden"
                            className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr className="bg-gray-50/50 border-t border-gray-100">
                    <td colSpan={8} className="px-0 py-0">
                      <div style={{maxHeight: isExpanded ? '1000px' : '0px'}} className="transition-[max-height] duration-300 ease-in-out overflow-hidden">
                        <div className="px-6 py-5 flex flex-col gap-6">
                          <div>
                            <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">Detalle de Productos</h4>
                            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                              <table className="min-w-full text-xs">
                                <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">SKU</th>
                                    <th className="px-3 py-2 text-left font-medium">Producto</th>
                                    <th className="px-3 py-2 text-right font-medium">Cant.</th>
                                    <th className="px-3 py-2 text-right font-medium">Precio</th>
                                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                                    <th className="px-3 py-2 text-right font-medium">Flete</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {productos.map((p, i) => {
                                    const subtotal = (p.precio || 0) * (p.cantidad || 0);
                                    return (
                                      <tr key={p.id || i} className="hover:bg-sky-50/40 transition">
                                        <td className="px-3 py-2 font-mono text-gray-700">{p.sku || '-'}</td>
                                        <td className="px-3 py-2 text-gray-700 max-w-[240px] truncate" title={p.producto}>{p.producto}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{p.cantidad}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{p.precio != null ? `$${p.precio}` : '-'}</td>
                                        <td className="px-3 py-2 text-right text-gray-700 font-medium">${subtotal}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{p.flete != null ? `$${p.flete}` : '-'}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-gray-50 border-t border-gray-200 text-[11px]">
                                    <td className="px-3 py-2 font-medium" colSpan={2}>Totales</td>
                                    <td className="px-3 py-2 text-right font-semibold text-gray-700">{totalCantidad}</td>
                                    <td className="px-3 py-2" />
                                    <td className="px-3 py-2 text-right font-semibold text-gray-700">${totalPrecio}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-gray-700">${totalFlete}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="p-3 rounded-lg border border-gray-200 bg-white/60">
                              <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">Guía</p>
                              <p className="mt-1 text-gray-700 font-medium">{orden.guia_numero || '—'}</p>
                            </div>
                            <div className="p-3 rounded-lg border border-gray-200 bg-white/60">
                              <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">Transportadora</p>
                              <p className="mt-1 text-gray-700 font-medium">{orden.transportadora || '—'}</p>
                            </div>
                            <div className="p-3 rounded-lg border border-gray-200 bg-white/60">
                              <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">Creada</p>
                              <p className="mt-1 text-gray-700 font-medium">{formatBogotaDateTime(orden.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
  // ...existing code...
  return (
    <>
      <Navbar email={userEmail} />
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Gestión de Órdenes</h1>
            <p className="text-sm text-gray-500 mt-1">Crea, edita y administra todas las órdenes centralizadas.</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <button onClick={() => setViewMode('cards')} className={`px-3 py-1.5 text-xs font-medium transition ${viewMode==='cards' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:text-gray-900'}`}>Tarjetas</button>
              <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 text-xs font-medium transition border-l border-gray-200 ${viewMode==='table' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:text-gray-900'}`}>Tabla</button>
            </div>
              <button
                onClick={toggleOrderDirection}
                className="group relative h-9 w-9 rounded-full border border-gray-300/70 bg-white text-gray-600 flex items-center justify-center shadow-sm hover:bg-gray-50 active:scale-95 transition overflow-visible"
                aria-label={orderDirection === 'asc' ? 'Antiguas primero' : 'Recientes primero'}
                title={orderDirection === 'asc' ? 'Antiguas primero' : 'Recientes primero'}
              >
                <ArrowUpDown className={`h-4 w-4 transition-transform duration-300 ${orderDirection==='desc' ? 'rotate-180' : 'rotate-0'}`} />
                <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900/90 px-2 py-1 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-lg">
                  {orderDirection === 'asc' ? 'Antiguas → Recientes' : 'Recientes → Antiguas'}
                </span>
              </button>
            <div className="flex items-center gap-2">
              <button
                onClick={nuevaOrden}
                className="group relative h-9 w-9 rounded-full bg-gradient-to-br from-[#a489dd] to-[#8f74d6] text-white flex items-center justify-center shadow-sm hover:shadow-md active:scale-95 transition overflow-visible"
                aria-label="Nueva orden"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                </svg>
                <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900/90 px-2 py-1 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-lg">Nueva</span>
              </button>
              <button
                onClick={exportarExcel}
                className="group relative h-9 w-9 rounded-full border border-gray-300/60 bg-white text-gray-700 flex items-center justify-center shadow-sm hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition overflow-visible"
                aria-label="Exportar a Excel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3" className="hidden" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h9l7 7v9a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm9 0v6a1 1 0 001 1h6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17l2.5-3L9 11m4 6l2.5-3L13 11" />
                </svg>
                <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900/90 px-2 py-1 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-lg">Exportar</span>
              </button>
              <button
                onClick={() => setAbrirImportar(true)}
                className="group relative h-9 w-9 rounded-full border border-[#35345520] bg-white text-[#353455] flex items-center justify-center shadow-sm hover:bg-[#3534550d] active:scale-95 transition overflow-visible"
                aria-label="Importar masivo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h9l7 7v9M12 4v6a1 1 0 001 1h6M8 17l2.5-3L8 11m4 6l2.5-3L12 11" />
                </svg>
                <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900/90 px-2 py-1 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-lg">Importar</span>
              </button>
            </div>
          </div>
        </div>
        {error && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 flex items-center justify-between">
            <span>Error al cargar las órdenes: {error}</span>
            <Button size="sm" variant="outline" onClick={() => fetchOrdenes()}>Reintentar</Button>
          </div>
        )}

        {/* Barra de búsqueda */}
        {!loading && ordenesAgrupadas.length>0 && (
          <div className="mb-5 flex flex-col gap-3">
            <div className="relative group">
              <input
                type="text"
                value={busqueda}
                onChange={e=> setBusqueda(e.target.value)}
                placeholder="Buscar por código de orden, cliente, producto o SKU..."
                className="w-full rounded-xl border border-gray-300/70 bg-white/70 backdrop-blur px-4 py-2.5 pr-12 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 shadow-sm transition"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 group-focus-within:text-sky-500 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
                </svg>
              </div>
              {busqueda && (
                <button type="button" onClick={()=> setBusqueda('')} aria-label="Limpiar búsqueda" className="absolute inset-y-0 right-8 flex items-center text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="flex items-center gap-3 flex-wrap">
                <DateRangePicker
                  initialDate={{ from: rangoFechas?.from || new Date(), to: rangoFechas?.to || new Date() }}
                  onUpdate={({ range }) => setRangoFechas(range)}
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500">Hora inicio</label>
                  <input type="time" value={horaInicio} onChange={e=> setHoraInicio(e.target.value)} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500">Hora fin</label>
                  <input type="time" value={horaFin} onChange={e=> setHoraFin(e.target.value)} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500" />
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{ordenesFiltradas.length}</span> coincidenc{ordenesFiltradas.length===1?'ia':'ias'} dentro del rango
                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 font-medium">{rangoFechas?.from ? formatBogotaDateTime(rangoFechas.from.toISOString()).split(',')[0] : '—'} - {rangoFechas?.to ? formatBogotaDateTime(rangoFechas.to.toISOString()).split(',')[0] : '—'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{ordenesFiltradas.length}</span> coincidenc{ordenesFiltradas.length===1?'ia':'ias'}{busqueda && (<>
                <span className="mx-1">para</span>
                <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-medium">{busqueda}</span>
              </>)}
              {(estadoFiltro || busqueda) && (
                <button type="button" onClick={()=> { setEstadoFiltro(null); setBusqueda(''); }} className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 font-medium transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {/* Contadores / Filtros por estado */}
        {!loading && ordenesAgrupadas.length>0 && (
          <div className="mb-6 flex flex-wrap gap-3">
            {estadosOrden.filter(e=>counts[e]).map(e => {
              const activo = estadoFiltro===e;
              const estilos: Record<string,string> = {
                'nueva orden':'bg-sky-50 text-sky-700 ring-sky-600/20 border-sky-200',
                'por alistar':'bg-amber-50 text-amber-700 ring-amber-600/20 border-amber-200',
                'por empacar':'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20 border-fuchsia-200',
                'por despachar':'bg-blue-50 text-blue-700 ring-blue-600/20 border-blue-200',
                'por facturar':'bg-emerald-50 text-emerald-700 ring-emerald-600/20 border-emerald-200',
                'cancelada':'bg-rose-50 text-rose-700 ring-rose-600/20 border-rose-200',
                'restaurada':'bg-[#efe9fb] text-[#4f3d78] ring-[#a489dd]/25 border-[#dacff2]'
              };
              const label: Record<string,string> = { 'nueva orden':'Nueva','por alistar':'Alistar','por empacar':'Empacar','por despachar':'Despachar','por facturar':'Facturar','cancelada':'Cancelada','restaurada':'Restaurada'};
              return (
                <button key={e} onClick={()=> setEstadoFiltro(activo?null:e)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl border ring-1 ring-inset text-xs font-semibold transition ${estilos[e]} ${activo? 'scale-105 shadow-sm':'opacity-80 hover:opacity-100'}`}
                >
                  <span>{label[e]||e}</span>
                  <span className={`inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-[11px] font-bold bg-white/70 backdrop-blur border ${activo? 'border-white/80 text-gray-900':'border-white/60 text-gray-700'}`}>{counts[e]}</span>
                  {activo && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />}
                </button>
              )
            })}
            {estadoFiltro && (
              <button onClick={()=> setEstadoFiltro(null)} className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                Quitar filtro
              </button>
            )}
          </div>
        )}

        {loading ? renderLoading() : (
          ordenesFiltradas.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white/60 p-12 text-center">
              <p className="text-gray-600">No hay órdenes registradas aún.</p>
              <Button className="mt-4" onClick={nuevaOrden}>Crear la primera orden</Button>
            </div>
          ) : (
            viewMode === 'cards' ? renderCards() : renderTable()
          )
        )}

        {/* Dialogo */}
        <Dialog open={abrirDialogo} onClose={cerrarDialogo} maxWidth="md" fullWidth>
          <DialogTitle>{ordenEditando ? 'Editar Orden' : 'Nueva Orden'}</DialogTitle>
          <form onSubmit={handleSubmit(guardarOrden)}>
            <DialogContent>
              {/* Estado y Envío */}
              <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm mb-8">
                <h3 className="font-semibold text-gray-800 mb-4 text-sm tracking-wide uppercase">Estado y Envío</h3>
                {/* Barra de progreso de flujo */}
                <FlujoProgreso estado={watch('estado')} onChange={(v)=> setValue('estado', v as any)} className="mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Controller name="estado" control={control} render={({ field }) => {
                    const estadoActual = field.value;
                    const labelMap: Record<string,string> = {
                      'nueva orden': 'Nueva',
                      'por alistar': 'Alistar',
                      'por empacar': 'Empacar',
                      'por despachar': 'Despachar',
                      'por facturar': 'Facturar',
                      'cancelada': 'Cancelada',
                      'restaurada': 'Restaurada'
                    };
                    const baseChip = (activo: boolean, clases: string) => `px-3 py-1.5 rounded-full border text-[11px] font-medium ring-1 ring-inset transition ${clases} ${activo? 'scale-105 shadow-sm' : 'opacity-70 hover:opacity-100'}`;
                    const styleEstadoActual: Record<string,string> = {
                      'nueva orden': 'bg-sky-50 text-sky-700 ring-sky-600/20 border-sky-200',
                      'por alistar': 'bg-amber-50 text-amber-700 ring-amber-600/20 border-amber-200',
                      'por empacar': 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20 border-fuchsia-200',
                      'por despachar': 'bg-blue-50 text-blue-700 ring-blue-600/20 border-blue-200',
                      'por facturar': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 border-emerald-200',
                      'cancelada': 'bg-rose-50 text-rose-700 ring-rose-600/20 border-rose-200',
                      'restaurada': 'bg-[#efe9fb] text-[#4f3d78] ring-[#a489dd]/25 border-[#dacff2]'
                    };
                    return (
                      <div className="flex flex-col gap-3">
                        <span className="text-xs font-medium text-gray-600">Estado Actual</span>
                        <div className={`w-fit px-4 py-2 rounded-full text-[12px] font-semibold ring-1 ring-inset border ${styleEstadoActual[estadoActual] || 'bg-gray-50 text-gray-600 border-gray-200'} scale-105`}>{labelMap[estadoActual] || estadoActual}</div>
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200/70 to-transparent" />
                        <div className="flex flex-wrap gap-2">
                          {['cancelada','restaurada'].map(op => (
                            <button key={op} type="button" onClick={()=> field.onChange(op)} className={baseChip(estadoActual===op, styleEstadoActual[op])}>{labelMap[op]}</button>
                          ))}
                        </div>
                        {errors.estado && <span className="text-[10px] text-rose-600 font-medium">{errors.estado.message as string}</span>}
                      </div>
                    );
                  }} />
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Controller name="transportadora_id" control={control} render={({ field }) => (
                      <TextField select label="Transportadora" variant="outlined" fullWidth error={!!errors.transportadora_id} helperText={errors.transportadora_id?.message} value={field.value || ''} onChange={field.onChange}>
                        {transportadoras.map(t => (<MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>))}
                        <MenuItem value="__add_new__" onClick={(e) => { e.preventDefault(); const nombre = prompt('Nueva transportadora'); if (nombre) { addTransportadora(nombre); } }}>+ Añadir nueva...</MenuItem>
                      </TextField>
                    )} />
                    <Controller name="guia_numero" control={control} render={({ field }) => (
                      <TextField label="Número de Guía" variant="outlined" fullWidth error={!!errors.guia_numero} helperText={errors.guia_numero?.message} {...field} />
                    )} />
                    <Controller name="canal_id" control={control} render={({ field }) => (
                      <TextField select label="Canal" variant="outlined" fullWidth error={!!errors.canal_id} helperText={errors.canal_id?.message || ''} value={field.value || ''} onChange={field.onChange}>
                        {canales.map(canal => (<MenuItem key={canal.id} value={canal.id}>{canal.nombre}</MenuItem>))}
                      </TextField>
                    )} />
                    <Controller name="codigo_orden" control={control} render={({ field }) => (
                      <TextField label="Código de Orden" variant="outlined" fullWidth error={!!errors.codigo_orden} helperText={errors.codigo_orden?.message} {...field} />
                    )} />
                  </div>
                </div>
              </div>
              {/* Cliente */}
              <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm mb-8">
                <h3 className="font-semibold text-gray-800 mb-4 text-sm tracking-wide uppercase">Datos del Cliente</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Controller name="cliente.nombre" control={control} render={({ field }) => (
                    <TextField label="Nombre" variant="outlined" fullWidth error={!!errors.cliente?.nombre} helperText={errors.cliente?.nombre?.message || ''} value={field.value || ''} onChange={field.onChange} />
                  )} />
                  <Controller name="cliente.documento" control={control} render={({ field }) => (
                    <TextField label="Documento" variant="outlined" fullWidth error={!!errors.cliente?.documento} helperText={errors.cliente?.documento?.message} {...field} />
                  )} />
                  <Controller name="cliente.celular" control={control} render={({ field }) => (
                    <TextField label="Celular" variant="outlined" fullWidth error={!!errors.cliente?.celular} helperText={errors.cliente?.celular?.message} {...field} />
                  )} />
                  <Controller name="cliente.direccion" control={control} render={({ field }) => (
                    <TextField label="Dirección" variant="outlined" fullWidth value={field.value || ''} onChange={field.onChange} error={!!errors.cliente?.direccion} helperText={errors.cliente?.direccion?.message || ''} />
                  )} />
                  <Controller name="cliente.ciudad" control={control} render={({ field }) => (
                    <TextField label="Ciudad" variant="outlined" fullWidth error={!!errors.cliente?.ciudad} helperText={errors.cliente?.ciudad?.message} {...field} />
                  )} />
                  <Controller name="cliente.departamento" control={control} render={({ field }) => (
                    <TextField label="Departamento" variant="outlined" fullWidth error={!!errors.cliente?.departamento} helperText={errors.cliente?.departamento?.message} {...field} />
                  )} />
                  <Controller name="cliente.correo" control={control} render={({ field }) => (
                    <TextField label="Correo" variant="outlined" fullWidth error={!!errors.cliente?.correo} helperText={errors.cliente?.correo?.message} {...field} />
                  )} />
                </div>
              </div>
              {/* Producto principal */}
              <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm mb-8">
                <h3 className="font-semibold text-gray-800 mb-4 text-sm tracking-wide uppercase">Producto Principal</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Controller name="sku" control={control} render={({ field }) => (
                    <TextField label="SKU" variant="outlined" fullWidth error={!!errors.sku} helperText={errors.sku?.message} {...field} />
                  )} />
                  <Controller name="producto" control={control} render={({ field }) => (
                    <TextField label="Producto" variant="outlined" fullWidth error={!!errors.producto} helperText={errors.producto?.message} {...field} />
                  )} />
                  <Controller name="cantidad" control={control} render={({ field }) => (
                    <TextField label="Cantidad" type="number" variant="outlined" fullWidth error={!!errors.cantidad} helperText={errors.cantidad?.message} {...field} />
                  )} />
                  <Controller name="precio" control={control} render={({ field }) => (
                    <TextField label="Precio" type="number" variant="outlined" fullWidth error={!!errors.precio} helperText={errors.precio?.message} {...field} />
                  )} />
                  <Controller name="flete" control={control} render={({ field }) => (
                    <TextField label="Flete" type="number" variant="outlined" fullWidth error={!!errors.flete} helperText={errors.flete?.message} {...field} />
                  )} />
                </div>
              </div>
              {/* Productos adicionales */}
              <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">Productos Adicionales</h3>
                  <Button type="button" variant="outline" onClick={addExtraItem} size="sm">Agregar</Button>
                </div>
                {extraItems.length === 0 && <p className="text-xs text-gray-500 mb-2">No has agregado productos adicionales.</p>}
                <div className="space-y-6">
                  {extraItems.map((it, idx) => (
                    <div key={idx} className="relative rounded-md border border-gray-200 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <TextField label="SKU" variant="outlined" fullWidth value={it.sku} onChange={(e) => updateExtraItem(idx, 'sku', e.target.value)} />
                        <TextField label="Producto" variant="outlined" fullWidth value={it.producto} onChange={(e) => updateExtraItem(idx, 'producto', e.target.value)} />
                        <TextField label="Cantidad" type="number" variant="outlined" fullWidth value={it.cantidad} onChange={(e) => updateExtraItem(idx, 'cantidad', e.target.value)} />
                        <TextField label="Precio" type="number" variant="outlined" fullWidth value={it.precio} onChange={(e) => updateExtraItem(idx, 'precio', e.target.value)} />
                        <TextField label="Flete" type="number" variant="outlined" fullWidth value={it.flete} onChange={(e) => updateExtraItem(idx, 'flete', e.target.value)} />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeExtraItem(idx)}>Quitar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button type="button" variant="outline" onClick={cerrarDialogo} disabled={guardando}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Button>
            </DialogActions>
          </form>
        </Dialog>
        <BulkImportOrders
  open={abrirImportar}
  onClose={()=>setAbrirImportar(false)}
  canales={canales}
  canalDefault={canales[0]?.id}
  existingCodes={existingCodes}
  onImported={() => { fetchOrdenes(); (async () => { const { data } = await supabase.from('ordenes').select('codigo_orden'); if (data) setExistingCodes(new Set(data.map(d=>d.codigo_orden))); })(); }}
/>
      </div>
    </>
  );
}



