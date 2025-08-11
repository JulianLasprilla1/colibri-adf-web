import { supabase } from "@/lib/supabase";
import { Orden } from "@/hooks/useOrders";

export interface ServiceResponse<T = unknown> {
  error?: string | null;
  success?: boolean;
  data?: T;
  message?: string;
}

export interface Cliente {
  nombre: string;
  documento?: string;
  ciudad?: string;
  departamento?: string;
  correo?: string;
  celular?: string;
  direccion?: string;
}

export interface OrdenItem {
  sku: string;
  producto: string;
  cantidad: number;
  precio: number;
  flete: number;
}

export interface RpcResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

export interface Canal {
  id: string;
  nombre: string;
}

// Estados oficiales de la app (sin legacy en proceso de eliminación)
// Default inicial: 'nueva orden' (antes de entrar al flujo operativo)
export type EstadoOrden =
  | 'nueva orden'
  | 'por alistar'
  | 'por empacar'
  | 'por despachar'
  | 'por facturar'
  | 'cancelada'
  | 'eliminada'
  | 'restaurada';

class OrdersService {
  // Helper para hora Bogotá (solo para logging, la BD sigue guardando UTC)
  private nowBogota() {
    return new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  }

  // Helper para calcular diffs simples entre objetos planos
  private diffObjects(oldObj: Record<string, any>, newObj: Record<string, any>) {
    const cambios: Record<string, [any, any]> = {};
    const keys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
    keys.forEach(k => {
      const before = oldObj?.[k];
      const after = newObj?.[k];
      const bothNullish = (before === null || typeof before === 'undefined') && (after === null || typeof after === 'undefined');
      if (bothNullish) return;
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        cambios[k] = [before, after];
      }
    });
    return cambios;
  }

  // Helper para diferenciar arrays de items
  private diffItems(oldItems: any[], newItems: any[]) {
    const byKey = (it: any) => `${it.sku || ''}__${it.producto || ''}`;
    const oldMap = new Map((oldItems || []).map(i => [byKey(i), i]));
    const newMap = new Map((newItems || []).map(i => [byKey(i), i]));
    const added: any[] = [];
    const removed: any[] = [];
    const modified: any[] = [];
    newMap.forEach((val, key) => {
      if (!oldMap.has(key)) added.push(val);
      else {
        const before = oldMap.get(key)!;
        if (JSON.stringify({ ...before, id: undefined }) !== JSON.stringify({ ...val, id: undefined })) {
          modified.push({ antes: before, despues: val });
        }
      }
    });
    oldMap.forEach((val, key) => { if (!newMap.has(key)) removed.push(val); });
    return { added, removed, modified };
  }
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

  // ✅ Crear una orden completa (sin RPC) realizando inserts directos
  async crearOrdenCompleta(data: {
    canal_id: string;
    codigo_orden: string;
    cliente: Cliente;
    items: OrdenItem[];
    guia_numero?: string | null;
    transportadora_id?: string | null;
  }, usuario?: string | null): Promise<ServiceResponse<{ orden_id: string; items?: any[]; payload?: unknown }>> {
    try {
      const { canal_id, codigo_orden, cliente, items, guia_numero, transportadora_id } = data;
      if (!canal_id) return { error: 'canal_id requerido' };
      if (!codigo_orden) return { error: 'codigo_orden requerido' };
      // 1. Insert orden
      const { data: ordenInsert, error: errOrden } = await supabase
        .from('ordenes')
        .insert({
          canal_id,
          codigo_orden,
          estado: 'nueva orden',
          guia_numero: guia_numero ?? null,
          transportadora_id: transportadora_id ?? null,
          usuario_creacion: usuario || 'sistema',
          usuario_actualizacion: usuario || 'sistema'
        })
        .select('id')
        .single();
      if (errOrden) return { error: errOrden.message };
      const orden_id = ordenInsert.id as string;

      // 2. Insert cliente
  if (cliente?.nombre) {
        const { error: errCliente } = await supabase
          .from('orden_clientes')
          .insert({
            orden_id,
            nombre: cliente.nombre,
            documento: cliente.documento || null,
            ciudad: cliente.ciudad || null,
            departamento: cliente.departamento || null,
            correo: cliente.correo || null,
    celular: cliente.celular || null,
    direccion: cliente.direccion || null
          });
        if (errCliente) return { error: errCliente.message };
      }

      // 3. Insert items
      let insertedItems: any[] = [];
      if (Array.isArray(items) && items.length > 0) {
        const itemsRows = items
          .filter(it => (it?.producto || '').trim() !== '')
          .map(it => ({
            orden_id,
            sku: it.sku || null,
            producto: it.producto,
            cantidad: it.cantidad ?? 0,
            precio: it.precio ?? 0,
            flete: it.flete ?? 0
          }));
        if (itemsRows.length > 0) {
          const { data: inserted, error: errItems } = await supabase
            .from('orden_items')
            .insert(itemsRows)
            .select('*');
          if (errItems) return { error: errItems.message };
          insertedItems = inserted || [];
        }
      }

      // 4. Log con snapshot inicial
      await supabase.from('orden_logs').insert({
        orden_id,
        accion: 'creada',
        usuario: usuario || 'sistema',
        detalles: {
          hora_bogota: this.nowBogota(),
          despues: {
            orden: { canal_id, codigo_orden, estado: 'nueva orden', guia_numero: guia_numero ?? null, transportadora_id: transportadora_id ?? null },
            cliente,
            items: insertedItems
          }
        }
      });

  return { success: true, data: { orden_id, items: insertedItems, payload: data }, message: 'Orden creada' };
    } catch (error) {
      console.error('Error en crearOrdenCompleta:', error);
      return { error: (error as Error).message || 'Error al crear la orden' };
    }
  }



  // ✅ Actualizar una orden completa usando el procedimiento almacenado
  async actualizarOrdenCompleta(data: {
    p_canal_id: string;
    p_cliente: Cliente;
    p_codigo_orden: string;
    p_estado: string;
    p_items: OrdenItem[];
    p_orden_id: string;
    p_guia_numero?: string | null;
    p_transportadora_id?: string | null; // cambiado de p_transportadora
    p_cambios?: Record<string, unknown>; // opcional si se implementa en SQL
  }, usuario?: string | null): Promise<ServiceResponse<RpcResult>> {
    try {
  console.log("[actualizarOrdenCompleta] payload recibido:", JSON.stringify(data));

      const {
        p_orden_id,
        p_canal_id,
        p_cliente,
        p_codigo_orden,
        p_estado,
        p_items,
        p_guia_numero,
        p_transportadora_id
      } = data;

      if (!p_orden_id) return { error: "ID de orden no proporcionado" };

      // 1. Cargar estado anterior (orden + cliente + items)
      const { data: ordenAntes, error: errOrdenAntes } = await supabase
        .from('ordenes')
        .select('*')
        .eq('id', p_orden_id)
        .single();
      if (errOrdenAntes || !ordenAntes) return { error: 'La orden no existe' };
      const { data: clienteAntes } = await supabase
        .from('orden_clientes')
        .select('*')
        .eq('orden_id', p_orden_id)
        .maybeSingle();
      const { data: itemsAntes } = await supabase
        .from('orden_items')
        .select('*')
        .eq('orden_id', p_orden_id);

      // 2. Actualizar cabecera
      const { error: errUpd } = await supabase
        .from('ordenes')
        .update({
          canal_id: p_canal_id,
          codigo_orden: p_codigo_orden,
          estado: p_estado,
          guia_numero: p_guia_numero ?? null,
          transportadora_id: p_transportadora_id ?? null,
          usuario_actualizacion: usuario || 'sistema',
          updated_at: new Date().toISOString()
        })
        .eq('id', p_orden_id);
      if (errUpd) {
        // Código de violación de unicidad 23505
        // @ts-ignore (Supabase error puede traer code)
        if (errUpd.code === '23505') {
          return { error: 'Código de orden ya existe para ese canal' };
        }
        return { error: errUpd.message };
      }

      // 3. Upsert cliente
      const clienteRow = {
        orden_id: p_orden_id,
        nombre: p_cliente?.nombre,
        documento: p_cliente?.documento || null,
        ciudad: p_cliente?.ciudad || null,
        departamento: p_cliente?.departamento || null,
        correo: p_cliente?.correo || null,
        celular: p_cliente?.celular || null,
  direccion: p_cliente?.direccion || null,
        updated_at: new Date().toISOString()
      };
      const { error: errCliente } = await supabase
        .from('orden_clientes')
        .upsert(clienteRow, { onConflict: 'orden_id' });
      if (errCliente) return { error: errCliente.message };

  // 4. Reemplazar items (delete + bulk insert)
      const { error: errDelItems } = await supabase
        .from('orden_items')
        .delete()
        .eq('orden_id', p_orden_id);
      if (errDelItems) return { error: errDelItems.message };

      let insertedItems: any[] = [];
      if (Array.isArray(p_items) && p_items.length > 0) {
        const itemsRows = p_items.map(it => ({
          orden_id: p_orden_id,
          sku: it.sku || null,
          producto: it.producto,
          cantidad: it.cantidad ?? 0,
          precio: it.precio ?? 0,
          flete: it.flete ?? 0
        }));
        const { data: insData, error: errInsItems } = await supabase
          .from('orden_items')
          .insert(itemsRows)
          .select('*');
        if (errInsItems) return { error: errInsItems.message };
        insertedItems = insData || [];
      }

      // 5. Log con diffs
      const ordenDespues = {
        canal_id: p_canal_id,
        codigo_orden: p_codigo_orden,
        estado: p_estado,
        guia_numero: p_guia_numero ?? null,
        transportadora_id: p_transportadora_id ?? null
      };
      const cambiosOrden = this.diffObjects({
        canal_id: ordenAntes.canal_id,
        codigo_orden: ordenAntes.codigo_orden,
        estado: ordenAntes.estado,
        guia_numero: ordenAntes.guia_numero,
        transportadora_id: ordenAntes.transportadora_id
      }, ordenDespues);
      const cambiosCliente = this.diffObjects({
        nombre: clienteAntes?.nombre,
        documento: clienteAntes?.documento,
        ciudad: clienteAntes?.ciudad,
        departamento: clienteAntes?.departamento,
        correo: clienteAntes?.correo,
  celular: clienteAntes?.celular,
  direccion: clienteAntes?.direccion
      }, {
        nombre: p_cliente?.nombre,
        documento: p_cliente?.documento || null,
        ciudad: p_cliente?.ciudad || null,
        departamento: p_cliente?.departamento || null,
        correo: p_cliente?.correo || null,
  celular: p_cliente?.celular || null,
  direccion: p_cliente?.direccion || null
      });
      const difItems = this.diffItems(itemsAntes || [], insertedItems || []);
      await supabase.from('orden_logs').insert({
        orden_id: p_orden_id,
        accion: 'actualizada',
        usuario: usuario || 'sistema',
        detalles: {
          hora_bogota: this.nowBogota(),
            cambios: { orden: cambiosOrden, cliente: cambiosCliente, items: difItems },
            antes: { orden: ordenAntes, cliente: clienteAntes, items: itemsAntes },
            despues: { orden: ordenDespues, cliente: p_cliente, items: insertedItems }
        }
      });

  console.log('[actualizarOrdenCompleta] items resultantes:', insertedItems);
  return { success: true, message: 'Orden actualizada correctamente', data: { success: true, data: insertedItems } };
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error inesperado en actualización:", error);
      return { error: error?.message || "Error inesperado" };
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
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error al eliminar orden:", error);
      return { error: error.message || "Error al eliminar orden" };
    }
  }

  // ✅ Eliminar una orden usando la RPC y respetando el 'success' que devuelve Postgres
  async eliminarOrden(id: string, usuario?: string | null): Promise<ServiceResponse> {
    try {
      if (!id) return { error: "ID de orden no proporcionado" };
      // Cargar estado antes
      const { data: ordenAntes } = await supabase.from('ordenes').select('*').eq('id', id).single();
      const { data: clienteAntes } = await supabase.from('orden_clientes').select('*').eq('orden_id', id).maybeSingle();
      const { data: itemsAntes } = await supabase.from('orden_items').select('*').eq('orden_id', id);
      const { error } = await supabase
        .from('ordenes')
        .update({ estado: 'eliminada', deleted_at: new Date().toISOString(), usuario_actualizacion: usuario || 'sistema' })
        .eq('id', id);
      if (error) return { error: error.message };
      await supabase.from('orden_logs').insert({
        orden_id: id,
        accion: 'soft_delete',
        usuario: usuario || 'sistema',
        detalles: {
          hora_bogota: this.nowBogota(),
          antes: { orden: ordenAntes, cliente: clienteAntes, items: itemsAntes }
        }
      });
      return { success: true, message: 'Orden marcada como eliminada' };
    } catch (err: unknown) {
      const e = err as Error;
      return { error: e.message || 'Error inesperado' };
    }
  }

  // ✅ Restaurar (undo soft delete)
  async restaurarOrden(id: string, usuario?: string | null): Promise<ServiceResponse> {
    try {
      if (!id) return { error: "ID de orden no proporcionado" };
      const { data: ordenAntes } = await supabase.from('ordenes').select('*').eq('id', id).single();
      const { error } = await supabase
        .from('ordenes')
        .update({ estado: 'restaurada', deleted_at: null, usuario_actualizacion: usuario || 'sistema' })
        .eq('id', id);
      if (error) return { error: error.message };
      await supabase.from('orden_logs').insert({
        orden_id: id,
        accion: 'restaurada',
        usuario: usuario || 'sistema',
        detalles: { hora_bogota: this.nowBogota(), antes: ordenAntes }
      });
      return { success: true, message: 'Orden restaurada' };
    } catch (err: unknown) {
      const e = err as Error;
      return { error: e.message || 'Error inesperado' };
    }
  }

  // ✅ Obtener todos los canales
  async getCanales(): Promise<Canal[]> {
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
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error inesperado al eliminar item:", error);
      return { error: error.message || "Error inesperado" };
    }
  }

  // ✅ Obtener logs de una orden
  async getLogs(ordenId: string): Promise<ServiceResponse> {
    try {
      const { data, error } = await supabase
        .from('orden_logs')
        .select('*')
        .eq('orden_id', ordenId)
        .order('fecha', { ascending: false });
      if (error) return { error: error.message };
      return { success: true, data };
    } catch (err: unknown) {
      const e = err as Error;
      return { error: e.message || 'Error obteniendo logs' };
    }
  }

  async eliminarDefinitiva(id: string, usuario?: string | null): Promise<ServiceResponse<RpcResult>> {
    try {
      // Usa el método deleteOrden legacy para hard delete
      const res = await this.deleteOrden(id);
      if (res.error) return { error: res.error };
      return { success: true, message: 'Orden eliminada permanentemente' };
    } catch (err: unknown) {
      const e = err as Error;
      return { error: e.message || 'Error al eliminar definitivamente' };
    }
  }

  // ✅ Actualizar guía y transportadora
  async actualizarEnvio(ordenId: string, guia_numero: string, transportadora: string, usuario?: string | null): Promise<ServiceResponse<RpcResult>> {
    try {
      const { error } = await supabase
        .from('ordenes')
        .update({
          guia_numero: guia_numero || null,
          transportadora_id: transportadora || null,
          usuario_actualizacion: usuario || 'sistema',
          updated_at: new Date().toISOString()
        })
        .eq('id', ordenId);
      if (error) return { error: error.message };
      await supabase.from('orden_logs').insert({
        orden_id: ordenId,
        accion: 'envio_actualizado',
        usuario: usuario || 'sistema',
        detalles: { guia_numero, transportadora }
      });
      return { success: true, data: { success: true, message: 'Envio actualizado' } };
    } catch (err: unknown) {
      const e = err as Error;
      return { error: e.message || 'Error actualizando envío' };
    }
  }
}

export const ordersService = new OrdersService();
