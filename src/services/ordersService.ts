import { supabase } from "@/lib/supabase";
import { Orden } from "@/hooks/useOrders";

export interface ServiceResponse {
  error?: string | null;
  success?: boolean;
  data?: any;
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

  // ✅ Crear una orden completa usando el procedimiento almacenado
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
      // Crear orden principal
      const { data: orden, error: errorOrden } = await supabase
        .from("ordenes")
        .insert({
          canal_id: data.canal_id,
          codigo_orden: data.codigo_orden,
          estado: "nueva orden"
        })
        .select("id")
        .single();

      if (errorOrden) throw errorOrden;

      const ordenId = orden.id;

      // Crear cliente
      const { error: errorCliente } = await supabase
        .from("orden_clientes")
        .insert({
          orden_id: ordenId,
          nombre: data.cliente.nombre,
          documento: data.cliente.documento || "",
          ciudad: data.cliente.ciudad || "",
          departamento: data.cliente.departamento || "",
          correo: data.cliente.correo || "",
          celular: data.cliente.celular || ""
        });

      if (errorCliente) throw errorCliente;

      // Crear items
      const items = data.items.map(item => ({
        orden_id: ordenId,
        sku: item.sku,
        producto: item.producto,
        cantidad: item.cantidad,
        precio: item.precio,
        flete: item.flete
      }));

      const { error: errorItems } = await supabase
        .from("orden_items")
        .insert(items);

      if (errorItems) throw errorItems;

      // Registrar log
      await supabase
        .from("orden_logs")
        .insert({
          orden_id: ordenId,
          accion: "crear",
          fecha: new Date(),
          usuario: "sistema"
        });

      return { success: true, data: { id: ordenId } };
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
      console.log(`Actualizando orden ${data.p_orden_id} con estado ${data.p_estado}`);
      
      // Llamada a la función RPC - eliminar las headers incorrectas
      const { data: result, error } = await supabase.rpc(
        "actualizar_orden_completa", 
        data,
        { 
          // Solo usar propiedades válidas
          count: 'exact'
        }
      );
      
      if (error) {
        console.error("Error RPC:", error);
        return { error: error.message || "Error al actualizar" };
      }
      
      console.log("Resultado de actualización:", result);
      
      return { 
        success: true, 
        data: result
      };
    } catch (err: any) {
      console.error("Error:", err);
      return { error: err?.message || "Error interno" };
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
}

export const ordersService = new OrdersService();
