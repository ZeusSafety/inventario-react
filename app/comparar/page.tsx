'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useInventory } from '@/context/InventoryContext';
import {
    ArrowLeftRight,
    Upload,
    Building2,
    Store,
    Search,
    FileDown,
    MoreVertical,
    Edit,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Save,
    X,
    ClipboardCheck,
    RefreshCw,
    History
} from 'lucide-react';
import { apiCall, apiCallFormData } from '@/lib/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ComparacionItem {
    id: number;
    item: number;
    producto: string;
    codigo: string;
    cantidad_sistema: number;
    cantidad_fisica: number;
    resultado: number;
    estado: 'CONFORME' | 'SOBRANTE' | 'FALTANTE';
    unidad_medida: string;
}

interface HistorialItem {
    id: number;
    producto: string;
    codigo: string;
    tipo_accion: string;
    motivo: string;
    cantidad: number;
    registrado_por: string;
    fecha_hora: string;
    detalles: string;
}

interface Resumen {
    total_productos: number;
    conformes: number;
    sobrantes: number;
    faltantes: number;
    total_sistema: number;
    total_fisico: number;
    diferencia_total: number;
}

export default function CompararPage() {
    const { state, showAlert } = useInventory();
    const [filterText, setFilterText] = useState('');
    const [selectedAlmacen, setSelectedAlmacen] = useState<'callao' | 'malvinas' | null>(null);
    const [loading, setLoading] = useState(false);

    const [comparacionData, setComparacionData] = useState<ComparacionItem[]>([]);
    const [resumen, setResumen] = useState<Resumen | null>(null);
    const [sistemaCargado, setSistemaCargado] = useState(false);

    const fileInputRefCallao = useRef<HTMLInputElement>(null);
    const fileInputRefMalvinas = useRef<HTMLInputElement>(null);

    // Modal States
    const [activeModal, setActiveModal] = useState<'fisico' | 'sistema' | 'verificacion' | null>(null);
    const [selectedItem, setSelectedItem] = useState<ComparacionItem | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState<HistorialItem[]>([]);

    // Edit Form States
    const [editForm, setEditForm] = useState({
        cantidad: 0,
        motivo: '',
        error_de: '',
        observaciones: ''
    });

    // Verification Form State
    const [verificacionForm, setVerificacionForm] = useState({
        fecha_ingreso_compra: '',
        hora_ingreso_compra: '',
        numero_acta: '',
        fecha_descarga_compra: '',
        hora_descarga_compra: '',
        fecha_descarga_ventas: '',
        hora_descarga_ventas: '',
        fecha_descarga_sistema: '',
        hora_descarga_sistema: '',
        compras_totales: 0,
        ventas_totales: 0,
        observaciones: '',
        motivo: ''
    });

    // Dropdown Action State
    const [openActionId, setOpenActionId] = useState<number | null>(null);

    useEffect(() => {
        if (selectedAlmacen) {
            fetchComparison(selectedAlmacen);
        } else {
            setComparacionData([]);
            setResumen(null);
            setSistemaCargado(false);
        }
    }, [selectedAlmacen, state.sesionActual.inventario_id]);

    const fetchComparison = async (almacen: 'callao' | 'malvinas') => {
        if (!state.sesionActual.inventario_id) return;
        setLoading(true);
        try {
            // Generar comparación primero para asegurar datos actualizados
            // await apiCall(`generar_comparacion_${almacen}`, 'POST', {
            //     inventario_id: state.sesionActual.id,
            //     usuario: state.usuario.nombre || 'SISTEMA'
            // }); // Mejor solo obtener, generar es manual o tras carga? El usuario dijo "generar comparación" endpoint existe. 
            // Vamos a solo OBTENER por defecto. Si no hay datos, tal vez generar?

            const response = await apiCall(`obtener_comparacion_${almacen}&inventario_id=${state.sesionActual.inventario_id}`);
            if (response.success) {
                setComparacionData(response.comparaciones || []);
                setResumen(response.resumen);
                setSistemaCargado(response.sistema_cargado);
            } else {
                showAlert('Error', response.message || 'No se pudo obtener la comparación', 'error');
            }
        } catch (error) {
            console.error(error);
            showAlert('Error', 'Error al cargar comparación', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        if (!state.sesionActual.inventario_id) return;
        try {
            const response = await apiCall(`obtener_historial_acciones&inventario_id=${state.sesionActual.inventario_id}`);
            if (response.success) {
                setHistoryData(response.acciones || []);
                setShowHistory(true);
            } else {
                showAlert('Error', response.message, 'error');
            }
        } catch (error) {
            console.error(error);
            showAlert('Error', 'Error al cargar historial', 'error');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, almacen: 'callao' | 'malvinas') => {
        const file = e.target.files?.[0];
        if (!file || !state.sesionActual.inventario_id) return;

        const formData = new FormData();
        formData.append('inventario_id', state.sesionActual.inventario_id.toString());
        formData.append('usuario', 'SISTEMA');
        formData.append('excel_file', file);

        setLoading(true);
        try {
            const uploadResp = await apiCallFormData(`cargar_sistema_${almacen}`, formData);
            if (uploadResp.success) {
                showAlert('Éxito', `Carga correcta: ${uploadResp.message}`, 'success');

                // Generar comparación automáticamente
                const genResp = await apiCall(`generar_comparacion_${almacen}`, 'POST', {
                    inventario_id: state.sesionActual.inventario_id,
                    usuario: 'SISTEMA'
                });

                if (genResp.success) {
                    showAlert('Éxito', 'Comparación generada correctamente', 'success');
                    if (selectedAlmacen === almacen) {
                        fetchComparison(almacen);
                    } else {
                        setSelectedAlmacen(almacen);
                    }
                } else {
                    showAlert('Advertencia', 'Archivo cargado pero falló generación de comparación', 'warning');
                }
            } else {
                showAlert('Error', uploadResp.message || 'Error al cargar archivo', 'error');
            }
        } catch (error) {
            console.error(error);
            showAlert('Error', 'Error de conexión al subir archivo', 'error');
        } finally {
            setLoading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleActionClick = (item: ComparacionItem, action: 'fisico' | 'sistema' | 'verificacion') => {
        setSelectedItem(item);
        setOpenActionId(null);
        setActiveModal(action);

        if (action === 'fisico') {
            setEditForm({
                cantidad: item.cantidad_fisica,
                motivo: '',
                error_de: 'logistica',
                observaciones: ''
            });
        } else if (action === 'sistema') {
            setEditForm({
                cantidad: item.cantidad_sistema,
                motivo: '',
                error_de: 'sistema',
                observaciones: ''
            });
        } else if (action === 'verificacion') {
            setVerificacionForm({
                fecha_ingreso_compra: '',
                hora_ingreso_compra: '',
                numero_acta: '',
                fecha_descarga_compra: '',
                hora_descarga_compra: '',
                fecha_descarga_ventas: '',
                hora_descarga_ventas: '',
                fecha_descarga_sistema: '',
                hora_descarga_sistema: '',
                compras_totales: 0,
                ventas_totales: 0,
                observaciones: '',
                motivo: ''
            });
        }
    };

    const handleSubmitEdit = async () => {
        if (!selectedItem || !selectedAlmacen) return;

        const action = activeModal === 'fisico' ? 'editar_cantidad_fisica' : 'editar_cantidad_sistema';
        const payload = {
            comparacion_id: selectedItem.id,
            almacen: selectedAlmacen,
            nueva_cantidad: editForm.cantidad,
            motivo: editForm.motivo,
            registrado_por: 'SISTEMA',
            error_de: editForm.error_de,
            observaciones: editForm.observaciones
        };

        try {
            const response = await apiCall(action, 'POST', payload);
            if (response.success) {
                showAlert('Éxito', 'Cantidad actualizada correctamente', 'success');
                setActiveModal(null);
                fetchComparison(selectedAlmacen);
            } else {
                showAlert('Error', response.message, 'error');
            }
        } catch (error) {
            showAlert('Error', 'Hubo un problema al actualizar', 'error');
        }
    };

    const handleSubmitVerification = async () => {
        if (!selectedItem || !selectedAlmacen) return;

        const payload = {
            comparacion_id: selectedItem.id,
            almacen: selectedAlmacen,
            registrado_por: 'SISTEMA',
            ...verificacionForm
        };

        try {
            const response = await apiCall('registrar_verificacion', 'POST', payload);
            if (response.success) {
                showAlert('Éxito', `Verificación registrada: ${response.estado_verificacion}`, 'success');
                setActiveModal(null);
                fetchComparison(selectedAlmacen);
            } else {
                showAlert('Error', response.message, 'error');
            }
        } catch (error) {
            showAlert('Error', 'Hubo un problema al registrar verificación', 'error');
        }
    };

    // Filter Logic
    const filteredData = comparacionData.filter(item =>
        item.producto.toLowerCase().includes(filterText.toLowerCase()) ||
        item.codigo.toLowerCase().includes(filterText.toLowerCase()) ||
        item.estado.toLowerCase().includes(filterText.toLowerCase())
    );

    return (
        <div id="view-comparar" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
                    <header className="flex justify-between items-start flex-wrap gap-4 mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-[#002D5A] to-[#002D5A] rounded-xl flex items-center justify-center text-white shadow-sm transition-all duration-200">
                                <ArrowLeftRight className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0" style={{ fontFamily: 'var(--font-poppins)', fontSize: '22px' }}>
                                    Comparación de Inventario
                                </h1>
                                <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    Analiza y detecta discrepancias entre el conteo físico y los registros del sistema
                                </p>
                            </div>
                        </div>
                        <div className="header-actions flex flex-wrap gap-2">
                            {/* File Inputs Hidden */}
                            <input
                                type="file"
                                ref={fileInputRefCallao}
                                className="hidden"
                                accept=".xlsx,.xls"
                                onChange={(e) => handleFileUpload(e, 'callao')}
                            />
                            <input
                                type="file"
                                ref={fileInputRefMalvinas}
                                className="hidden"
                                accept=".xlsx,.xls"
                                onChange={(e) => handleFileUpload(e, 'malvinas')}
                            />

                            <button
                                onClick={() => fileInputRefCallao.current?.click()}
                                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-br from-[#E9F1FF] to-[#D9E6FF] hover:from-[#D9E6FF] hover:to-[#C9D6FF] text-[#0B3B8C] rounded-full btn-oval font-semibold hover:shadow-md transition-all text-xs"
                            >
                                <Upload className="w-4 h-4" />
                                <span>Sistema Callao</span>
                            </button>
                            <button
                                className={`flex items-center gap-2 px-6 py-2 rounded-full btn-oval font-semibold hover:shadow-md transition-all text-xs ${selectedAlmacen === 'callao' ? 'bg-[#0B3B8C] text-white' : 'bg-white border-2 border-[#0B3B8C] text-[#0B3B8C]'}`}
                                onClick={() => setSelectedAlmacen('callao')}
                            >
                                <Building2 className="w-4 h-4" />
                                <span>Almacén Callao</span>
                            </button>
                            <button
                                onClick={() => fileInputRefMalvinas.current?.click()}
                                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-br from-[#E9F1FF] to-[#D9E6FF] hover:from-[#D9E6FF] hover:to-[#C9D6FF] text-[#0B3B8C] rounded-full btn-oval font-semibold hover:shadow-md transition-all text-xs"
                            >
                                <Upload className="w-4 h-4" />
                                <span>Sistema Malvinas</span>
                            </button>
                            <button
                                className={`flex items-center gap-2 px-6 py-2 rounded-full btn-oval font-semibold hover:shadow-md transition-all text-xs ${selectedAlmacen === 'malvinas' ? 'bg-[#0B3B8C] text-white' : 'bg-white border-2 border-[#0B3B8C] text-[#0B3B8C]'}`}
                                onClick={() => setSelectedAlmacen('malvinas')}
                            >
                                <Store className="w-4 h-4" />
                                <span>Almacén Malvinas</span>
                            </button>
                        </div>
                    </header>

                    {selectedAlmacen ? (
                        <div id="panel-comparacion">
                            <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span className="font-medium text-gray-400">Almacén:</span>
                                            <b className="uppercase text-[#0B3B8C] bg-white px-3 py-1 rounded-lg shadow-sm border border-gray-100">{selectedAlmacen}</b>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span className="font-medium text-gray-400">Inventario:</span>
                                            <b className="text-[#0B3B8C] bg-white px-3 py-1 rounded-lg shadow-sm border border-gray-100">{state.sesionActual.numero || '-'}</b>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="btn-group flex p-1 bg-white rounded-full shadow-sm border border-gray-200">
                                            <button className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                                                <FileDown className="w-4 h-4" /> PDF
                                            </button>
                                            <button className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-[#198754] hover:bg-green-50 rounded-full transition-colors">
                                                <FileDown className="w-4 h-4" /> Excel
                                            </button>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="bg-white border-2 border-gray-200 text-sm rounded-xl block w-64 pl-10 p-2 focus:border-[#0B3B8C] outline-none transition-all shadow-sm"
                                                placeholder="Buscar..."
                                                value={filterText}
                                                onChange={(e) => setFilterText(e.target.value)}
                                            />
                                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-4 pt-4 border-t border-gray-200/60">
                                    <div className="bg-green-50 text-green-700 border border-green-100 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        Correctos: {resumen?.conformes || 0}
                                    </div>
                                    <div className="bg-red-50 text-red-700 border border-red-100 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                        Incorrectos: {(resumen?.faltantes || 0) + (resumen?.sobrantes || 0)}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white">Item</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white">Producto</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white">Código</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white">Cant. Sistema</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white">Cant. Física</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white">Resultado</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white">Estado</th>
                                                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-white">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {loading ? (
                                                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">Cargando datos...</td></tr>
                                            ) : filteredData.length === 0 ? (
                                                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">No hay datos de comparación para este almacén</td></tr>
                                            ) : (
                                                filteredData.map((item) => (
                                                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                                        <td className="px-4 py-3 text-gray-600 text-sm font-mono">{item.item}</td>
                                                        <td className="px-4 py-3 text-gray-800 text-sm font-medium">{item.producto}</td>
                                                        <td className="px-4 py-3 text-gray-600 text-sm font-mono">{item.codigo}</td>
                                                        <td className="px-4 py-3 text-center font-bold text-gray-700 bg-gray-50">{item.cantidad_sistema}</td>
                                                        <td className="px-4 py-3 text-center font-bold text-blue-700 bg-blue-50/30">{item.cantidad_fisica}</td>
                                                        <td className={`px-4 py-3 text-center font-bold ${item.resultado === 0 ? 'text-gray-400' : item.resultado < 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                                                            {item.resultado > 0 ? `+${item.resultado}` : item.resultado}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${item.estado === 'CONFORME' ? 'bg-green-100 text-green-700 border-green-200' :
                                                                    item.estado === 'FALTANTE' ? 'bg-red-100 text-red-700 border-red-200' :
                                                                        'bg-yellow-100 text-yellow-700 border-yellow-200'
                                                                }`}>
                                                                {item.estado}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center relative">
                                                            <button
                                                                onClick={() => setOpenActionId(openActionId === item.id ? null : item.id)}
                                                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-700 transition-colors"
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </button>

                                                            {openActionId === item.id && (
                                                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in zoom-in-95 duration-200">
                                                                    <button
                                                                        onClick={() => handleActionClick(item, 'fisico')}
                                                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 flex items-center gap-2 border-b border-gray-50"
                                                                    >
                                                                        <Edit className="w-4 h-4 text-blue-600" /> Editar Cantidad (Físico)
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleActionClick(item, 'sistema')}
                                                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 flex items-center gap-2 border-b border-gray-50"
                                                                    >
                                                                        <Upload className="w-4 h-4 text-orange-600" /> Editar Sistema
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleActionClick(item, 'verificacion')}
                                                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                                                                    >
                                                                        <ClipboardCheck className="w-4 h-4 text-green-600" /> Verificación
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-24 bg-gray-50/50 rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center transition-all">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mb-4 animate-bounce">
                                <ArrowLeftRight className="w-10 h-10 text-[#0B3B8C]" />
                            </div>
                            <h3 className="text-gray-900 font-bold text-lg mb-2">Comienza la Comparación</h3>
                            <p className="text-gray-500 max-w-xs text-center text-sm">Seleccione un almacén arriba para comenzar a comparar el inventario físico con el sistema</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals Overlay */}
            {activeModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                {activeModal === 'fisico' && <><Edit className="w-5 h-5 text-blue-600" /> Editar Cantidad Física</>}
                                {activeModal === 'sistema' && <><Upload className="w-5 h-5 text-orange-600" /> Editar Cantidad Sistema</>}
                                {activeModal === 'verificacion' && <><ClipboardCheck className="w-5 h-5 text-green-600" /> Registrar Verificación</>}
                            </h3>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Product Info (Readonly) */}
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Producto</label>
                                    <p className="font-semibold text-gray-800">{selectedItem?.producto}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Código</label>
                                    <p className="font-mono text-gray-700">{selectedItem?.codigo}</p>
                                </div>
                            </div>

                            {/* Forms */}
                            {(activeModal === 'fisico' || activeModal === 'sistema') && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad Nueva</label>
                                            <input
                                                type="number"
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                value={editForm.cantidad}
                                                onChange={(e) => setEditForm({ ...editForm, cantidad: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                value={editForm.motivo}
                                                onChange={(e) => setEditForm({ ...editForm, motivo: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Error De</label>
                                        <select
                                            className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
                                            value={editForm.error_de}
                                            onChange={(e) => setEditForm({ ...editForm, error_de: e.target.value })}
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="sistema">Sistema</option>
                                            <option value="logistica">Logística</option>
                                            <option value="otro">Otro</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                                        <textarea
                                            className="w-full p-2.5 border border-gray-300 rounded-lg h-24"
                                            value={editForm.observaciones}
                                            onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                                        ></textarea>
                                    </div>
                                </>
                            )}

                            {activeModal === 'verificacion' && (
                                <div className="space-y-6">
                                    {/* Compras Section */}
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900 border-b pb-1 mb-3">Datos de Compra</h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-xs text-gray-500 block mb-1">Fecha Ingreso</label>
                                                <input type="date" className="w-full p-2 border rounded-lg text-sm"
                                                    value={verificacionForm.fecha_ingreso_compra}
                                                    onChange={(e) => setVerificacionForm({ ...verificacionForm, fecha_ingreso_compra: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block mb-1">Hora Ingreso</label>
                                                <input type="time" className="w-full p-2 border rounded-lg text-sm"
                                                    value={verificacionForm.hora_ingreso_compra}
                                                    onChange={(e) => setVerificacionForm({ ...verificacionForm, hora_ingreso_compra: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block mb-1">N° Acta</label>
                                                <input type="text" className="w-full p-2 border rounded-lg text-sm"
                                                    value={verificacionForm.numero_acta}
                                                    onChange={(e) => setVerificacionForm({ ...verificacionForm, numero_acta: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ventas & Calculos */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900 border-b pb-1 mb-3">Totales</h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs text-gray-500 block">Compras Totales</label>
                                                    <input type="number" className="w-full p-2 border rounded-lg"
                                                        value={verificacionForm.compras_totales}
                                                        onChange={(e) => setVerificacionForm({ ...verificacionForm, compras_totales: Number(e.target.value) })} />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">Ventas Totales</label>
                                                    <input type="number" className="w-full p-2 border rounded-lg"
                                                        value={verificacionForm.ventas_totales}
                                                        onChange={(e) => setVerificacionForm({ ...verificacionForm, ventas_totales: Number(e.target.value) })} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                                            <span className="text-sm font-bold text-blue-800">Stock Existencia Calculado</span>
                                            <span className="text-3xl font-black text-blue-900 my-2">
                                                {verificacionForm.compras_totales - verificacionForm.ventas_totales}
                                            </span>
                                            <span className="text-xs text-blue-600">(Compras - Ventas)</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones / Motivo</label>
                                        <textarea
                                            className="w-full p-2.5 border border-gray-300 rounded-lg h-20"
                                            value={verificacionForm.observaciones}
                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, observaciones: e.target.value })}
                                            placeholder="Detalles de la verificación..."
                                        ></textarea>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 rounded-b-2xl">
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={activeModal === 'verificacion' ? handleSubmitVerification : handleSubmitEdit}
                                className="px-5 py-2.5 bg-[#0B3B8C] text-white font-bold rounded-xl hover:bg-blue-900 transition-colors shadow-lg shadow-blue-200 flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistory && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <History className="w-5 h-5 text-gray-600" /> Historial de Acciones
                            </h3>
                            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Acción</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Producto</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Usuario</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Detalle</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {historyData.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-500">No hay acciones registradas</td></tr>
                                    ) : (
                                        historyData.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.fecha_hora}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${item.tipo_accion.includes('EDITAR') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                                        {item.tipo_accion.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    <div>{item.producto}</div>
                                                    <div className="text-xs text-gray-400">{item.codigo}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.registrado_por}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500 italic truncate max-w-xs">{item.motivo || '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
