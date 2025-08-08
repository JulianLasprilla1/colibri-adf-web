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

export default function NuevaOrdenPage() {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [canales, setCanales] = useState<{ id: string; nombre: string }[]>([]);

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

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema) as Resolver<any>,
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
      // Crear array de items correctamente
      const itemsArray = [
        {
          sku: data.sku || "",
          producto: data.producto || "",
          cantidad: data.cantidad || 1,
          precio: data.precio || 0,
          flete: data.flete || 0
        }
      ];

      const payload = {
        canal_id: data.canal_id,
        codigo_orden: data.codigo_orden,
        cliente: data.cliente,
        items: itemsArray
      };

      console.log("Enviando datos:", payload);
      const result = await ordersService.crearOrdenCompleta(payload);

      if (result?.error) {
        throw new Error(result.error);
      }

      toast.success("Orden creada exitosamente");
      router.push("/ordenes");
    } catch (err) {
      console.error("Error al crear la orden:", err);
      toast.error(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
    } finally {
      setGuardando(false);
    }
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
          <input
            id="sku"
            {...register("sku")}
            className="border rounded p-2 w-full"
          />
          {errors.sku?.message && (
            <p className="text-red-500 text-sm">{String(errors.sku.message)}</p>
          )}
        </div>

        <div>
          <label htmlFor="producto" className="block mb-1 font-medium">Producto</label>
          <input
            id="producto"
            {...register("producto")}
            className="border rounded p-2 w-full"
          />
          {errors.producto?.message && (
            <p className="text-red-500 text-sm">{String(errors.producto.message)}</p>
          )}
        </div>

        <div>
          <label htmlFor="cantidad" className="block mb-1 font-medium">Cantidad</label>
          <input
            id="cantidad"
            type="number"
            {...register("cantidad")}
            className="border rounded p-2 w-full"
          />
          {errors.cantidad?.message && (
            <p className="text-red-500 text-sm">{String(errors.cantidad.message)}</p>
          )}
        </div>

        <div>
          <label htmlFor="precio" className="block mb-1 font-medium">Precio</label>
          <input
            id="precio"
            type="number"
            {...register("precio")}
            className="border rounded p-2 w-full"
          />
          {errors.precio?.message && (
            <p className="text-red-500 text-sm">{String(errors.precio.message)}</p>
          )}
        </div>

        <div>
          <label htmlFor="flete" className="block mb-1 font-medium">Flete</label>
          <input
            id="flete"
            type="number"
            {...register("flete")}
            className="border rounded p-2 w-full"
          />
          {errors.flete?.message && (
            <p className="text-red-500 text-sm">{String(errors.flete.message)}</p>
          )}
        </div>

        <h2 className="text-lg font-semibold mt-4">Datos del Cliente</h2>
        <div>
          <label htmlFor="cliente.nombre" className="block mb-1 font-medium">Nombre Cliente</label>
          <input
            id="cliente.nombre"
            {...register("cliente.nombre")}
            className="border rounded p-2 w-full"
          />
          {errors.cliente && (errors.cliente as any).nombre?.message && (
            <p className="text-red-500 text-sm">{String((errors.cliente as any).nombre.message)}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancelar</Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={guardando}>
            {guardando ? "Guardando..." : "Crear Orden"}
          </Button>
        </div>
      </form>
    </div>
  );
}
