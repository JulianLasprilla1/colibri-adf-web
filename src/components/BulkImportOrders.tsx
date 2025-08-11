"use client";
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Canal = { id: string; nombre: string };
type ParsedItemRow = {
  codigo_orden: string; // obligatorio
  sku: string;          // obligatorio
  producto: string;     // opcional -> fallback sku
  cantidad: number;     // obligatorio (>0)
  precio?: number | null;
  flete?: number | null;
  cliente_nombre?: string;
  cliente_documento?: string;
  cliente_celular?: string;
  cliente_departamento?: string;
  cliente_correo?: string;
  cliente_direccion?: string;
};

interface BulkImportOrdersProps {
  open: boolean;
  onClose: () => void;
  canales: Canal[];
  canalDefault?: string | null;
  existingCodes: Set<string>;
  onImported: () => void; // refresh callback
}

// Columnas ajustadas: solo campos disponibles en creación individual actual (sin ciudad, observaciones ni guía todavía).
// Orden: datos orden + item + cliente.
const TEMPLATE_COLS = [
  'codigo_orden',
  'sku',
  'producto',
  'cantidad',
  'precio',
  'flete',
  'cliente_nombre',
  'cliente_documento',
  'cliente_celular',
  'cliente_departamento',
  'cliente_correo',
  'cliente_direccion'
];

// CSV fallback generator (legacy support)
function generateCSVTemplate(): string {
  const header = TEMPLATE_COLS.join(';');
  const example = [
    'ORD-1001','SKU-A1','Producto A','2','15000','5000','Juan Pérez','123456789','3001234567','Cundinamarca','juan@example.com','Calle 1 # 2-3'
  ].join(';');
  const example2 = [
    'ORD-1001','SKU-B1','Producto B','1','20000','','','','','','',''
  ].join(';');
  const example3 = [
    'ORD-1002','SKU-C1','Producto C','5','12000','8000','María Ruiz','987654321','3109876543','Antioquia','maria@example.com','Cra 10 # 5-7'
  ].join(';');
  return header + '\n' + example + '\n' + example2 + '\n' + example3 + '\n';
}

function hashString(str: string) {
  let h = 0, i, chr; if (str.length === 0) return h.toString();
  for (i = 0; i < str.length; i++) { chr = str.charCodeAt(i); h = ((h << 5) - h) + chr; h |= 0; }
  return h.toString();
}

const BulkImportOrders: React.FC<BulkImportOrdersProps> = ({ open, onClose, canales, canalDefault, existingCodes, onImported }) => {
  const [canalId, setCanalId] = useState<string | null>(canalDefault || null);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileHash, setFileHash] = useState<string | null>(null);
  const lastHashRef = useRef<string | null>(null);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const close = () => { if (!submitting) onClose(); };

  const downloadTemplate = async () => {
    // Prefer Excel .xlsx as requested; keep CSV fallback (Shift+Click).
    const useCSV = (window.event instanceof MouseEvent) && (window.event as MouseEvent).shiftKey; // hidden power-user fallback
    // Obtener email usuario para nombrar archivo
    let userEmail = 'anon';
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.email) userEmail = userData.user.email;
    } catch {}
    const safeEmail = userEmail.replace(/[^a-zA-Z0-9_.-]/g,'_');
    const now = new Date();
    const tzNow = new Intl.DateTimeFormat('sv-SE',{ timeZone:'America/Bogota', hour12:false, dateStyle:'short', timeStyle:'medium'}).format(now) // e.g. 2025-08-10 13:45:12
      .replace(/\s+/,'_')
      .replace(/[:/]/g,'-');
    const baseName = `plantilla_ordenes_${safeEmail}_${tzNow}`;
    if (useCSV) {
      const blob = new Blob([generateCSVTemplate()], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = baseName + '.csv'; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('órdenes');
    ws.addRow(TEMPLATE_COLS);
    const samples = [
      ['ORD-1001','SKU-A1','Producto A',2,15000,5000,'Juan Pérez','123456789','3001234567','Cundinamarca','juan@example.com','Calle 1 # 2-3'],
      ['ORD-1001','SKU-B1','Producto B',1,20000,'','','','','','',''],
      ['ORD-1002','SKU-C1','Producto C',5,12000,8000,'María Ruiz','987654321','3109876543','Antioquia','maria@example.com','Cra 10 # 5-7']
    ];
    samples.forEach(r => ws.addRow(r));
    // Basic styling
    ws.getRow(1).font = { bold: true, size: 11 };
    ws.columns?.forEach(col => { if (col) { col.width = Math.max(12, (col.header?.toString().length||10)+2); }});
    // Marcar obligatorios
  ['A1','B1','D1'].forEach(addr => { const c = ws.getCell(addr); c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFEDE7F6'} }; });
    ws.getRow(1).alignment = { vertical:'middle', horizontal:'center'};
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = baseName + '.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = useCallback((text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!lines.length) { return { rows: [], error: 'Archivo vacío' }; }
    const headerParts = lines[0].split(';').map(h => h.trim());
    if (headerParts.join(',') !== TEMPLATE_COLS.join(',')) {
      return { rows: [], error: 'Encabezados inválidos. Use la plantilla oficial.' };
    }
    const rows: ParsedItemRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const parts = line.split(';');
      while (parts.length < TEMPLATE_COLS.length) parts.push('');
  const [codigo_orden, sku, productoRaw, cantidad, precio, flete, cliente_nombre, cliente_documento, cliente_celular, cliente_departamento, cliente_correo, cliente_direccion] = parts.map(p => p.trim());
      if (!codigo_orden) return { rows: [], error: `Línea ${i+1}: codigo_orden vacío` };
      if (!sku) return { rows: [], error: `Línea ${i+1}: sku vacío` };
      const producto = productoRaw || sku; // fallback
      const cantNum = cantidad ? Number(cantidad) : 0;
      if (isNaN(cantNum) || cantNum <= 0) return { rows: [], error: `Línea ${i+1}: cantidad inválida` };
      const precioNum = precio ? Number(precio) : null;
      const fleteNum = flete ? Number(flete) : null;
      if (precio && (isNaN(Number(precio)) || Number(precio) < 0)) return { rows: [], error: `Línea ${i+1}: precio inválido` };
      if (flete && (isNaN(Number(flete)) || Number(flete) < 0)) return { rows: [], error: `Línea ${i+1}: flete inválido` };
  rows.push({ codigo_orden, sku, producto, cantidad: cantNum, precio: precioNum, flete: fleteNum, cliente_nombre, cliente_documento, cliente_celular, cliente_departamento, cliente_correo, cliente_direccion });
    }
    return { rows, error: null };
  }, []);

  const parseExcelFile = async (file: File) => {
    setLoading(true); setParsingError(null); setParsedRows([]); setFileName(file.name);
    try {
      const ExcelJS = await import('exceljs');
      const arrayBuffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(arrayBuffer);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('Hoja no encontrada');
      const headerRow = ws.getRow(1).values as any[]; // first element is undefined
      const header = headerRow.slice(1).map(v => (v||'').toString().trim());
      if (header.join(',') !== TEMPLATE_COLS.join(',')) {
        throw new Error('Encabezados inválidos. Use la plantilla oficial.');
      }
      const rows: ParsedItemRow[] = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const rowVals = ws.getRow(r).values as any[];
        const cells = rowVals.slice(1).map(v => (v===undefined || v===null) ? '' : v.toString().trim());
        if (cells.every(c => c === '')) continue; // skip empty
        while (cells.length < TEMPLATE_COLS.length) cells.push('');
  const [codigo_orden, sku, productoRaw, cantidad, precio, flete, cliente_nombre, cliente_documento, cliente_celular, cliente_departamento, cliente_correo, cliente_direccion] = cells;
  if (!codigo_orden) { setParsingError(`Fila ${r}: codigo_orden vacío`); return; }
  if (!sku) { setParsingError(`Fila ${r}: sku vacío`); return; }
  const producto = productoRaw || sku;
        const cantNum = cantidad ? Number(cantidad) : 0;
        if (isNaN(cantNum) || cantNum <= 0) { setParsingError(`Fila ${r}: cantidad inválida`); return; }
        const precioNum = precio ? Number(precio) : null;
        const fleteNum = flete ? Number(flete) : null;
        if (precio && (isNaN(Number(precio)) || Number(precio) < 0)) { setParsingError(`Fila ${r}: precio inválido`); return; }
        if (flete && (isNaN(Number(flete)) || Number(flete) < 0)) { setParsingError(`Fila ${r}: flete inválido`); return; }
  rows.push({ codigo_orden, sku, producto, cantidad: cantNum, precio: precioNum, flete: fleteNum, cliente_nombre, cliente_documento, cliente_celular, cliente_departamento, cliente_correo, cliente_direccion });
      }
      const h = hashString(JSON.stringify(rows));
      setFileHash(h);
      if (lastHashRef.current && lastHashRef.current === h) {
        setParsingError('Este archivo ya fue procesado. Modifique el contenido o seleccione otro.');
      } else {
        setParsedRows(rows);
      }
    } catch (err: any) {
      setParsingError(err.message || 'Error procesando Excel');
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (f: File) => {
    const lower = f.name.toLowerCase();
    if (lower.endsWith('.xlsx')) {
      parseExcelFile(f);
      return;
    }
    // CSV legacy path
    setLoading(true); setParsingError(null); setParsedRows([]); setFileName(f.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      const h = hashString(text);
      setRawText(text); setFileHash(h);
      if (lastHashRef.current && lastHashRef.current === h) {
        setParsingError('Este archivo ya fue procesado. Modifique el contenido o seleccione otro.');
        setLoading(false);
        return;
      }
      const { rows, error } = parseCSV(text);
      if (error) setParsingError(error); else setParsedRows(rows);
      setLoading(false);
    };
    reader.onerror = () => { setParsingError('Error leyendo el archivo'); setLoading(false); };
    reader.readAsText(f, 'utf-8');
  };

  const grouped = useMemo(() => {
    const map = new Map<string, ParsedItemRow[]>();
    parsedRows.forEach(r => { if (!map.has(r.codigo_orden)) map.set(r.codigo_orden, []); map.get(r.codigo_orden)!.push(r); });
    return Array.from(map.entries()).map(([codigo, items]) => ({ codigo, items }));
  }, [parsedRows]);

  const duplicateCodes = useMemo(() => new Set(grouped.filter(g => existingCodes.has(g.codigo)).map(g => g.codigo)), [grouped, existingCodes]);
  // Duplicados de SKU dentro de la misma orden
  const ordersWithSkuDup = useMemo(() => {
    const map = new Set<string>();
    const byOrder: Record<string, Record<string, number>> = {};
    parsedRows.forEach(r => {
      byOrder[r.codigo_orden] = byOrder[r.codigo_orden] || {};
      byOrder[r.codigo_orden][r.sku] = (byOrder[r.codigo_orden][r.sku] || 0) + 1;
    });
    Object.entries(byOrder).forEach(([codigo, skuCounts]) => {
      if (Object.values(skuCounts).some(v => v > 1)) map.add(codigo);
    });
    return map;
  }, [parsedRows]);

  const validGroupCount = grouped.filter(g => !duplicateCodes.has(g.codigo)).length;

  const confirmDisabled = !canalId || !parsedRows.length || !!parsingError || validGroupCount === 0 || submitting || ordersWithSkuDup.size>0;

  const submit = async () => {
    if (confirmDisabled) return;
    setSubmitting(true);
    try {
      let creadas = 0;
      let duplicadas = 0;
      let conSkuRepetido = 0;
      for (const group of grouped) {
        if (duplicateCodes.has(group.codigo)) continue; // saltar existentes
        if (ordersWithSkuDup.has(group.codigo)) { conSkuRepetido++; continue; }
  const first = group.items[0];
        // 1. Insert orden base
        const { data: ordenInsert, error: ordenErr } = await supabase.from('ordenes').insert({
          canal_id: canalId,
          codigo_orden: group.codigo,
          estado: 'nueva orden'
        }).select('id').single();
        if (ordenErr) { setParsingError('Error insertando orden '+group.codigo+': '+ordenErr.message); break; }
        const ordenId = ordenInsert?.id;
        // 2. Cliente (solo una vez)
  if (ordenId && (first.cliente_nombre || first.cliente_documento || first.cliente_celular)) {
          const { error: cliErr } = await supabase.from('orden_clientes').insert({
            orden_id: ordenId,
            nombre: first.cliente_nombre || null,
            documento: first.cliente_documento || null,
            departamento: first.cliente_departamento || null,
            correo: first.cliente_correo || null,
            celular: first.cliente_celular || null,
            direccion: first.cliente_direccion || null
          });
          if (cliErr) { setParsingError('Error cliente en '+group.codigo+': '+cliErr.message); break; }
        }
        // 3. Items
        if (ordenId) {
          const itemsPayload = group.items.map(it => ({
            orden_id: ordenId,
            sku: it.sku,
            producto: it.producto,
            cantidad: it.cantidad,
            precio: it.precio ?? 0,
            flete: it.flete ?? 0
          }));
          if (itemsPayload.length) {
            const { error: itemsErr } = await supabase.from('orden_items').insert(itemsPayload);
            if (itemsErr) { setParsingError('Error items en '+group.codigo+': '+itemsErr.message); break; }
          }
          // 4. Observaciones (si existe una tabla para logs podríamos crear entry; aquí ignoramos o podríamos tener columna en ordenes si aplica)
        }
        creadas++;
      }
      lastHashRef.current = fileHash;
      onImported();
      if (!parsingError) {
        const partes: string[] = [];
        partes.push(`${creadas} creadas`);
        if (duplicateCodes.size) partes.push(`${duplicateCodes.size} duplicadas`);
        if (ordersWithSkuDup.size) partes.push(`${ordersWithSkuDup.size} con SKU repetido`);
        toast.success(`Importación completada: ${partes.join(', ')}`);
      }
      onClose();
    } catch (e: any) {
      setParsingError(e.message || 'Error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 md:p-10 bg-black/30 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-lg ring-1 ring-gray-200 flex flex-col max-h-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-gray-800">Importar Órdenes Masivas</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => { downloadTemplate(); }} className="text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#353455] text-white hover:bg-[#2b2a41] active:scale-95 transition" title="Shift+Click para CSV">Descargar plantilla</button>
            <button onClick={close} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 active:scale-95" aria-label="Cerrar">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto space-y-6">
          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-4 md:col-span-1">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Canal</label>
                <select value={canalId || ''} onChange={e=>setCanalId(e.target.value||null)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a489dd]/40">
                  <option value="">Seleccionar…</option>
                  {canales.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Archivo Excel (.xlsx) o CSV</label>
                <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv" onChange={e => { const f=e.target.files?.[0]; if (f) handleFile(f); }} className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-[#a489dd] file:text-white hover:file:bg-[#8f74d6] cursor-pointer" />
                {fileName && <p className="text-[10px] text-gray-500">{fileName}</p>}
              </div>
              {parsingError && <div className="text-[11px] font-medium text-rose-600 bg-rose-50/70 border border-rose-200 rounded-md p-2">{parsingError}</div>}
              {!parsingError && parsedRows.length>0 && (
                <div className="text-[11px] space-y-1">
                  <p><span className="font-semibold text-gray-700">Órdenes detectadas:</span> {grouped.length}</p>
                  <p><span className="font-semibold text-gray-700">Nuevas:</span> {validGroupCount} {duplicateCodes.size>0 && (<span className="text-amber-600 ml-1">({duplicateCodes.size} duplicadas)</span>)}</p>
                  <p><span className="font-semibold text-gray-700">Items totales:</span> {parsedRows.length}</p>
                </div>
              )}
            </div>
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-wide text-gray-600 uppercase">Previsualización</h3>
                {loading && <span className="text-[11px] text-gray-500">Procesando…</span>}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm max-h-[360px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Código</th>
                      <th className="px-3 py-2 text-left font-medium">Cliente</th>
                      <th className="px-3 py-2 text-left font-medium">Items</th>
                      <th className="px-3 py-2 text-left font-medium">Total Est.</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {grouped.map(g => {
                      const first = g.items[0];
                      const total = g.items.reduce((acc,it)=>acc + (it.precio||0)*(it.cantidad||0) + (it.flete||0),0);
                      const duplicate = duplicateCodes.has(g.codigo);
                      const skuDup = ordersWithSkuDup.has(g.codigo);
                      return (
                        <tr key={g.codigo} className={(duplicate || skuDup) ? 'opacity-60' : ''}>
                          <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{g.codigo}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate" title={first.cliente_nombre}>{first.cliente_nombre||'—'}</td>
                          <td className="px-3 py-2 text-gray-700">{g.items.length}</td>
                          <td className="px-3 py-2 text-gray-700">${total}</td>
                          <td className="px-3 py-2">
                            {duplicate ? (
                              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 px-2 py-0.5 text-[10px] font-medium">Duplicada</span>
                            ) : skuDup ? (
                              <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 px-2 py-0.5 text-[10px] font-medium" title="SKU repetido dentro de la orden">SKU repetido</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 px-2 py-0.5 text-[10px] font-medium">Nueva</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!grouped.length && !loading && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500 text-xs">Cargue un archivo para ver la previsualización.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">Notas: Campos obligatorios: <span className="font-semibold">codigo_orden</span>, <span className="font-semibold">sku</span>, <span className="font-semibold">cantidad</span>. El resto son opcionales y se toman de la primera fila de cada código para crear el cliente. Use una fila por item. Si <em>producto</em> está vacío se usa el <em>sku</em>. No se permite repetir el mismo sku dentro de la misma orden. Códigos ya existentes se ignoran. El nombre del archivo incluye su correo y la hora (Bogotá).</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between gap-4 bg-gray-50/60">
          <div className="text-[11px] text-gray-500">
            {confirmDisabled ? (ordersWithSkuDup.size>0 ? 'Corrija SKUs repetidos en una misma orden.' : 'Complete los datos para continuar.') : `${validGroupCount} órdenes listas para crear.`}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={close} className="text-[11px] font-medium px-3 py-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 active:scale-95 transition">Cancelar</button>
            <button disabled={confirmDisabled} onClick={submit} className={`text-[11px] font-semibold px-4 py-2 rounded-md text-white transition active:scale-95 ${confirmDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#353455] hover:bg-[#2b2a41]'}`}>
              {submitting ? 'Creando...' : 'Confirmar Importación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkImportOrders;
