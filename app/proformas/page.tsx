'use client';

import React, { useState, useEffect } from 'react';
import { useInventory } from '@/context/InventoryContext';
import { apiCall, API_BASE_URL } from '@/lib/api';
import { Receipt, PlusCircle, FileText } from 'lucide-react';
import NuevoProformaModal from '@/components/modals/NuevoProformaModal';

export default function ProformasPage() {
    const { state, setState, loadProformas, showAlert, showConfirm } = useInventory();
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const cargarProductosAPI = React.useCallback(async (conteoId = 1) => {
        try {
            const response = await apiCall(`obtener_detalle_conteo&conteo_id=${conteoId}`, 'GET');
            if (response.success && response.productos) {
                const productos = (response.productos as any[]).map((p, i) => ({
                    item: p.item_producto || (i + 1),
                    producto: p.producto || '',
                    codigo: String(p.codigo || ''),
                    unidad_medida: p.unidad_medida || 'UNIDAD',
                    cantidad_sistema: Number(p.cantidad || 0),
                    detalle_id: p.id
                }));
                setState(prev => ({ ...prev, productos }));
            }
        } catch (error) {
            console.error('Error al cargar productos:', error);
        }
    }, [setState]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await loadProformas();
            if (state.productos.length === 0) {
                await cargarProductosAPI();
            }
            setLoading(false);
        };
        init();
    }, [loadProformas, state.productos.length, cargarProductosAPI]);

    const emitirProforma = async (id: string | number) => {
        showConfirm(
            '¿Emitir Proforma?',
            '¿Desea emitir esta proforma? Esta acción no se puede deshacer.',
            async () => {
                try {
                    const response = await apiCall(`emitir_proforma&id=${id}`, 'POST');
                    if (response.success) {
                        showAlert('¡Emitida!', 'Proforma emitida correctamente.', 'success');
                        await loadProformas();
                    } else {
                        showAlert('Error', response.message || 'Error al emitir proforma', 'error');
                    }
                } catch (e) {
                    console.error(e);
                    showAlert('Error', 'Error de conexión con el servidor', 'error');
                }
            }
        );
    };

    const descargarProformaPDF = (id: string | number) => {
        window.open(`${API_BASE_URL}/?action=descargar_proforma_pdf&id=${id}`, '_blank');
    };

    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = state.proformas.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(state.proformas.length / itemsPerPage);

    return (
        <>
            <div id="view-proformas" className="animate-in fade-in duration-500 font-poppins">
                <div className="container mx-auto">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 transition-all">
                        <header className="flex justify-between items-start flex-wrap gap-4 mb-8">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-[#002D5A] to-[#002D5A] rounded-xl flex items-center justify-center text-white shadow-sm transition-all duration-200">
                                    <Receipt className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="font-bold text-gray-900 m-0" style={{ fontFamily: 'var(--font-poppins)', fontSize: '22px' }}>
                                        Simulación de Proformas
                                    </h1>
                                    <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: 'var(--font-poppins)' }}>
                                        Gestión y consulta de proformas simuladas para control de inventario preventivo
                                    </p>
                                </div>
                            </div>

                            <div className="header-actions">
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="flex items-center gap-2 px-6 py-2 bg-[#0B3B8C] text-white rounded-full btn-oval font-bold hover:bg-[#002D5A] hover:shadow-md transition-all text-xs"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    <span>Nuevo Registro</span>
                                </button>
                            </div>
                        </header>

                        <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b-[4px]" style={{ backgroundColor: 'rgb(0, 45, 90)', borderColor: 'rgb(244, 180, 0)' }}>
                                            <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ID</th>
                                            <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">FECHA REGISTRO</th>
                                            <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ASESOR</th>
                                            <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">REGISTRADO POR</th>
                                            <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ALMACÉN</th>
                                            <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">N° PROFORMA</th>
                                            <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ARCHIVO</th>
                                            <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ACCIÓN</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-600">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"></div>
                                                        <span>Cargando datos...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : currentItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-12 text-center text-sm text-gray-500 font-medium italic">
                                                    No hay registros aún
                                                </td>
                                            </tr>
                                        ) : (
                                            currentItems.map((pf, idx) => (
                                                <tr key={pf.id} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                                                    <td className="px-3 py-4 text-xs font-medium text-gray-900 uppercase">{indexOfFirstItem + idx + 1}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600 uppercase">{pf.fecha}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600 uppercase">{pf.asesor}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600 uppercase">{pf.registrado}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600 uppercase font-bold text-[#0B3B8C]">{pf.almacen}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-900 font-bold uppercase">{pf.num}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600">
                                                        <button
                                                            onClick={() => descargarProformaPDF(pf.id)}
                                                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg text-[10px] font-bold hover:opacity-90 transition-all duration-200 shadow-sm"
                                                        >
                                                            <FileText className="w-3 h-3" />
                                                            <span>PDF</span>
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-4 text-center">
                                                        <button
                                                            className="bg-[#0B3B8C] text-white px-3 py-1 rounded-full text-[10px] font-bold hover:bg-[#002D5A] transition-colors uppercase shadow-sm"
                                                            onClick={() => emitirProforma(pf.id)}
                                                        >
                                                            Emitir
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                        style={{ fontFamily: 'var(--font-poppins)' }}
                                    >«</button>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                        style={{ fontFamily: 'var(--font-poppins)' }}
                                    >&lt;</button>
                                </div>
                                <span className="text-xs text-gray-700 font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    Página {totalPages > 0 ? currentPage : 0} de {totalPages}
                                </span>
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                        style={{ fontFamily: 'var(--font-poppins)' }}
                                    >&gt;</button>
                                    <button
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                        style={{ fontFamily: 'var(--font-poppins)' }}
                                    >»</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <NuevoProformaModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
}
