import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatea un timestamp (ISO UTC o texto local) a hora de Bogotá.
// Si viene en formato ISO (contiene 'T') asumimos que es UTC y convertimos.
// Si ya es un string plano 'YYYY-MM-DD HH:MM:SS' lo dejamos igual (ya debería venir local desde la vista).
export function formatBogotaDateTime(value?: string | null): string {
  if (!value) return ''
  try {
    if (value.includes('T')) {
      const d = new Date(value)
      return d.toLocaleString('es-CO', { timeZone: 'America/Bogota' })
    }
    return value // ya formateado por la vista en hora local
  } catch {
    return value || ''
  }
}

export function formatBogotaDate(value?: string | null): string {
  if (!value) return ''
  try {
    if (value.includes('T')) {
      const d = new Date(value)
      return d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
    }
    // value ya sin zona -> devolvemos solo la parte de fecha
    return value.split(' ')[0] || value
  } catch {
    return value || ''
  }
}
