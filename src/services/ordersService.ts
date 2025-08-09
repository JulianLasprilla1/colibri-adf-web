import { supabase } from "@/lib/supabase";
import { Orden } from "@/hooks/useOrders";

export interface ServiceResponse {
  error?: string | null;
  success?: boolean;
  data?: any;
  message?: string;
}

class OrdersService {
  // ✅ Obtener todas las órdenes con manejo de errores y paginación
  async getAll(): Promise<Orden[]> {
    try {
      console.log("Iniciando solicitud getAll...");
      
      const { data, error } = await supabase
        .from("ordenes_vista")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error en getAll:", error);
        throw new Error(`Error al obtener las órdenes: ${error.message}`);
      }
      
      console.log(`Recibidos ${data?.length || 0} registros de ordenes_vista`);
      
      return data || [];
    } catch (err) {
      console.error("Exception en getAll:", err);
      // Retornar array vacío en lugar de re-lanzar la excepción
      // para evitar bloquear la UI
      return [];
    }
  }

  async getById(id: string): Promise<ServiceResponse> {
    try {
      const { data, error } = await supabase
        .from("ordenes_vista")
        .select("*")
        .eq("id", id);

      if (error) throw error;
      
      return { 
        success: true,
        data: data?.[0] || null
      };
    } catch (error) {
      console.error("Error en getById:", error);
      return { error: "Error al obtener la orden" };
    }
  }

  // ✅ Crear una orden completa usando la RPC (con logging detallado)
  async crearOrdenCompleta(data: {
    canal_id: string;
    codigo_orden: string;
    cliente: {
      nombre: string;
      documento?: string;
      ciudad?: string;
      departamento?: string;
      correo?: string;
      celular?: string;
    };
    items: any[];
  }): Promise<ServiceResponse> {
    try {
      const { data: result, error } = await supabase.rpc("crear_orden_completa", {
        canal_id: data.canal_id,
        codigo_orden: data.codigo_orden,
        cliente: data.cliente,
        items: data.items, // ← array JS; la función espera jsonb (array)
      });
      if (error) throw error;
      return { success: true, data: result };
    } catch (error) {
      console.error("Error en crearOrdenCompleta:", error);
      return { error: "Error al crear la orden" };
    }
  }



  // ✅ Actualizar una orden completa usando el procedimiento almacenado
  async actualizarOrdenCompleta(data: {
    p_canal_id: string;
    p_cliente: object;
    p_codigo_orden: string;
    p_estado: string;
    p_items: any[];
    p_orden_id: string;
  }): Promise<ServiceResponse> {
    try {
      console.log("Actualizando orden completa con datos:", JSON.stringify(data));
      
      if (!data.p_orden_id) {
        return { error: "ID de orden no proporcionado" };
      }
      
      // Verificar primero que la orden existe
      const { data: ordenExiste, error: errorCheck } = await supabase
        .from("ordenes")
        .select("id")
        .eq("id", data.p_orden_id)
        .single();
      
      if (errorCheck || !ordenExiste) {
        console.error("Error al verificar orden:", errorCheck);
        return { error: "La orden no existe" };
      }
      
      // Llamar a la función RPC
      const { data: result, error } = await supabase.rpc(
        "actualizar_orden_completa",
        data
      );
      
      if (error) {
        console.error("Error RPC en actualización:", error);
        return { error: error.message };
      }
      
      console.log("Respuesta de actualización:", result);
      
      if (!result || !result.success) {
        const errorMsg = result?.message || "Error desconocido al actualizar";
        console.error("Error en resultado:", errorMsg);
        return { error: errorMsg };
      }
      
      return { 
        success: true,
        message: "Orden actualizada correctamente", 
        data: result 
      };
    } catch (err: any) {
      console.error("Error inesperado en actualización:", err);
      return { error: err?.message || "Error inesperado" };
    }
  }

  // ✅ Eliminar una orden
  async deleteOrden(id: string): Promise<ServiceResponse> {
    try {
      // Primero eliminar dependencias
      await supabase.from("orden_items").delete().eq("orden_id", id);
      await supabase.from("orden_clientes").delete().eq("orden_id", id);
      await supabase.from("orden_logs").delete().eq("orden_id", id);

      // Finalmente eliminar orden
      const { error } = await supabase.from("ordenes").delete().eq("id", id);
      
      if (error) {
        console.error("Error al eliminar orden:", error);
        return { error: error.message };
      }
      
      return { success: true };
    } catch (err: any) {
      console.error("Error al eliminar orden:", err);
      return { error: err.message || "Error al eliminar orden" };
    }
  }

  // ✅ Eliminar una orden usando la RPC y respetando el 'success' que devuelve Postgres
  async eliminarOrden(id: string): Promise<ServiceResponse> {
    try {
      console.log("Eliminando orden con ID:", id);
      if (!id) return { error: "ID de orden no proporcionado" };

      const { data: result, error } = await supabase.rpc("eliminar_orden_completa", {
        p_orden_id: id,
      });

      if (error) {
        console.error("Error en la eliminación de orden:", error);
        return { error: error.message || "Error en RPC eliminar_orden_completa" };
      }

      // La función devuelve jsonb: { success, message, ... }
      const ok = (result as any)?.success === true;
      if (!ok) {
        const msg = (result as any)?.message || "No se pudo eliminar la orden";
        return { error: msg, data: result };
      }

      return { success: true, message: "Orden eliminada correctamente", data: result };
    } catch (err: any) {
      console.error("Error inesperado al eliminar orden:", err);
      return { error: err.message || "Error inesperado" };
    }
  }


  // ✅ Obtener todos los canales
  async getCanales(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("canales_venta")  // Nombre correcto de la tabla
        .select("*")
        .order("nombre");
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error al obtener canales:", error);
      return [];
    }
  }

  // Eliminar un item específico sin eliminar toda la orden
  async eliminarItem(itemId: string): Promise<ServiceResponse> {
    try {
      console.log("Intentando eliminar item con ID:", itemId);
      if (!itemId) return { error: "ID de item no proporcionado" };

      // Verificar existencia y obtener orden_id
      const { data: itemData, error: fetchError } = await supabase
        .from("orden_items")
        .select("orden_id")
        .eq("id", itemId)
        .single();

      if (fetchError || !itemData) {
        console.error("Error al buscar el item:", fetchError);
        return { error: "Item no encontrado" };
      }

      // Eliminar y obtener filas borradas
      const { data: deleted, error } = await supabase
        .from("orden_items")
        .delete()
        .eq("id", itemId)
        .select("id"); // devuelve array con filas borradas

      if (error) return { error: error.message };
      if (!deleted || deleted.length === 0) return { error: "No se eliminó ningún item" };

      return {
        success: true,
        message: "Item eliminado correctamente",
        data: { orden_id: itemData.orden_id },
      };
    } catch (err: any) {
      console.error("Error inesperado al eliminar item:", err);
      return { error: err.message || "Error inesperado" };
    }
  }
}

export const ordersService = new OrdersService();
