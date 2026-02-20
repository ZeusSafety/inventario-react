'use client';

import React, { useState, useEffect } from 'react';
import { useInventory } from '@/context/InventoryContext';
import { apiCall, API_BASE_URL } from '@/lib/api';
import { Receipt, PlusCircle, FileText, Eye } from 'lucide-react';
import NuevoProformaModal from '@/components/modals/NuevoProformaModal';
import Modal from '@/components/Modal';

export default function ProformasPage() {
    const { state, loadProformas, showAlert, showConfirm } = useInventory();
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedProforma, setSelectedProforma] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await loadProformas();
            setLoading(false);
        };
        init();
    }, [loadProformas]);

    const verDetalleProforma = async (id: string | number) => {
        try {
            const response = await apiCall(`obtener_detalle_proforma&proforma_id=${id}`, 'GET');
            if (response.success) {
                setSelectedProforma(response);
                setIsDetailModalOpen(true);
            } else {
                showAlert('Error', response.message || 'Error al obtener detalle de proforma', 'error');
            }
        } catch (e) {
            console.error(e);
            showAlert('Error', 'Error de conexión con el servidor', 'error');
        }
    };

    const actualizarEstadoProforma = async (id: string | number, nuevoEstado: string) => {
        showConfirm(
            `¿Actualizar estado a "${nuevoEstado}"?`,
            'Esta acción actualizará el estado de la proforma.',
            async () => {
                try {
                    const response = await apiCall('actualizar_estado_proforma', 'POST', {
                        proforma_id: id,
                        estado: nuevoEstado,
                        observaciones: ''
                    });
                    if (response.success) {
                        showAlert('¡Actualizado!', response.message || 'Estado actualizado correctamente.', 'success');
                        await loadProformas();
                        if (isDetailModalOpen) {
                            setIsDetailModalOpen(false);
                        }
                    } else {
                        showAlert('Error', response.message || 'Error al actualizar estado', 'error');
                    }
                } catch (e) {
                    console.error(e);
                    showAlert('Error', 'Error de conexión con el servidor', 'error');
                }
            }
        );
    };

    const descargarProformaPDF = (archivoPdf: string | null) => {
        if (!archivoPdf) {
            showAlert('Información', 'El PDF aún no está disponible.', 'warning');
            return;
        }
        window.open(`${API_BASE_URL}/?action=descargar_proforma_pdf&archivo=${archivoPdf}`, '_blank');
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
                                        Proformas
                                    </h1>
                                    <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: 'var(--font-poppins)' }}>
                                        Gestión y consulta de proformas para control de inventario
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
                                            <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ESTADO</th>
                                            <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ARCHIVO</th>
                                            <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ACCIÓN</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-600">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"></div>
                                                        <span>Cargando datos...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : currentItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="px-3 py-12 text-center text-sm text-gray-500 font-medium italic">
                                                    No hay registros aún
                                                </td>
                                            </tr>
                                        ) : (
                                            currentItems.map((pf, idx) => (
                                                <tr key={pf.id} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                                                    <td className="px-3 py-4 text-xs font-medium text-gray-900 uppercase">{pf.id}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600 uppercase">{pf.fecha}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600 uppercase">{pf.asesor}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600 uppercase">{pf.registrado}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600 uppercase font-bold text-[#0B3B8C]">{pf.almacen}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-900 font-bold uppercase">{pf.num}</td>
                                                    <td className="px-3 py-4 text-xs">
                                                        {pf.estado ? (
                                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-semibold uppercase">
                                                                {pf.estado}
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-semibold uppercase">
                                                                Sin estado
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-4 text-xs text-gray-600">
                                                        {pf.archivo_pdf ? (
                                                            <button
                                                                onClick={() => descargarProformaPDF(pf.archivo_pdf || null)}
                                                                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg text-[10px] font-bold hover:opacity-90 transition-all duration-200 shadow-sm"
                                                            >
                                                                <FileText className="w-3 h-3" />
                                                                <span>PDF</span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-400 text-[10px] italic">No disponible</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                className="bg-green-600 text-white px-3 py-1 rounded-full text-[10px] font-bold hover:bg-green-700 transition-colors uppercase shadow-sm"
                                                                onClick={() => verDetalleProforma(pf.id)}
                                                                title="Ver detalle"
                                                            >
                                                                <Eye className="w-3 h-3 inline" />
                                                            </button>
                                                        </div>
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
                onClose={() => {
                    setIsModalOpen(false);
                    loadProformas();
                }}
            />

            {/* Modal de Detalle de Proforma */}
            {selectedProforma && (
                <Modal
                    isOpen={isDetailModalOpen}
                    onClose={() => {
                        setIsDetailModalOpen(false);
                        setSelectedProforma(null);
                    }}
                    title={<><Receipt className="w-5 h-5" /> Detalle de Proforma</>}
                    size="2xl"
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-600 uppercase">Número de Proforma</label>
                                <p className="text-sm font-bold text-gray-900">{selectedProforma.proforma?.numero_proforma}</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 uppercase">Fecha de Registro</label>
                                <p className="text-sm text-gray-700">{selectedProforma.proforma?.fecha_formateada}</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 uppercase">Asesor</label>
                                <p className="text-sm text-gray-700">{selectedProforma.proforma?.asesor}</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 uppercase">Registrado por</label>
                                <p className="text-sm text-gray-700">{selectedProforma.proforma?.registrado_por}</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 uppercase">Almacén</label>
                                <p className="text-sm font-bold text-[#0B3B8C] uppercase">{selectedProforma.proforma?.almacen}</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 uppercase">Estado</label>
                                <p className="text-sm">
                                    {selectedProforma.proforma?.estado ? (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold uppercase">
                                            {selectedProforma.proforma.estado}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 italic">Sin estado</span>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <h6 className="font-bold text-gray-700 mb-3 text-sm uppercase">Productos ({selectedProforma.total_productos || 0})</h6>
                            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white">Producto</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">Código</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">Cantidad</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">Unidad</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">Físico Antes</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">Físico Después</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {selectedProforma.detalle && selectedProforma.detalle.length > 0 ? (
                                                selectedProforma.detalle.map((item: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 font-semibold">{item.producto}</td>
                                                        <td className="px-3 py-2 text-center">{item.codigo}</td>
                                                        <td className="px-3 py-2 text-center font-bold">{item.cantidad}</td>
                                                        <td className="px-3 py-2 text-center">{item.unidad_medida}</td>
                                                        <td className="px-3 py-2 text-center">{item.cantidad_fisico_antes || '-'}</td>
                                                        <td className="px-3 py-2 text-center font-bold text-green-600">{item.cantidad_fisico_despues || '-'}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="px-3 py-4 text-center text-gray-400 italic">No hay productos</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4 border-t">
                            <button
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                                onClick={() => actualizarEstadoProforma(selectedProforma.proforma?.id, 'PROFORMA INGRESADA')}
                            >
                                Marcar como Ingresada
                            </button>
                            <button
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                                onClick={() => actualizarEstadoProforma(selectedProforma.proforma?.id, 'TIENE COMPROBANTE')}
                            >
                                Marcar con Comprobante
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
