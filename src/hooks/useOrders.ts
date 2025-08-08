import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ordersService } from "@/services/ordersService";

// Definición del tipo Orden
export interface Orden {
  id: string;
  codigo_orden: string;
  canal_id: string;
  estado: string;
  cliente_nombre?: string;
  cliente_documento?: string;
  cliente_ciudad?: string;
  cliente_departamento?: string;
  cliente_correo?: string;
  cliente_celular?: string;
  item_id?: string;
  sku?: string;
  producto?: string;
  cantidad?: number;
  precio?: number;
  flete?: number;
  created_at: string;
  updated_at: string;
}

export interface OrdenAgrupada {
  id: string;
  codigo_orden: string;
  canal_id: string;
  estado: string;
  cliente_nombre?: string;
  cliente_documento?: string;
  cliente_ciudad?: string;
  cliente_departamento?: string;
  cliente_correo?: string;
  cliente_celular?: string;
  created_at: string;
  updated_at: string;
  items: {
    id?: string;
    sku?: string;
    producto?: string;
    cantidad?: number;
    precio?: number;
    flete?: number;
  }[];
}

export function useOrders(refreshTrigger = 0) {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [ordenesAgrupadas, setOrdenesAgrupadas] = useState<OrdenAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const agruparOrdenes = (data: Orden[]) => {
    const ordenesPorId: Record<string, OrdenAgrupada> = {};
    
    data.forEach(orden => {
      // Si no existe la orden, la creamos con un array de items vacío
      if (!ordenesPorId[orden.id]) {
        ordenesPorId[orden.id] = {
          id: orden.id,
          codigo_orden: orden.codigo_orden,
          canal_id: orden.canal_id,
          estado: orden.estado,
          cliente_nombre: orden.cliente_nombre,
          cliente_documento: orden.cliente_documento,
          cliente_ciudad: orden.cliente_ciudad,
          cliente_departamento: orden.cliente_departamento,
          cliente_correo: orden.cliente_correo,
          cliente_celular: orden.cliente_celular,
          created_at: orden.created_at,
          updated_at: orden.updated_at,
          items: []
        };
      }
      
      // Si tiene SKU, añadimos el item al array de items de la orden
      if (orden.sku) {
        ordenesPorId[orden.id].items.push({
          id: orden.item_id,
          sku: orden.sku,
          producto: orden.producto,
          cantidad: orden.cantidad,
          precio: orden.precio,
          flete: orden.flete
        });
      }
    });
    
    // Convertir el objeto a un array
    return Object.values(ordenesPorId);
  };

  const fetchOrdenes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log("Obteniendo órdenes...");
      const data = await ordersService.getAll();
      
      if (Array.isArray(data)) {
        console.log(`Órdenes recibidas: ${data.length}`);
        setOrdenes(data);
        
        // Agrupar órdenes para evitar duplicados
        const agrupadas = agruparOrdenes(data);
        console.log(`Órdenes agrupadas: ${agrupadas.length}`);
        setOrdenesAgrupadas(agrupadas);
      } else {
        console.error("Los datos recibidos no son un array:", data);
        setOrdenes([]);
        setOrdenesAgrupadas([]);
        setError("Formato de datos incorrecto");
      }
    } catch (err) {
      console.error("Error al obtener órdenes:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
      setOrdenes([]);
      setOrdenesAgrupadas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdenes();
    
    // Configurar suscripción para detectar cambios
    const channel = supabase
      .channel('ordenes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, () => {
        console.log("Cambio detectado en tabla ordenes, actualizando datos...");
        fetchOrdenes();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orden_items' }, () => {
        console.log("Cambio detectado en tabla orden_items, actualizando datos...");
        fetchOrdenes();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orden_clientes' }, () => {
        console.log("Cambio detectado en tabla orden_clientes, actualizando datos...");
        fetchOrdenes();
      })
      .subscribe();
    
    // Limpiar suscripción al desmontar
    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Dependencias vacías para que solo se ejecute una vez al montar

  // Añade este efecto dedicado para el refreshTrigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log("Forzando recarga por cambio de refreshTrigger:", refreshTrigger);
      fetchOrdenes();
    }
  }, [refreshTrigger]);

  return { ordenes, ordenesAgrupadas, loading, error, fetchOrdenes };
}

// ✅ Si necesitas usar el tipo Orden en otros archivos:
// import { useOrders } from "@/hooks/useOrders";
// import type { Orden } from "@/services/ordersService";

// Ejemplo en tu hook useOrders
const { data, error } = await supabase.from("ordenes_vista").select("*");
