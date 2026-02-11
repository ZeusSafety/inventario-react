'use client';

import React, { useState } from 'react';
import { useInventory } from '@/context/InventoryContext';
import { apiCall } from '@/lib/api';
import { Archive, Calendar, FileDown } from 'lucide-react';

export default function RegistroPage() {
    const { state, setState } = useInventory();
    const [loading, setLoading] = useState(false);

    const cargarHistorial = React.useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiCall('obtener_historial', 'GET');
            if (response.success && response.inventarios) {
                const callao = response.inventarios
                    .filter((inv: any) => inv.almacen === 'Callao' || !inv.almacen)
                    .map((inv: any) => ({
                        id: inv.id,
                        numero: inv.numero_inventario,
                        registrado: inv.autorizado_por,
                        inicio: inv.fecha_inicio,
                        fin: inv.fecha_fin,
                        pdfUrl: inv.archivo_pdf,
                        tipo: 'cajas',
                        filas: []
                    }));

                const malvinas = response.inventarios
                    .filter((inv: any) => inv.almacen === 'Malvinas')
                    .map((inv: any) => ({
                        id: inv.id,
                        numero: inv.numero_inventario,
                        registrado: inv.autorizado_por,
                        inicio: inv.fecha_inicio,
                        fin: inv.fecha_fin,
                        pdfUrl: inv.archivo_pdf,
                        tipo: 'cajas',
                        tienda: inv.tienda || '-',
                        filas: []
                    }));

                setState(prev => ({
                    ...prev,
                    sesiones: { callao, malvinas }
                }));
            }
        } catch (e) {
            console.error('Error al cargar historial:', e);
        } finally {
            setLoading(false);
        }
    }, [setState]);

    React.useEffect(() => {
        cargarHistorial();
    }, [cargarHistorial]);

    const todasLasSesiones = [...state.sesiones.callao.map(s => ({ ...s, almacen: 'Callao' })), ...state.sesiones.malvinas.map(s => ({ ...s, almacen: 'Malvinas' }))]
        .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());

    return (
        <div id="view-registro" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 transition-all">
                    <header className="flex justify-between items-start flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-[#002D5A] to-[#002D5A] rounded-xl flex items-center justify-center text-white shadow-sm transition-all duration-200">
                                <Archive className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0" style={{ fontFamily: 'var(--font-poppins)', fontSize: '22px' }}>
                                    Registro de Inventarios
                                </h1>
                                <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    Consulta el historial detallado de inventarios finalizados y reportes del sistema
                                </p>
                            </div>
                        </div>

                        <div className="header-actions flex flex-wrap gap-3 items-center">
                            <div className="flex gap-2 items-center bg-gray-50 p-1.5 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-2 px-2">
                                    <Calendar className="w-4 h-4 text-[#0B3B8C]" />
                                    <input type="date" className="bg-transparent border-none text-xs font-bold text-gray-700 outline-none hover:text-[#0B3B8C] transition-colors" />
                                </div>
                                <span className="text-gray-300 text-xs font-bold">to</span>
                                <div className="flex items-center gap-2 px-2">
                                    <input type="date" className="bg-transparent border-none text-xs font-bold text-gray-700 outline-none hover:text-[#0B3B8C] transition-colors" />
                                </div>
                            </div>

                            <button className="flex items-center gap-2 px-6 py-2 bg-white border-2 border-[#1f2937] text-[#1f2937] rounded-full btn-oval font-bold hover:bg-gray-50 transition-all text-xs shadow-sm">
                                <FileDown className="w-4 h-4" />
                                <span>Exportar PDF</span>
                            </button>
                        </div>
                    </header>

                    {/* Tabla */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">#</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ALMACÉN</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">N° INVENTARIO</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">TIPO/TIENDA</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">REGISTRADO</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">INICIO</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">FIN</th>
                                        <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ACCIÓN</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading && todasLasSesiones.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-3 py-16 text-center text-sm text-gray-500">
                                                Cargando historial...
                                            </td>
                                        </tr>
                                    ) : todasLasSesiones.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-3 py-16 text-center text-sm text-gray-400 font-medium italic">
                                                No hay inventarios registrados en este periodo
                                            </td>
                                        </tr>
                                    ) : (
                                        todasLasSesiones.map((s, idx) => (
                                            <tr key={s.id} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="px-3 py-4 text-xs font-medium text-gray-900">{idx + 1}</td>
                                                <td className="px-3 py-4 text-xs text-gray-600 uppercase font-bold text-[#0B3B8C]">{s.almacen}</td>
                                                <td className="px-3 py-4 text-xs text-gray-900 font-bold">{s.numero}</td>
                                                <td className="px-3 py-4 text-xs text-gray-600 uppercase">{s.tienda || s.tipo}</td>
                                                <td className="px-3 py-4 text-xs text-gray-600">{s.registrado}</td>
                                                <td className="px-3 py-4 text-xs text-gray-600">{s.inicio}</td>
                                                <td className="px-3 py-4 text-xs text-gray-600">{s.fin || '-'}</td>
                                                <td className="px-3 py-4 text-center">
                                                    <button className="text-[#0B3B8C] hover:text-[#002D5A] font-bold text-[10px] uppercase">
                                                        Detalle
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
