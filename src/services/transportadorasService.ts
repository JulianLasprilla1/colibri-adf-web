import { supabase } from "@/lib/supabase";

export interface Transportadora {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceResponse<T=unknown> {
  success?: boolean;
  error?: string;
  data?: T;
  message?: string;
}

class TransportadorasService {
  async listar(): Promise<ServiceResponse<Transportadora[]>> {
    try {
      const { data, error } = await supabase
        .from("transportadoras")
        .select("id,nombre,activo,created_at,updated_at")
        .eq("activo", true)
        .order("nombre");
      if (error) return { error: error.message };
      return { success: true, data: data || [] };
    } catch (e: any) {
      return { error: e.message || "Error al listar transportadoras" };
    }
  }

  async listarTodo(): Promise<ServiceResponse<Transportadora[]>> {
    try {
      const { data, error } = await supabase
        .from("transportadoras")
        .select("id,nombre,activo,created_at,updated_at")
        .order("nombre");
      if (error) return { error: error.message };
      return { success: true, data: data || [] };
    } catch (e: any) {
      return { error: e.message || "Error al listar transportadoras" };
    }
  }

  async crear(nombre: string): Promise<ServiceResponse<Transportadora>> {
    try {
      const clean = nombre.trim();
      if (!clean) return { error: "Nombre requerido" };
      const { data, error } = await supabase
        .from("transportadoras")
        .insert({ nombre: clean, activo: true })
        .select("id,nombre,activo,created_at,updated_at")
        .single();
      if (error) return { error: error.message };
      return { success: true, data };
    } catch (e: any) {
      return { error: e.message || "Error al crear transportadora" };
    }
  }
}

export const transportadorasService = new TransportadorasService();
