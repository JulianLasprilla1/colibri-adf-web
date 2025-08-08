"use client";

import { useState, useEffect } from "react";
import { useOrders } from "@/hooks/useOrders";
import { ordersService } from "@/services/ordersService";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogActions } from "@mui/material";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useForm, Controller, Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { TextField, MenuItem } from "@mui/material";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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
  }),
  estado: z.string().min(1, "El estado es obligatorio"),
  item_id: z.string().optional(), // Añadir campo para ID del item
  sku: z.string().min(1, "El SKU es obligatorio"),
  producto: z.string().min(2, "El producto es obligatorio"),
  cantidad: z.coerce.number().min(1, "La cantidad debe ser mayor a 0"),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo"),
  flete: z.coerce.number().min(0, "El flete no puede ser negativo"),
});

// Actualiza el tipo FormValues
type FormValues = z.infer<typeof schema>;

type Canal = {
  id: string;
  nombre: string;
};

export default function OrdenesPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Usa el hook con el refreshKey
  const { ordenesAgrupadas, loading, error, fetchOrdenes } = useOrders(refreshKey);
  const [canales, setCanales] = useState<Canal[]>([]);
  const [abrirDialogo, setAbrirDialogo] = useState(false);
  const [ordenEditando, setOrdenEditando] = useState<any | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  
  // 1. Mejora los valores por defecto para asegurar que nunca sean undefined
  const { register, handleSubmit, formState: { errors }, reset, control, setValue } = useForm<FormValues>({
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
      },
      estado: "nueva orden",
      sku: "",
      producto: "",
      cantidad: 1,
      precio: 0,
      flete: 0,
    },
  });

  // Función mejorada para manejar Nueva Orden
  const nuevaOrden = () => {
    setOrdenEditando(null);
    reset({
      canal_id: "",
      codigo_orden: "",
      cliente: {
        nombre: "",
        documento: "",
        ciudad: "",
        departamento: "",
        correo: "",
        celular: "",
      },
      estado: "nueva orden",
      sku: "",
      producto: "",
      cantidad: 1,
      precio: 0,
      flete: 0,
    });
    setAbrirDialogo(true);
  };

  useEffect(() => {
    const fetchCanales = async () => {
      try {
        // Si prefieres llamar directamente a supabase:
        const { data, error } = await supabase.from("canales_venta").select("*");
        if (!error && data) {
          setCanales(data);
        } else if (error) {
          throw error;
        }
        
        // O si usas el servicio:
        // const data = await ordersService.getCanales();
        // setCanales(data);
      } catch (error) {
        console.error("Error al cargar canales:", error);
        toast.error("Error al cargar canales");
      }
    };

    fetchCanales();
  }, []);

  useEffect(() => {
    async function getUserEmail() {
      const { data } = await supabase.auth.getUser();
      // Usa el operador ?? para convertir undefined a null
      setUserEmail(data?.user?.email ?? null);
    }
    getUserEmail();
  }, []);

  // Elimina la redefinición de fetchOrdenes y usa esta función auxiliar en su lugar
  const triggerRefresh = async () => {
    // Incrementa el refreshKey para forzar actualización
    setRefreshKey(prev => prev + 1);
  };

  // 4. Modificar la función de editar orden para evitar valores undefined
  const editarOrden = async (orden: any) => {
    setOrdenEditando(orden);
    
    // Si hay varios items, solo usaremos el primero
    const item = orden.items[0] || {};
    
    // Reset form
    reset();
    
    // Set values with ID of the item to update
    setValue("canal_id", orden.canal_id || "");
    setValue("codigo_orden", orden.codigo_orden || "");
    setValue("estado", orden.estado || "nueva orden");
    setValue("cliente.nombre", orden.cliente_nombre || "");
    setValue("cliente.documento", orden.cliente_documento || "");
    setValue("cliente.ciudad", orden.cliente_ciudad || "");
    setValue("cliente.departamento", orden.cliente_departamento || "");
    setValue("cliente.correo", orden.cliente_correo || "");
    setValue("cliente.celular", orden.cliente_celular || "");
    
    // Importante: guarda también el ID del item
    setValue("item_id", item.id || "");
    setValue("sku", item.sku || "");
    setValue("producto", item.producto || "");
    setValue("cantidad", Number(item.cantidad) || 1);
    setValue("precio", Number(item.precio) || 0);
    setValue("flete", Number(item.flete) || 0);
    
    setAbrirDialogo(true);
  };

  // Modifica la función guardarOrden para garantizar actualizaciones correctas
  const guardarOrden = async (data: FormValues) => {
    if (!window.confirm("¿Estás seguro de guardar los cambios?")) return;
    
    setGuardando(true);
    
    try {
      if (ordenEditando?.id) {
        console.log("Actualizando orden ID:", ordenEditando.id);
        
        // Simplificado: solo pasamos los datos necesarios
        const payload = {
          p_canal_id: data.canal_id,
          p_cliente: {
            nombre: data.cliente.nombre || "",
            documento: data.cliente.documento || "",
            ciudad: data.cliente.ciudad || "",
            departamento: data.cliente.departamento || "",
            correo: data.cliente.correo || "",
            celular: data.cliente.celular || ""
          },
          p_codigo_orden: data.codigo_orden || "",
          p_estado: data.estado || "nueva orden",
          p_items: [
            {
              sku: data.sku || "",
              producto: data.producto || "",
              cantidad: Number(data.cantidad) || 1,
              precio: Number(data.precio) || 0,
              flete: Number(data.flete) || 0
            }
          ],
          p_orden_id: ordenEditando.id
        };
        
        console.log("Actualizando con payload:", JSON.stringify(payload));
        
        const result = await ordersService.actualizarOrdenCompleta(payload);
        
        if (result?.error) {
          toast.error(`Error: ${result.error}`);
        } else {
          toast.success("Orden actualizada correctamente");
          
          // Forzar actualización de la lista
          setTimeout(async () => {
            await fetchOrdenes();
            setAbrirDialogo(false);
            reset();
            setOrdenEditando(null);
          }, 500);
        }
      } else {
        // Código para crear nueva orden...
        const itemsArray = [
          {
            sku: data.sku || "",
            producto: data.producto || "",
            cantidad: Number(data.cantidad) || 1,
            precio: Number(data.precio) || 0,
            flete: Number(data.flete) || 0
          }
        ];

        const payload = {
          canal_id: data.canal_id,
          codigo_orden: data.codigo_orden || "",
          cliente: data.cliente,
          items: itemsArray
        };

        console.log("Creando orden:", JSON.stringify(payload));
        
        // Asegúrate también de guardar el resultado aquí
        const result = await ordersService.crearOrdenCompleta(payload);
        
        if (result?.error) {
          toast.error(`Error: ${result.error}`);
        } else {
          toast.success("Orden creada correctamente");
          await fetchOrdenes();
          setAbrirDialogo(false);
          reset();
        }
      }
    } catch (err: any) {
      console.error("Error en actualización:", err);
      toast.error(`Error: ${err.message || "Error desconocido"}`);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarOrden = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar esta orden?")) return;

    try {
      const result = await ordersService.eliminarOrden(id);
      if (result?.error) {
        toast.error(`Error: ${result.error}`);
      } else {
        toast.success("Orden eliminada correctamente");
        fetchOrdenes();
      }
    } catch (err: any) {
      toast.error(`Error inesperado: ${err?.message || "Error desconocido"}`);
    }
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
          fecha: new Date(orden.created_at).toLocaleDateString(),
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `ordenes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

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
    setAbrirDialogo(false);
    setTimeout(() => {
      setOrdenEditando(null);
      reset();
    }, 200);
  };

  return (
    <>
      <Navbar email={userEmail} />
      
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-4 mt-4">
          <h1 className="text-2xl font-bold">Órdenes</h1>
          <div className="flex gap-2">
            <Button onClick={nuevaOrden}>
              Nueva Orden
            </Button>
            <Button onClick={exportarExcel} variant="outline">
              Exportar a Excel
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p>Cargando órdenes...</p>
          </div>
        ) : ordenesAgrupadas.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-md">
            <p>No hay órdenes disponibles.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-md overflow-hidden shadow-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 text-left">Código</th>
                  <th className="py-2 px-4 text-left">Cliente</th>
                  <th className="py-2 px-4 text-left">Productos</th>
                  <th className="py-2 px-4 text-left">Estado</th>
                  <th className="py-2 px-4 text-left">Fecha</th>
                  <th className="py-2 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesAgrupadas.map((orden) => (
                  <tr key={orden.id} className="border-t hover:bg-gray-50">
                    <td className="py-2 px-4">{orden.codigo_orden}</td>
                    <td className="py-2 px-4">{orden.cliente_nombre}</td>
                    <td className="py-2 px-4">
                      {orden.items.map((item, i) => (
                        <div key={`item-${orden.id}-${i}`} className="mb-1">
                          {item.producto} ({item.cantidad}) - ${item.precio}
                        </div>
                      ))}
                    </td>
                    <td className="py-2 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        orden.estado === 'completada' ? 'bg-green-100 text-green-800' : 
                        orden.estado === 'cancelada' ? 'bg-red-100 text-red-800' : 
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {orden.estado}
                      </span>
                    </td>
                    <td className="py-2 px-4">{new Date(orden.created_at).toLocaleDateString()}</td>
                    <td className="py-2 px-4 flex justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => editarOrden(orden)}>
                        Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => eliminarOrden(orden.id)}>
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Diálogo de Edición/Creación */}
        <Dialog open={abrirDialogo} onClose={cerrarDialogo} maxWidth="md" fullWidth>
          <DialogTitle>
            {ordenEditando ? "Editar Orden" : "Nueva Orden"}
          </DialogTitle>
          <form onSubmit={handleSubmit(guardarOrden)}>
            <DialogContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="canal_id"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label="Canal"
                      variant="outlined"
                      fullWidth
                      error={!!errors.canal_id}
                      helperText={errors.canal_id?.message || ""}
                      value={field.value || ""}
                      onChange={field.onChange}
                    >
                      {canales.map((canal) => (
                        <MenuItem key={canal.id} value={canal.id}>
                          {canal.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                
                <Controller
                  name="codigo_orden"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="Código de Orden"
                      variant="outlined"
                      fullWidth
                      error={!!errors.codigo_orden}
                      helperText={errors.codigo_orden?.message}
                      {...field}
                    />
                  )}
                />
                
                <Controller
                  name="cliente.nombre"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="Nombre del Cliente"
                      variant="outlined"
                      fullWidth
                      error={!!errors.cliente?.nombre}
                      helperText={errors.cliente?.nombre?.message || ""}
                      value={field.value || ""}
                      onChange={field.onChange}
                    />
                  )}
                />
                
                <Controller
                  name="cliente.documento"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="Documento"
                      variant="outlined"
                      fullWidth
                      error={!!errors.cliente?.documento}
                      helperText={errors.cliente?.documento?.message}
                      {...field}
                    />
                  )}
                />
                
                <Controller
                  name="cliente.ciudad"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="Ciudad"
                      variant="outlined"
                      fullWidth
                      error={!!errors.cliente?.ciudad}
                      helperText={errors.cliente?.ciudad?.message}
                      {...field}
                    />
                  )}
                />
                
                <Controller
                  name="cliente.departamento"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="Departamento"
                      variant="outlined"
                      fullWidth
                      error={!!errors.cliente?.departamento}
                      helperText={errors.cliente?.departamento?.message}
                      {...field}
                    />
                  )}
                />
                
                <Controller
                  name="cliente.correo"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="Correo Electrónico"
                      variant="outlined"
                      fullWidth
                      error={!!errors.cliente?.correo}
                      helperText={errors.cliente?.correo?.message}
                      {...field}
                    />
                  )}
                />
                
                <Controller
                  name="cliente.celular"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="Celular"
                      variant="outlined"
                      fullWidth
                      error={!!errors.cliente?.celular}
                      helperText={errors.cliente?.celular?.message}
                      {...field}
                    />
                  )}
                />
                
                <Controller
                  name="estado"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label="Estado"
                      variant="outlined"
                      fullWidth
                      error={!!errors.estado}
                      helperText={errors.estado?.message}
                      {...field}
                    >
                      <MenuItem value="nueva orden">Nueva Orden</MenuItem>
                      <MenuItem value="en proceso">En Proceso</MenuItem>
                      <MenuItem value="completada">Completada</MenuItem>
                      <MenuItem value="cancelada">Cancelada</MenuItem>
                    </TextField>
                  )}
                />
                
                <div className="md:col-span-2">
                  <h3 className="font-medium text-lg mb-2">Producto</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Controller
                      name="sku"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          label="SKU"
                          variant="outlined"
                          fullWidth
                          error={!!errors.sku}
                          helperText={errors.sku?.message}
                          {...field}
                        />
                      )}
                    />
                    
                    <Controller
                      name="producto"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          label="Producto"
                          variant="outlined"
                          fullWidth
                          error={!!errors.producto}
                          helperText={errors.producto?.message}
                          {...field}
                        />
                      )}
                    />
                    
                    <Controller
                      name="cantidad"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          label="Cantidad"
                          variant="outlined"
                          type="number"
                          fullWidth
                          error={!!errors.cantidad}
                          helperText={errors.cantidad?.message}
                          {...field}
                        />
                      )}
                    />
                    
                    <Controller
                      name="precio"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          label="Precio"
                          variant="outlined"
                          type="number"
                          fullWidth
                          error={!!errors.precio}
                          helperText={errors.precio?.message}
                          {...field}
                        />
                      )}
                    />
                    
                    <Controller
                      name="flete"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          label="Flete"
                          variant="outlined"
                          type="number"
                          fullWidth
                          error={!!errors.flete}
                          helperText={errors.flete?.message}
                          {...field}
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button variant="outline" onClick={cerrarDialogo} disabled={guardando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </div>
    </>
  );
}



