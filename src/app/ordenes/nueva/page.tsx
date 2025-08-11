"use client";

import { useState, useEffect } from "react";
import { useForm, Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ordersService } from "@/services/ordersService";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  sku: z.string().min(1, "El SKU es obligatorio"),
  producto: z.string().min(2, "El producto es obligatorio"),
  cantidad: z.coerce.number().min(1, "La cantidad debe ser mayor a 0"),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo"),
  flete: z.coerce.number().min(0, "El flete no puede ser negativo"),
});

type FormValues = z.infer<typeof schema>;

type ItemInput = {
  sku: string;
  producto: string;
  cantidad: number | string;
  precio: number | string;
  flete: number | string;
};

export default function NuevaOrdenPage() {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [canales, setCanales] = useState<{ id: string; nombre: string }[]>([]);
  const [extraItems, setExtraItems] = useState<ItemInput[]>([]);

  useEffect(() => {
    const cargarCanales = async () => {
      try {
        const canalesResult = await ordersService.getCanales();
        if (!Array.isArray(canalesResult)) {
          toast.error("Error cargando canales");
        } else {
          setCanales(canalesResult);
        }
      } catch (err) {
        console.error("Error inesperado al cargar canales:", err);
        toast.error("Error inesperado al cargar canales");
      }
    };
    cargarCanales();
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      canal_id: "",
      codigo_orden: "",
      cliente: { nombre: "" },
      estado: "nueva orden",
      sku: "",
      producto: "",
      cantidad: 1,
      precio: 0,
      flete: 0,
    },
  });

  const onSubmit = async (data: FormValues) => {
    setGuardando(true);
    try {
      // 1) Ítem principal del formulario
      const firstItem = {
        sku: data.sku || "",
        producto: data.producto || "",
        cantidad: Number(data.cantidad) || 1,
        precio: Number(data.precio) || 0,
        flete: Number(data.flete) || 0,
      };

      // 2) Ítems adicionales (solo los que tengan SKU o producto)
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

      // 3) Llamada RPC crear_orden_completa
      const payload = {
        canal_id: data.canal_id,
        codigo_orden: data.codigo_orden,
        cliente: data.cliente,
        items: itemsArray,
      };

      const result = await ordersService.crearOrdenCompleta(payload);
      if (result?.error) throw new Error(result.error);

      // 4) Éxito
      toast.success("Orden creada exitosamente");
      router.push("/ordenes");
      // Si prefieres quedarte en la página en vez de redirigir:
      // reset();
      // setExtraItems([]);
    } catch (err) {
      console.error("Error al crear la orden:", err);
      toast.error(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
    } finally {
      setGuardando(false);
    }
  };

  // Helpers para productos adicionales
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

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg">
      <h1 className="text-2xl font-bold mb-4">Crear Nueva Orden</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="codigo_orden" className="block mb-1 font-medium">Código de Orden</label>
          <input
            id="codigo_orden"
            {...register("codigo_orden")}
            className="border rounded p-2 w-full"
            placeholder="Ej: ADDI-12345"
          />
          {errors.codigo_orden?.message && (
            <p className="text-red-500 text-sm">{String(errors.codigo_orden.message)}</p>
          )}
        </div>

        <div>
          <label className="block mb-1 font-medium">Canal de Venta</label>
          <select {...register("canal_id")} className="border p-2 rounded w-full">
            <option value="">Selecciona Canal</option>
            {canales.length > 0 ? (
              canales.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))
            ) : (
              <option value="" disabled>No hay canales disponibles</option>
            )}
          </select>
          {errors.canal_id?.message && (
            <p className="text-red-500 text-sm">{String(errors.canal_id.message)}</p>
          )}
        </div>

        <div>
          <label htmlFor="sku" className="block mb-1 font-medium">SKU</label>
          <input id="sku" {...register("sku")} className="border rounded p-2 w-full" />
          {errors.sku?.message && (
            <p className="text-red-500 text-sm">{String(errors.sku.message)}</p>
          )}
        </div>

        <div>
          <label htmlFor="producto" className="block mb-1 font-medium">Producto</label>
          <input id="producto" {...register("producto")} className="border rounded p-2 w-full" />
          {errors.producto?.message && (
            <p className="text-red-500 text-sm">{String(errors.producto.message)}</p>
          )}
        </div>

        <div>
          <label htmlFor="cantidad" className="block mb-1 font-medium">Cantidad</label>
          <input id="cantidad" type="number" {...register("cantidad")} className="border rounded p-2 w-full" />
          {errors.cantidad?.message && (
            <p className="text-red-500 text-sm">{String(errors.cantidad.message)}</p>
          )}
        </div>

        <div>
          <label htmlFor="precio" className="block mb-1 font-medium">Precio</label>
          <input id="precio" type="number" {...register("precio")} className="border rounded p-2 w-full" />
          {errors.precio?.message && (
            <p className="text-red-500 text-sm">{String(errors.precio.message)}</p>
          )}
        </div>

        <div>
          <label htmlFor="flete" className="block mb-1 font-medium">Flete</label>
          <input id="flete" type="number" {...register("flete")} className="border rounded p-2 w-full" />
          {errors.flete?.message && (
            <p className="text-red-500 text-sm">{String(errors.flete.message)}</p>
          )}
        </div>

        <h2 className="text-lg font-semibold mt-4">Datos del Cliente</h2>
        <div>
          <label htmlFor="cliente.nombre" className="block mb-1 font-medium">Nombre Cliente</label>
          <input id="cliente.nombre" {...register("cliente.nombre")} className="border rounded p-2 w-full" />
          {errors.cliente?.nombre?.message && (
            <p className="text-red-500 text-sm">{String(errors.cliente.nombre.message)}</p>
          )}
        </div>

        {/* Productos adicionales */}
        <h2 className="text-lg font-semibold mt-6">Productos adicionales</h2>
        <div className="space-y-4 mt-2">
          {extraItems.map((it, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end border p-3 rounded">
              <div>
                <label className="block mb-1 font-medium">SKU</label>
                <input
                  value={it.sku}
                  onChange={(e) => updateExtraItem(idx, "sku", e.target.value)}
                  className="border rounded p-2 w-full"
                  placeholder="SKU"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Producto</label>
                <input
                  value={it.producto}
                  onChange={(e) => updateExtraItem(idx, "producto", e.target.value)}
                  className="border rounded p-2 w-full"
                  placeholder="Nombre del producto"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Cantidad</label>
                <input
                  type="number"
                  value={it.cantidad}
                  onChange={(e) => updateExtraItem(idx, "cantidad", e.target.value)}
                  className="border rounded p-2 w-full"
                  min={1}
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Precio</label>
                <input
                  type="number"
                  value={it.precio}
                  onChange={(e) => updateExtraItem(idx, "precio", e.target.value)}
                  className="border rounded p-2 w-full"
                  min={0}
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Flete</label>
                <input
                  type="number"
                  value={it.flete}
                  onChange={(e) => updateExtraItem(idx, "flete", e.target.value)}
                  className="border rounded p-2 w-full"
                  min={0}
                />
              </div>

              <div className="md:col-span-5 flex justify-end">
                <Button type="button" variant="destructive" onClick={() => removeExtraItem(idx)}>
                  Quitar
                </Button>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addExtraItem}>
            Agregar otro producto
          </Button>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={guardando}>
            {guardando ? "Guardando..." : "Crear Orden"}
          </Button>
        </div>
      </form>
    </div>
  );
}