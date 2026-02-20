'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    History,
    ShieldCheck,
    FileText,
    Eye
} from 'lucide-react';
import { apiCall, apiCallFormData, API_BASE_URL } from '@/lib/api';
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
    estado: 'CONFORME' | 'SOBRANTE' | 'FALTANTE' | 'SISTEMA';

    unidad_medida: string;
}

interface HistorialItem {
    id: number;
    producto: string;
    producto_id?: number;
    codigo: string;
    tipo_accion: string;
    motivo: string;
    cantidad: number;
    registrado_por: string;
    fecha_hora: string;
    fecha_hora_raw: string;
    detalles: any;
    almacen: string;
    observaciones?: string;
}

interface Resumen {
    total_productos: number;
    conformes: number;
    sobrantes: number;
    faltantes: number;
    total_sistema: number;
    total_fisico: number;
    diferencia_total: number;
    sin_conteo: number;
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
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [password, setPassword] = useState('');
    const [pendingItem, setPendingItem] = useState<ComparacionItem | null>(null);
    const [pendingAction, setPendingAction] = useState<'fisico' | 'sistema' | 'verificacion' | null>(null);
    const [selectedItem, setSelectedItem] = useState<ComparacionItem | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState<HistorialItem[]>([]);

    // Edit Form States
    const [editForm, setEditForm] = useState({
        cantidad: 0,
        motivo_tipo: '', // 'Error de conteo', 'otro' etc.
        motivo: '',      // El texto final
        registrado_por: '',
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
        motivo: '',
        registrado_por: '' // Add default value
    });

    const [modalText, setModalText] = useState<{ title: string; content: string } | null>(null);
    const [verificacionDetalle, setVerificacionDetalle] = useState<any | null>(null);

    // Dropsown Action State
    const [openActionId, setOpenActionId] = useState<number | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

    // Close menu on click outside or scroll
    useEffect(() => {
        const handleClose = () => {
            setOpenActionId(null);
            setMenuPosition(null);
        };

        if (openActionId) {
            window.addEventListener('click', handleClose);
            window.addEventListener('scroll', handleClose, true);
            window.addEventListener('resize', handleClose);
        }

        return () => {
            window.removeEventListener('click', handleClose);
            window.removeEventListener('scroll', handleClose, true);
            window.removeEventListener('resize', handleClose);
        };
    }, [openActionId]);

    // Pagination States for History Tables
    const [currentPageFisico, setCurrentPageFisico] = useState(1);
    const [currentPageSistema, setCurrentPageSistema] = useState(1);
    const [currentPageVerificacion, setCurrentPageVerificacion] = useState(1);
    const itemsPerPage = 10;

    // Verification Password State
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

    useEffect(() => {
        // Solo intentar cargar si hay un almacén seleccionado Y un inventario activo
        if (selectedAlmacen && state.sesionActual.inventario_id) {
            fetchComparison(selectedAlmacen);
        } else {
            // Si se pierde el ID de inventario (ej. al cerrar sesión), limpiar la vista silenciosamente
            if (!state.sesionActual.inventario_id) {
                setComparacionData([]);
                setResumen(null);
                setSistemaCargado(false);
            }
        }
    }, [selectedAlmacen, state.sesionActual.inventario_id]);

    // Escuchar evento de proforma registrada para recargar datos
    useEffect(() => {
        const handleProformaRegistrada = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { almacen, inventario_id } = customEvent.detail || {};
            
            // Solo recargar si es el mismo inventario y hay un almacén seleccionado
            if (selectedAlmacen && state.sesionActual?.inventario_id === inventario_id) {
                // Pequeño delay para dar tiempo al backend de procesar
                setTimeout(() => {
                    fetchComparison(selectedAlmacen);
                }, 300);
            }
        };

        window.addEventListener('proformaRegistrada', handleProformaRegistrada);
        return () => {
            window.removeEventListener('proformaRegistrada', handleProformaRegistrada);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAlmacen, state.sesionActual?.inventario_id]);

    const fetchComparison = async (almacen: 'callao' | 'malvinas') => {
        if (!state.sesionActual.inventario_id) return;
        setLoading(true);
        try {
            const response = await apiCall(`obtener_comparacion_${almacen}&inventario_id=${state.sesionActual.inventario_id}`);
            if (response.success) {
                setComparacionData(response.comparaciones || []);
                if (response.resumen) setResumen(response.resumen);
                setSistemaCargado(true);
                
                // Disparar evento para que Consolidado se actualice
                window.dispatchEvent(new CustomEvent('compararActualizado', {
                    detail: {
                        almacen: almacen,
                        inventario_id: state.sesionActual.inventario_id
                    }
                }));
            } else {
                showAlert('Error', response.message || 'Error al obtener datos', 'error');
            }
        } catch (error) {
            showAlert('Error', 'Error de conexión', 'error');
        } finally {
            setLoading(false);
            fetchHistory();
        }
    };


    const fetchHistory = async () => {
        if (!selectedAlmacen) return;
        try {
            const response = await apiCall(`obtener_historial_acciones&almacen=${selectedAlmacen}`);
            if (response.success) {
                setHistoryData(response.acciones || []);
            } else {
                showAlert('Error', response.message, 'error');
            }
        } catch (error) {
            showAlert('Error', 'Error al cargar historial', 'error');
        }
    };

    // Helper to safely format dates from backend
    const formatHistoryDate = (dateStr: string) => {
        if (!dateStr) return { date: '-', time: '-' };
        try {
            // If it has a space instead of T (MySQL format), replace it
            const normalizedDate = dateStr.replace(' ', 'T');
            const dateObj = new Date(normalizedDate);
            if (isNaN(dateObj.getTime())) return { date: dateStr.split(' ')[0] || '-', time: dateStr.split(' ')[1] || '-' };

            return {
                date: dateObj.toLocaleDateString('es-PE', { timeZone: 'America/Lima' }),
                time: dateObj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })
            };
        } catch (e) {
            return { date: '-', time: '-' };
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, almacen: 'callao' | 'malvinas') => {
        const file = e.target.files?.[0];
        console.log('📁 Archivo seleccionado:', file?.name);
        console.log('🏢 Almacén:', almacen);
        console.log('📋 inventario_id:', state.sesionActual.inventario_id);

        if (!file || !state.sesionActual.inventario_id) {
            console.error('❌ Falta archivo o inventario_id');
            if (!state.sesionActual.inventario_id) {
                showAlert('Error', 'No hay un inventario activo. Por favor asigna un número de inventario primero.', 'error');
            }
            return;
        }

        const formData = new FormData();
        formData.append('inventario_id', state.sesionActual.inventario_id.toString());
        formData.append('usuario', 'SISTEMA');
        formData.append('excel_file', file);

        setLoading(true);
        try {
            console.log('📤 Subiendo archivo del sistema...');
            const uploadResp = await apiCallFormData(`cargar_sistema_${almacen}`, formData);
            console.log('📥 Respuesta de carga:', uploadResp);

            if (uploadResp.success) {
                showAlert('Éxito', `Carga correcta: ${uploadResp.message}`, 'success');

                // Generar comparación automáticamente
                console.log('⚙️ Generando comparación...');
                const genResp = await apiCall(`generar_comparacion_${almacen}`, 'POST', {
                    inventario_id: state.sesionActual.inventario_id,
                    usuario: 'SISTEMA'
                });
                console.log('📥 Respuesta de generación:', genResp);

                if (genResp.success) {
                    showAlert('Éxito', 'Comparación generada correctamente', 'success');
                    if (selectedAlmacen === almacen) {
                        console.log('🔄 Recargando comparación...');
                        fetchComparison(almacen);
                    } else {
                        console.log('🔄 Cambiando a almacén:', almacen);
                        setSelectedAlmacen(almacen);
                    }
                } else {
                    console.error('❌ Error al generar comparación:', genResp.message);
                    showAlert('Advertencia', 'Archivo cargado pero falló generación de comparación', 'warning');
                }
            } else {
                console.error('❌ Error al cargar archivo:', uploadResp.message);
                showAlert('Error', uploadResp.message || 'Error al cargar archivo', 'error');
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            showAlert('Error', 'Error de conexión al subir archivo', 'error');
        } finally {
            setLoading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleActionClick = (item: ComparacionItem, action: 'fisico' | 'sistema' | 'verificacion') => {
        if (action === 'verificacion') {
            setPendingItem(item);
            setPendingAction(action);
            setShowPasswordModal(true);
            setPassword('');
            setOpenActionId(null);
            return;
        }

        setSelectedItem(item);
        setOpenActionId(null);
        setActiveModal(action);

        if (action === 'fisico') {
            setEditForm({
                cantidad: item.cantidad_fisica,
                motivo_tipo: '',
                motivo: '',
                registrado_por: '',
                error_de: 'logistica',
                observaciones: ''
            });
        } else if (action === 'sistema') {
            setEditForm({
                cantidad: item.cantidad_sistema,
                motivo_tipo: '',
                motivo: '',
                registrado_por: '',
                error_de: 'sistema',
                observaciones: ''
            });
        }
    };

    const handlePasswordConfirm = async () => {
        if (password === '0427' && pendingItem) {
            setSelectedItem(pendingItem);
            setActiveModal(pendingAction);
            setShowPasswordModal(false);

            if (pendingAction === 'verificacion') {
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
                    motivo: '',
                    registrado_por: ''
                });

                // Cargar datos existentes si los hay
                try {
                    const resp = await apiCall(`obtener_verificaciones_producto&comparacion_id=${pendingItem.id}&almacen=${selectedAlmacen}`);
                    if (resp.success && resp.verificaciones && resp.verificaciones.length > 0) {
                        const v = resp.verificaciones[0];
                        setVerificacionForm({
                            fecha_ingreso_compra: v.fecha_ingreso_compra || '',
                            hora_ingreso_compra: v.hora_ingreso_compra || '',
                            numero_acta: v.numero_acta || '',
                            fecha_descarga_compra: v.fecha_descarga_compra || '',
                            hora_descarga_compra: v.hora_descarga_compra || '',
                            fecha_descarga_ventas: v.fecha_descarga_ventas || '',
                            hora_descarga_ventas: v.hora_descarga_ventas || '',
                            fecha_descarga_sistema: v.fecha_descarga_sistema || '',
                            hora_descarga_sistema: v.hora_descarga_sistema || '',
                            compras_totales: v.compras_totales || 0,
                            ventas_totales: v.ventas_totales || 0,
                            observaciones: v.observaciones || '',
                            motivo: v.motivo || '',
                            registrado_por: v.registrado_por || ''
                        });
                    }
                } catch (e) {
                    console.error("Error al cargar verificacion existente", e);
                }
            }
        } else if (password !== '0427') {
            showAlert('Error', 'Contraseña incorrecta', 'error');
        }
    };

    const handleSubmitEdit = async () => {
        if (!selectedItem || !selectedAlmacen) return;

        const action = activeModal === 'fisico' ? 'editar_cantidad_fisica' : 'editar_cantidad_sistema';
        const payload = {
            comparacion_id: selectedItem.id,
            inventario_id: state.sesionActual.inventario_id,
            almacen: selectedAlmacen,
            nueva_cantidad: editForm.cantidad,
            motivo: editForm.motivo || editForm.motivo_tipo,
            registrado_por: editForm.registrado_por || 'SISTEMA',
            error_de: editForm.error_de,
            observaciones: editForm.observaciones
        };

        try {
            const response = await apiCall(action, 'POST', payload);
            if (response.success) {
                showAlert('Éxito', 'Cantidad actualizada correctamente', 'success');
                setActiveModal(null);
                fetchComparison(selectedAlmacen); // Esto ya dispara el evento compararActualizado
                fetchHistory();
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
            inventario_id: state.sesionActual.inventario_id,
            almacen: selectedAlmacen,
            ...verificacionForm,
            registrado_por: verificacionForm.registrado_por // Use from state
        };

        // Validation
        if (!verificacionForm.registrado_por) {
            showAlert('Error', 'Debe indicar quién registra la verificación', 'error');
            return;
        }
        if (!verificacionForm.fecha_ingreso_compra) {
            showAlert('Error', 'Complete la fecha de ingreso', 'error');
            return;
        }

        try {
            const response = await apiCall('registrar_verificacion', 'POST', payload);
            if (response.success) {
                showAlert('Éxito', `Verificación registrada: ${response.estado_verificacion}`, 'success');
                setActiveModal(null);
                fetchComparison(selectedAlmacen);
                fetchHistory();
            } else {
                showAlert('Error', response.message, 'error');
            }
        } catch (error) {
            showAlert('Error', 'Hubo un problema al registrar verificación', 'error');
        }
    };

    // Filter Logic
    const filteredData = comparacionData.filter(item =>
        item.producto?.toLowerCase().includes(filterText.toLowerCase()) ||
        item.codigo?.toLowerCase().includes(filterText.toLowerCase()) ||
        item.estado?.toLowerCase().includes(filterText.toLowerCase())
    );


    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.text(`Comparación de Inventario - ${selectedAlmacen?.toUpperCase()}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`N° Inventario: ${state.sesionActual.numero || '-'} | Inicio: ${state.sesionActual.inicio || '-'}`, 14, 22);

        const tableData = filteredData.map(item => [
            item.item,
            item.producto,
            item.codigo,
            item.cantidad_sistema,
            item.cantidad_fisica,
            item.resultado,
            item.estado
        ]);

        autoTable(doc, {
            head: [['Item', 'Producto', 'Código', 'Cant. Sis', 'Cant. Fis', 'Res', 'Estado']],
            body: tableData,
            startY: 30,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [11, 59, 140] }
        });

        doc.save(`comparacion_${selectedAlmacen}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleDownloadExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(filteredData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Comparación");
        XLSX.writeFile(workbook, `comparacion_${selectedAlmacen}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

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
                                className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-br from-[#E9F1FF] to-[#D9E6FF] hover:from-[#D9E6FF] hover:to-[#C9D6FF] text-[#0B3B8C] rounded-full btn-oval font-semibold hover:shadow-md transition-all text-[10px]"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Sistema Callao</span>
                            </button>
                            <button
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-full btn-oval font-semibold hover:shadow-md transition-all text-[10px] ${selectedAlmacen === 'callao' ? 'bg-[#0B3B8C] text-white' : 'bg-white border-2 border-[#0B3B8C] text-[#0B3B8C]'}`}
                                onClick={() => setSelectedAlmacen('callao')}
                            >
                                <Building2 className="w-3.5 h-3.5" />
                                <span>Almacén Callao {selectedAlmacen === 'callao' && comparacionData.length > 0 ? `(${comparacionData.length})` : ''}</span>
                            </button>
                            <button
                                onClick={() => fileInputRefMalvinas.current?.click()}
                                className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-br from-[#E9F1FF] to-[#D9E6FF] hover:from-[#D9E6FF] hover:to-[#C9D6FF] text-[#0B3B8C] rounded-full btn-oval font-semibold hover:shadow-md transition-all text-[10px]"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Sistema Malvinas</span>
                            </button>
                            <button
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-full btn-oval font-semibold hover:shadow-md transition-all text-[10px] ${selectedAlmacen === 'malvinas' ? 'bg-[#0B3B8C] text-white' : 'bg-white border-2 border-[#0B3B8C] text-[#0B3B8C]'}`}
                                onClick={() => setSelectedAlmacen('malvinas')}
                            >
                                <Store className="w-3.5 h-3.5" />
                                <span>Almacén Malvinas {selectedAlmacen === 'malvinas' && comparacionData.length > 0 ? `(${comparacionData.length})` : ''}</span>
                            </button>
                        </div>
                    </header>

                    {selectedAlmacen ? (
                        <div id="panel-comparacion">
                            <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2 text-[11px] text-gray-600">
                                            <span className="font-medium text-gray-400">Almacén:</span>
                                            <b className="uppercase text-[#0B3B8C] bg-white px-2 py-0.5 rounded-lg shadow-sm border border-gray-100 uppercase uppercase">CALLAO</b>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-gray-600">
                                            <span className="font-medium text-gray-400">Inventario:</span>
                                            <b className="text-[#0B3B8C] bg-white px-2 py-0.5 rounded-lg shadow-sm border border-gray-100">{state.sesionActual.numero || '-'}</b>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-gray-600">
                                            <span className="font-medium text-gray-400">Inicio:</span>
                                            <b className="text-[#0B3B8C] bg-white px-2 py-0.5 rounded-lg shadow-sm border border-gray-100">{state.sesionActual.inicio || '-'}</b>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-gray-600">
                                            <span className="font-medium text-gray-400">Registros:</span>
                                            <b className="text-[#0B3B8C] bg-white px-2 py-0.5 rounded-lg shadow-sm border border-gray-100">{comparacionData.length}</b>
                                        </div>
                                    </div>


                                    <div className="flex items-center gap-3">
                                        <div className="btn-group flex p-1 bg-white rounded-full shadow-sm border border-gray-200">
                                            <button
                                                onClick={handleDownloadPDF}
                                                className="flex items-center gap-2 px-3 py-1 text-[10px] font-bold text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                                            >
                                                <FileDown className="w-3.5 h-3.5" /> PDF
                                            </button>
                                            <button
                                                onClick={handleDownloadExcel}
                                                className="flex items-center gap-2 px-3 py-1 text-[10px] font-bold text-[#198754] hover:bg-green-50 rounded-full transition-colors"
                                            >
                                                <FileDown className="w-3.5 h-3.5" /> Excel
                                            </button>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="bg-white border-2 border-gray-200 text-[11px] rounded-xl block w-96 px-4 py-1.5 focus:border-[#0B3B8C] outline-none transition-all shadow-sm"
                                                placeholder="Buscar..."
                                                value={filterText}
                                                onChange={(e) => setFilterText(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-4 pt-4 border-t border-gray-200/60">
                                    <div className="bg-slate-50 text-slate-700 border border-slate-100 px-4 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-3 shadow-sm">
                                        <div className="w-8 h-1.5 bg-slate-400 rounded-full"></div>
                                        Total: {resumen?.total_productos || 0}
                                    </div>
                                    <div className="bg-green-50 text-green-700 border border-green-100 px-4 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-3 shadow-sm">
                                        <div className="w-8 h-1.5 bg-green-400 rounded-full"></div>
                                        Correctos: {resumen?.conformes ?? 0}
                                    </div>
                                    <div className="bg-red-50 text-red-700 border border-red-100 px-4 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-3 shadow-sm">
                                        <div className="w-8 h-1.5 bg-red-400 rounded-full"></div>
                                        Faltantes: {resumen?.faltantes ?? 0}
                                    </div>
                                    <div className="bg-yellow-50 text-yellow-700 border border-yellow-100 px-4 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-3 shadow-sm">
                                        <div className="w-8 h-1.5 bg-yellow-400 rounded-full"></div>
                                        Sobrantes: {resumen?.sobrantes ?? 0}
                                    </div>
                                    <div className="bg-blue-50 text-blue-700 border border-blue-100 px-4 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-3 shadow-sm">
                                        <div className="w-8 h-1.5 bg-blue-400 rounded-full"></div>
                                        Sin Conteo: {resumen?.sin_conteo ?? 0}
                                    </div>

                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white">Item</th>
                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white">Producto</th>
                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white">Código</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">Cant. Sistema</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">Cant. Física</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">Resultado</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">Estado</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white sticky right-0 z-20" style={{ backgroundColor: '#002D5A' }}>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {loading ? (
                                                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">Cargando datos...</td></tr>
                                            ) : filteredData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-4 py-16 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <Upload className="w-12 h-12 text-gray-300" />
                                                            <div className="text-sm font-medium text-gray-600">No hay datos de comparación para este almacén</div>
                                                            <div className="text-xs text-gray-400 max-w-md">
                                                                Para generar la comparación, primero debes subir el archivo Excel del sistema usando el botón
                                                                <span className="font-bold text-[#0B3B8C]"> &quot;Subir Sistema {selectedAlmacen === 'callao' ? 'Callao' : 'Malvinas'}&quot;</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>

                                            ) : (
                                                filteredData.map((item) => (
                                                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                                        <td className="px-3 py-2 text-gray-600 text-[11px] font-mono">{item.item}</td>
                                                        <td className="px-3 py-2 text-gray-800 text-[11px] font-medium">{item.producto}</td>
                                                        <td className="px-3 py-2 text-gray-600 text-[11px] font-mono">{item.codigo}</td>
                                                        <td className="px-3 py-2 text-center font-bold text-gray-700 bg-gray-50 text-[11px]">{item.cantidad_sistema}</td>
                                                        <td className="px-3 py-2 text-center font-bold text-blue-700 bg-blue-50/30 text-[11px]">{item.cantidad_fisica}</td>
                                                        <td className={`px-3 py-2 text-center font-bold text-[11px] ${item.estado === 'SISTEMA' ? 'text-blue-400 font-medium italic' :
                                                            item.resultado === 0 ? 'text-green-600' :
                                                                item.resultado < 0 ? 'text-red-600' : 'text-yellow-600'
                                                            }`}>
                                                            {item.estado === 'SISTEMA' ? 'Pendiente' : (item.resultado > 0 ? `+${item.resultado}` : item.resultado)}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${item.estado === 'CONFORME' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                item.estado === 'FALTANTE' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                    item.estado === 'SISTEMA' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                                }`}>
                                                                {item.estado === 'SISTEMA' ? 'SIN CONTEO' : item.estado}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-center relative sticky right-0 bg-white/90 backdrop-blur-sm z-10 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (openActionId === item.id) {
                                                                        setOpenActionId(null);
                                                                        setMenuPosition(null);
                                                                    } else {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        setOpenActionId(item.id);
                                                                        setSelectedItem(item);
                                                                        setMenuPosition({ top: rect.bottom + 4, left: rect.right - 192 });
                                                                    }
                                                                }}
                                                                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-700 transition-colors"
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </button>

                                                            {openActionId === item.id && menuPosition && createPortal(
                                                                <div
                                                                    style={{
                                                                        position: 'fixed',
                                                                        top: menuPosition.top,
                                                                        left: menuPosition.left,
                                                                        zIndex: 99999
                                                                    }}
                                                                    className="w-48 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 origin-top-right"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <button
                                                                        onClick={() => { handleActionClick(item, 'fisico'); setOpenActionId(null); setMenuPosition(null); }}
                                                                        className="w-full text-left px-4 py-3 text-[11px] font-bold hover:bg-gray-50 text-gray-700 flex items-center gap-3 border-b border-gray-50 transition-colors"
                                                                    >
                                                                        <Edit className="w-4 h-4 text-blue-600" />
                                                                        <span>Editar Cantidad (Físico)</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { handleActionClick(item, 'sistema'); setOpenActionId(null); setMenuPosition(null); }}
                                                                        className="w-full text-left px-4 py-3 text-[11px] font-bold hover:bg-gray-50 text-gray-700 flex items-center gap-3 border-b border-gray-50 transition-colors"
                                                                    >
                                                                        <Upload className="w-4 h-4 text-orange-600" />
                                                                        <span>Editar Sistema</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { handleActionClick(item, 'verificacion'); setOpenActionId(null); setMenuPosition(null); }}
                                                                        className="w-full text-left px-4 py-3 text-[11px] font-bold hover:bg-gray-50 text-gray-700 flex items-center gap-3 transition-colors"
                                                                    >
                                                                        <ClipboardCheck className="w-4 h-4 text-green-600" />
                                                                        <span>Verificación</span>
                                                                    </button>
                                                                </div>,
                                                                document.body
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

                    {/* History Section - Moved inside panel-comparacion */}
                    {selectedAlmacen && (
                        <div className="mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                            {/* Corporate Header - Matching Comparison Style */}
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-[#002D5A] to-[#002D5A] rounded-xl flex items-center justify-center text-white shadow-sm transition-all duration-200">
                                    <History className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="font-bold text-gray-900 m-0" style={{ fontFamily: 'var(--font-poppins)', fontSize: '22px' }}>Historial de Movimientos</h1>
                                    <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: 'var(--font-poppins)' }}>Auditoría de cambios y registros históricos detallados por almacén</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* 1. Historial Físico */}
                                <div className="space-y-3">
                                    <div className="ml-1 mb-2">
                                        <h3 className="font-bold text-[#002D5A] text-[15px]">Historial de movimientos físicos</h3>
                                    </div>
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden transition-all duration-300">
                                        <div className="overflow-hidden">
                                            <table className="w-full table-auto">
                                                <thead>
                                                    <tr className="border-b-[4px]" style={{ backgroundColor: 'rgb(0, 45, 90)', borderColor: 'rgb(244, 180, 0)' }}>
                                                        <th className="px-2 py-3 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ID</th>
                                                        <th className="px-2 py-3 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ALMACÉN</th>
                                                        <th className="px-2 py-3 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">PRODUCTO</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">CANT. INI.</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">CANT. NUE.</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">MOTIVO</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">REGISTRADO POR</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">OBS.</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">FECHA / HORA</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {(() => {
                                                        const filtered = historyData.filter(h => h.tipo_accion === 'EDITAR_CANTIDAD_FISICA' && h.almacen === selectedAlmacen);
                                                        const paginated = filtered.slice((currentPageFisico - 1) * itemsPerPage, currentPageFisico * itemsPerPage);

                                                        if (filtered.length === 0) {
                                                            return (
                                                                <tr style={{ backgroundColor: 'rgb(243, 251, 233)' }}>
                                                                    <td colSpan={9} className="px-3 py-6 text-center text-[10px] font-bold italic" style={{ color: 'rgb(91, 152, 27)' }}>SIN MOVIMIENTOS REGISTRADOS</td>
                                                                </tr>
                                                            );
                                                        }

                                                        return paginated.map((item, idx) => {
                                                            const { date, time } = formatHistoryDate(item.fecha_hora_raw);
                                                            const detCurrent = typeof item.detalles === 'string' ? JSON.parse(item.detalles) : item.detalles;
                                                            return (
                                                                <tr key={item.id} className="border-b border-gray-100 hover:bg-white/50 transition-all duration-200" style={{ backgroundColor: 'rgb(243, 251, 233)' }}>
                                                                    <td className="px-2 py-2 whitespace-nowrap text-[9px] font-bold text-center" style={{ color: 'rgb(91, 152, 27)' }}>{item.id}</td>
                                                                    <td className="px-2 py-2 whitespace-nowrap text-[9px] uppercase font-bold text-center" style={{ color: 'rgb(91, 152, 27)' }}>{item.almacen}</td>
                                                                    <td className="px-2 py-2" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        <div className="text-[9px] font-bold leading-tight uppercase">{item.producto}</div>
                                                                        <div className="text-[8px] opacity-70 font-mono mt-0.5">{item.codigo}</div>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center text-[10px] font-bold" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        {detCurrent?.cantidad_anterior ?? '-'}
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center text-[10px] font-black" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        {detCurrent?.cantidad_nueva ?? item.cantidad}
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center">
                                                                        <button
                                                                            onClick={() => setModalText({ title: 'Motivo del Movimiento', content: item.motivo || 'Sin motivo' })}
                                                                            className="p-1.5 bg-green-50 border border-green-200 hover:bg-green-100 rounded-full text-green-600 transition-all shadow-sm active:scale-95"
                                                                        >
                                                                            <ClipboardCheck className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        <span className="font-bold text-[9px] uppercase">
                                                                            {item.registrado_por || 'SISTEMA'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center">
                                                                        <button
                                                                            onClick={() => {
                                                                                const obs = item.observaciones || detCurrent?.observaciones || 'Sin observaciones';
                                                                                setModalText({ title: 'Observaciones', content: obs });
                                                                            }}
                                                                            className="p-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-full text-blue-600 transition-all shadow-sm active:scale-95"
                                                                        >
                                                                            <Eye className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center whitespace-nowrap text-[9px] font-medium" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        {date} <br /> {time}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                        {/* Pagination Controls */}
                                        {(() => {
                                            const filtered = historyData.filter(h => h.tipo_accion === 'EDITAR_CANTIDAD_FISICA' && h.almacen === selectedAlmacen);
                                            const totalPages = Math.ceil(filtered.length / itemsPerPage);
                                            if (totalPages <= 1) return null;
                                            return (
                                                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setCurrentPageFisico(1)}
                                                            disabled={currentPageFisico === 1}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">«</button>
                                                        <button
                                                            onClick={() => setCurrentPageFisico(prev => Math.max(prev - 1, 1))}
                                                            disabled={currentPageFisico === 1}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">&lt;</button>
                                                    </div>
                                                    <span className="text-xs text-gray-700 font-black">Página {currentPageFisico} de {totalPages}</span>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setCurrentPageFisico(prev => Math.min(prev + 1, totalPages))}
                                                            disabled={currentPageFisico === totalPages}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">&gt;</button>
                                                        <button
                                                            onClick={() => setCurrentPageFisico(totalPages)}
                                                            disabled={currentPageFisico === totalPages}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">»</button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* 2. Historial Sistema */}
                                <div className="space-y-3 pt-4">
                                    <div className="ml-1 mb-2">
                                        <h3 className="font-bold text-amber-900 text-[15px]">Historial de ajustes del sistema</h3>
                                    </div>
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden transition-all duration-300">
                                        <div className="overflow-hidden">
                                            <table className="w-full table-auto">
                                                <thead>
                                                    <tr className="border-b-[4px]" style={{ backgroundColor: 'rgb(0, 45, 90)', borderColor: 'rgb(244, 180, 0)' }}>
                                                        <th className="px-2 py-3 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ID</th>
                                                        <th className="px-2 py-3 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ALMACÉN</th>
                                                        <th className="px-2 py-3 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">PRODUCTO</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">CANT. INI.</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">CANT. NUE.</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">MOTIVO</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">REGISTRADO POR</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">OBS.</th>
                                                        <th className="px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">FECHA / HORA</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {(() => {
                                                        const filtered = historyData.filter(h => h.tipo_accion === 'EDITAR_CANTIDAD_SISTEMA' && h.almacen === selectedAlmacen);
                                                        const paginated = filtered.slice((currentPageSistema - 1) * itemsPerPage, currentPageSistema * itemsPerPage);

                                                        if (filtered.length === 0) {
                                                            return (
                                                                <tr style={{ backgroundColor: 'rgb(243, 251, 233)' }}>
                                                                    <td colSpan={9} className="px-3 py-6 text-center text-[10px] font-bold italic" style={{ color: 'rgb(91, 152, 27)' }}>SIN MOVIMIENTOS REGISTRADOS</td>
                                                                </tr>
                                                            );
                                                        }

                                                        return paginated.map((item, idx) => {
                                                            const { date, time } = formatHistoryDate(item.fecha_hora_raw);
                                                            const detCurrent = typeof item.detalles === 'string' ? JSON.parse(item.detalles) : item.detalles;
                                                            return (
                                                                <tr key={item.id} className="border-b border-gray-100 hover:bg-white/50 transition-all duration-200" style={{ backgroundColor: 'rgb(243, 251, 233)' }}>
                                                                    <td className="px-2 py-2 whitespace-nowrap text-[9px] font-bold text-center" style={{ color: 'rgb(91, 152, 27)' }}>{item.id}</td>
                                                                    <td className="px-2 py-2 whitespace-nowrap text-[9px] uppercase font-bold text-center" style={{ color: 'rgb(91, 152, 27)' }}>{item.almacen}</td>
                                                                    <td className="px-2 py-2" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        <div className="text-[9px] font-bold leading-tight uppercase">{item.producto}</div>
                                                                        <div className="text-[8px] opacity-70 font-mono mt-0.5">{item.codigo}</div>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center text-[10px] font-bold" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        {detCurrent?.cantidad_anterior ?? '-'}
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center text-[10px] font-black" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        {detCurrent?.cantidad_nueva ?? item.cantidad}
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center">
                                                                        <button
                                                                            onClick={() => setModalText({ title: 'Motivo del Movimiento', content: item.motivo || 'Sin motivo' })}
                                                                            className="p-1.5 bg-green-50 border border-green-200 hover:bg-green-100 rounded-full text-green-600 transition-all shadow-sm active:scale-95"
                                                                        >
                                                                            <ClipboardCheck className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        <span className="font-bold text-[9px] uppercase">
                                                                            {item.registrado_por || 'SISTEMA'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center">
                                                                        <button
                                                                            onClick={() => {
                                                                                const obs = item.observaciones || detCurrent?.observaciones || 'Sin observaciones';
                                                                                setModalText({ title: 'Observaciones', content: obs });
                                                                            }}
                                                                            className="p-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-full text-blue-600 transition-all shadow-sm active:scale-95"
                                                                        >
                                                                            <Eye className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-center whitespace-nowrap text-[9px] font-medium" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        {date} <br /> {time}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                        {/* Pagination Controls */}
                                        {(() => {
                                            const filtered = historyData.filter(h => h.tipo_accion === 'EDITAR_CANTIDAD_SISTEMA' && h.almacen === selectedAlmacen);
                                            const totalPages = Math.ceil(filtered.length / itemsPerPage);
                                            if (totalPages <= 1) return null;
                                            return (
                                                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setCurrentPageSistema(1)}
                                                            disabled={currentPageSistema === 1}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">«</button>
                                                        <button
                                                            onClick={() => setCurrentPageSistema(prev => Math.max(prev - 1, 1))}
                                                            disabled={currentPageSistema === 1}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">&lt;</button>
                                                    </div>
                                                    <span className="text-xs text-gray-700 font-black">Página {currentPageSistema} de {totalPages}</span>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setCurrentPageSistema(prev => Math.min(prev + 1, totalPages))}
                                                            disabled={currentPageSistema === totalPages}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">&gt;</button>
                                                        <button
                                                            onClick={() => setCurrentPageSistema(totalPages)}
                                                            disabled={currentPageSistema === totalPages}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">»</button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* 3. Historial Verificación */}
                                <div className="space-y-3 pt-4">
                                    <div className="ml-1 mb-2">
                                        <h3 className="font-bold text-emerald-900 text-[15px]">Historial de verificación técnica</h3>
                                    </div>
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden transition-all duration-300">
                                        <div className="overflow-hidden">
                                            <table className="w-full table-auto">
                                                <thead>
                                                    <tr className="border-b-[4px]" style={{ backgroundColor: 'rgb(0, 45, 90)', borderColor: 'rgb(244, 180, 0)' }}>
                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ID</th>
                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ALMACEN</th>
                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">PRODUCTO</th>
                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">NÚMERO ACTA</th>
                                                        <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">REGISTRADO POR</th>
                                                        <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">OBS.</th>
                                                        <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">FECHA / HORA</th>
                                                        <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">DETALLE</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {(() => {
                                                        const filtered = historyData.filter(h => h.tipo_accion === 'VERIFICACION' && h.almacen === selectedAlmacen);
                                                        const paginated = filtered.slice((currentPageVerificacion - 1) * itemsPerPage, currentPageVerificacion * itemsPerPage);

                                                        if (filtered.length === 0) {
                                                            return (
                                                                <tr style={{ backgroundColor: 'rgb(243, 251, 233)' }}>
                                                                    <td colSpan={8} className="px-3 py-6 text-center text-[10px] font-black italic uppercase" style={{ color: 'rgb(91, 152, 27)' }}>SIN VERIFICACIONES REGISTRADAS</td>
                                                                </tr>
                                                            );
                                                        }

                                                        return paginated.map((item, idx) => {
                                                            const { date, time } = formatHistoryDate(item.fecha_hora_raw);
                                                            const det = typeof item.detalles === 'string' ? {} : (item.detalles || {});

                                                            return (
                                                                <tr key={item.id} className="border-b border-gray-100 hover:bg-white/50 transition-all duration-200" style={{ backgroundColor: 'rgb(243, 251, 233)' }}>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-[9px] font-bold text-center" style={{ color: 'rgb(91, 152, 27)' }}>{item.id}</td>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-[9px] uppercase font-bold text-center" style={{ color: 'rgb(91, 152, 27)' }}>{item.almacen}</td>
                                                                    <td className="px-3 py-2" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        <div className="text-[9px] font-bold leading-tight uppercase">{item.producto}</div>
                                                                        <div className="text-[8px] opacity-70 font-mono mt-0.5">{item.codigo}</div>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center text-[10px] font-bold" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        {det.numero_acta || '-'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        <span className="font-bold text-[9px] uppercase">
                                                                            {item.registrado_por || 'SISTEMA'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <button
                                                                            onClick={() => {
                                                                                const obs = item.observaciones || det.obs_verificacion || 'Sin observaciones';
                                                                                setModalText({ title: 'Observaciones de Verificación', content: obs });
                                                                            }}
                                                                            className="p-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-full text-blue-600 transition-all shadow-sm active:scale-95"
                                                                        >
                                                                            <Eye className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center whitespace-nowrap text-[9px] font-medium" style={{ color: 'rgb(91, 152, 27)' }}>
                                                                        {date} <br /> {time}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <button
                                                                            onClick={() => setVerificacionDetalle(item)}
                                                                            className="p-1.5 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-full text-purple-600 transition-all shadow-sm active:scale-95"
                                                                        >
                                                                            <FileText className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                        {/* Pagination Controls */}
                                        {(() => {
                                            const filtered = historyData.filter(h => h.tipo_accion === 'VERIFICACION' && h.almacen === selectedAlmacen);
                                            const totalPages = Math.ceil(filtered.length / itemsPerPage);
                                            if (totalPages <= 1) return null;
                                            return (
                                                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setCurrentPageVerificacion(1)}
                                                            disabled={currentPageVerificacion === 1}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">«</button>
                                                        <button
                                                            onClick={() => setCurrentPageVerificacion(prev => Math.max(prev - 1, 1))}
                                                            disabled={currentPageVerificacion === 1}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">&lt;</button>
                                                    </div>
                                                    <span className="text-xs text-gray-700 font-black">Página {currentPageVerificacion} de {totalPages}</span>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setCurrentPageVerificacion(prev => Math.min(prev + 1, totalPages))}
                                                            disabled={currentPageVerificacion === totalPages}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">&gt;</button>
                                                        <button
                                                            onClick={() => setCurrentPageVerificacion(totalPages)}
                                                            disabled={currentPageVerificacion === totalPages}
                                                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">»</button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                    }
                </div >
            </div >

            {/* Password Modal */}
            {/* Password Modal */}
            {
                showPasswordModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                            <div className="p-8 text-center space-y-6">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600 shadow-sm border border-blue-100">
                                    <ShieldCheck className="w-8 h-8" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Seguridad Requerida</h1>
                                    <p className="text-sm text-gray-500 font-medium">Ingrese la contraseña del jefe para continuar con la verificación técnica</p>
                                </div>
                                <div className="relative group">
                                    {/* Hack para evitar autofill */}
                                    <input type="password" style={{ display: 'none' }} />
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        name="password_field_no_autofill"
                                        className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-center text-2xl font-black tracking-[0.5em] focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:text-gray-300 placeholder:tracking-normal"
                                        placeholder="••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handlePasswordConfirm()}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowPasswordModal(false)}
                                        className="flex-1 px-6 py-3.5 bg-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-200 transition-all uppercase text-xs tracking-wider"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handlePasswordConfirm}
                                        className="flex-1 px-6 py-3.5 bg-[#0B3B8C] text-white font-black rounded-2xl hover:bg-blue-900 transition-all shadow-lg hover:shadow-blue-200 uppercase text-xs tracking-wider"
                                    >
                                        Verificar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modals Overlay */}
            {
                activeModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20">
                                <h3 className="text-[17px] font-black text-gray-800 flex items-center gap-2">
                                    <ClipboardCheck className="w-6 h-6 text-blue-600" />
                                    <span className="uppercase tracking-tight">{activeModal === 'verificacion' ? 'Editar Verificación' : 'Editar Cantidades'}</span>
                                </h3>
                                <button onClick={() => setActiveModal(null)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Product Info (Readonly) */}
                                <div className="grid grid-cols-2 gap-4 bg-[#F8FAFF] p-3 rounded-xl border-2 border-[#E9F1FF]">
                                    <div>
                                        <label className="text-[10px] font-black text-[#0B3B8C] uppercase tracking-wider mb-0.5 block">Producto en Evaluación</label>
                                        <p className="font-black text-gray-900 text-[15px] leading-tight">{selectedItem?.producto}</p>
                                    </div>
                                    <div className="text-right">
                                        <label className="text-[10px] font-black text-[#0B3B8C] uppercase tracking-wider mb-0.5 block">Código de Serie</label>
                                        <p className="font-mono font-black text-blue-700 text-[15px]">{selectedItem?.codigo}</p>
                                    </div>
                                </div>

                                {/* Forms */}
                                {(activeModal === 'fisico' || activeModal === 'sistema') && (
                                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="relative">
                                                <label className="absolute -top-2.5 left-3 px-1.5 bg-white text-[10px] font-black text-gray-400 uppercase tracking-wider">Cantidad Nueva</label>
                                                <input
                                                    type="number"
                                                    className="w-full p-2.5 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none font-black text-gray-700 text-sm transition-all"
                                                    value={editForm.cantidad}
                                                    onChange={(e) => setEditForm({ ...editForm, cantidad: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div className="relative">
                                                <label className="absolute -top-2.5 left-3 px-1.5 bg-white text-[10px] font-black text-gray-400 uppercase tracking-wider">Motivo de Ajuste</label>
                                                {activeModal === 'fisico' ? (
                                                    <select
                                                        className="w-full p-2.5 border-2 border-gray-100 rounded-xl bg-white font-black text-gray-700 outline-none focus:border-blue-500 appearance-none transition-all text-sm"
                                                        value={editForm.motivo_tipo}
                                                        onChange={(e) => setEditForm({ ...editForm, motivo_tipo: e.target.value, motivo: e.target.value !== 'otro' ? e.target.value : '' })}
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        <option value="Error de conteo">Error de conteo</option>
                                                        <option value="otro">Otro Motivo</option>
                                                    </select>
                                                ) : (
                                                    <select
                                                        className="w-full p-2.5 border-2 border-gray-100 rounded-xl bg-white font-black text-gray-700 outline-none focus:border-blue-500 appearance-none transition-all text-sm"
                                                        value={editForm.motivo_tipo}
                                                        onChange={(e) => setEditForm({ ...editForm, motivo_tipo: e.target.value, motivo: e.target.value !== 'otro' ? e.target.value : '' })}
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        <option value="Una compra">Una compra</option>
                                                        <option value="Una venta">Una venta</option>
                                                        <option value="otro">Otro Motivo</option>
                                                    </select>
                                                )}
                                            </div>
                                        </div>

                                        {editForm.motivo_tipo === 'otro' && (
                                            <div className="relative animate-in slide-in-from-top-2 duration-200">
                                                <label className="absolute -top-2.5 left-3 px-1.5 bg-white text-[10px] font-black text-gray-400 uppercase tracking-wider">Especifique Motivo</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2.5 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none font-black text-gray-700 transition-all border-dashed text-sm"
                                                    value={editForm.motivo}
                                                    onChange={(e) => setEditForm({ ...editForm, motivo: e.target.value })}
                                                />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="relative">
                                                <label className="absolute -top-2.5 left-3 px-1.5 bg-white text-[10px] font-black text-gray-400 uppercase tracking-wider">Operador Responsable</label>
                                                <select
                                                    className="w-full p-2.5 border-2 border-gray-100 rounded-xl bg-white font-black text-gray-700 outline-none focus:border-blue-500 appearance-none transition-all text-sm"
                                                    value={editForm.registrado_por}
                                                    onChange={(e) => setEditForm({ ...editForm, registrado_por: e.target.value })}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    <option value="Joseph">Joseph</option>
                                                    <option value="Joselyn">Joselyn</option>
                                                    <option value="Otros">Otros</option>
                                                </select>
                                            </div>
                                            <div className="relative">
                                                <label className="absolute -top-2.5 left-3 px-1.5 bg-white text-[10px] font-black text-gray-400 uppercase tracking-wider">Origen del Error</label>
                                                <select
                                                    className="w-full p-2.5 border-2 border-gray-100 rounded-xl bg-white font-black text-gray-700 outline-none focus:border-blue-500 appearance-none transition-all text-sm"
                                                    value={editForm.error_de}
                                                    onChange={(e) => setEditForm({ ...editForm, error_de: e.target.value })}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    <option value="Joseph">Joseph</option>
                                                    <option value="Joselyn">Joselyn</option>
                                                    <option value="Otros">Otros</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <label className="absolute -top-2.5 left-3 px-1.5 bg-white text-[10px] font-black text-gray-400 uppercase tracking-wider">Notas y Observaciones</label>
                                            <textarea
                                                className="w-full p-3 border-2 border-gray-100 rounded-xl h-24 font-medium text-gray-600 outline-none focus:border-blue-500 transition-all resize-none text-sm"
                                                value={editForm.observaciones}
                                                onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                                                placeholder="Detalle cualquier información relevante aquí..."
                                            ></textarea>
                                        </div>
                                    </div>
                                )}

                                {activeModal === 'verificacion' && (
                                    <div className="space-y-6 animate-in fade-in duration-500">
                                        {/* SECTION 1: COMPRAS */}
                                        <div className="bg-white border-2 border-gray-100 rounded-[18px] overflow-hidden shadow-sm transition-all hover:shadow-md">
                                            <div className="bg-[#0061F2] p-2 px-4 font-black text-white text-[11px] uppercase flex items-center gap-2">
                                                <div className="w-6 h-2 bg-white/30 rounded-full"></div>
                                                1. SECCIÓN COMPRAS
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="relative group">
                                                        <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-all">Fecha ingreso</label>
                                                        <input type="date" className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-[12px] font-black text-gray-700 outline-none focus:border-[#0061F2] h-[40px] transition-all bg-white"
                                                            value={verificacionForm.fecha_ingreso_compra}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, fecha_ingreso_compra: e.target.value })} />
                                                    </div>
                                                    <div className="relative group">
                                                        <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-all">Hora ingreso</label>
                                                        <input type="time" className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-[12px] font-black text-gray-700 outline-none focus:border-[#0061F2] h-[40px] transition-all bg-white"
                                                            value={verificacionForm.hora_ingreso_compra}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, hora_ingreso_compra: e.target.value })} />
                                                    </div>
                                                </div>
                                                <div className="relative group">
                                                    <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-all">Número de acta</label>
                                                    <input type="text" className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-[12px] font-black text-gray-700 outline-none focus:border-[#0061F2] h-[40px] transition-all bg-white"
                                                        value={verificacionForm.numero_acta}
                                                        onChange={(e) => setVerificacionForm({ ...verificacionForm, numero_acta: e.target.value })} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="relative group">
                                                        <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-all">Fecha descarga</label>
                                                        <input type="date" className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-[12px] font-black text-gray-700 outline-none focus:border-[#0061F2] h-[40px] transition-all bg-white"
                                                            value={verificacionForm.fecha_descarga_compra}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, fecha_descarga_compra: e.target.value })} />
                                                    </div>
                                                    <div className="relative group">
                                                        <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-all">Hora descarga</label>
                                                        <input type="time" className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-[12px] font-black text-gray-700 outline-none focus:border-[#0061F2] h-[40px] transition-all bg-white"
                                                            value={verificacionForm.hora_descarga_compra}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, hora_descarga_compra: e.target.value })} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SECTION 2: VENTAS */}
                                        <div className="bg-white border-2 border-gray-100 rounded-[18px] overflow-hidden shadow-sm transition-all hover:shadow-md">
                                            <div className="bg-[#6610f2] p-2 px-4 font-black text-white text-[11px] uppercase flex items-center gap-2">
                                                <div className="w-6 h-2 bg-white/30 rounded-full"></div>
                                                2. SECCIÓN VENTAS
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="relative group">
                                                        <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#6610f2] transition-all">Fecha descarga ventas</label>
                                                        <input type="date" className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-[12px] font-black text-gray-700 outline-none focus:border-[#6610f2] h-[40px] transition-all bg-white"
                                                            value={verificacionForm.fecha_descarga_ventas}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, fecha_descarga_ventas: e.target.value })} />
                                                    </div>
                                                    <div className="relative group">
                                                        <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#6610f2] transition-all">Hora descarga ventas</label>
                                                        <input type="time" className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-[12px] font-black text-gray-700 outline-none focus:border-[#6610f2] h-[40px] transition-all bg-white"
                                                            value={verificacionForm.hora_descarga_ventas}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, hora_descarga_ventas: e.target.value })} />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="relative group">
                                                        <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#6610f2] transition-all">Fecha descarga sistema</label>
                                                        <input type="date" className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-[12px] font-black text-gray-700 outline-none focus:border-[#6610f2] h-[40px] transition-all bg-white"
                                                            value={verificacionForm.fecha_descarga_sistema}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, fecha_descarga_sistema: e.target.value })} />
                                                    </div>
                                                    <div className="relative group">
                                                        <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#6610f2] transition-all">Hora descarga sistema</label>
                                                        <input type="time" className="w-full p-2.5 border-2 border-gray-100 rounded-xl text-[12px] font-black text-gray-700 outline-none focus:border-[#6610f2] h-[40px] transition-all bg-white"
                                                            value={verificacionForm.hora_descarga_sistema}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, hora_descarga_sistema: e.target.value })} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SECTION 2: RESULTADO GENERAL */}
                                        <div className="bg-white border-2 border-gray-100 rounded-[18px] overflow-hidden shadow-sm">
                                            <div className="bg-[#FFC107] p-2 px-4 font-black text-gray-900 text-[11px] uppercase flex items-center gap-2">
                                                <div className="w-6 h-2 bg-gray-900/20 rounded-full"></div>
                                                RESULTADO GENERAL
                                            </div>
                                            <div className="p-4 grid grid-cols-3 gap-4">
                                                <div className="relative group">
                                                    <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#FFC107] transition-all">Compras Totales</label>
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 border-2 border-gray-100 rounded-lg text-[13px] font-black text-gray-700 focus:border-[#FFC107] outline-none transition-all h-[40px] bg-white text-center"
                                                        value={verificacionForm.compras_totales || ''}
                                                        onChange={(e) => setVerificacionForm({ ...verificacionForm, compras_totales: Number(e.target.value) })}
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="relative group">
                                                    <label className="absolute -top-2 left-4 px-2 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#FFC107] transition-all">Ventas Totales</label>
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 border-2 border-gray-100 rounded-lg text-[13px] font-black text-gray-700 focus:border-[#FFC107] outline-none transition-all h-[40px] bg-white text-center"
                                                        value={verificacionForm.ventas_totales || ''}
                                                        onChange={(e) => setVerificacionForm({ ...verificacionForm, ventas_totales: Number(e.target.value) })}
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="bg-[#FEFCE8] border-2 border-amber-100/50 p-2.5 rounded-xl relative flex flex-col justify-center items-start shadow-sm min-h-[48px]">
                                                    <label className="text-[9px] text-amber-800 font-bold uppercase absolute top-1.5 left-3 tracking-widest opacity-40">Stock de Existencias</label>
                                                    <span className="text-[20px] font-black text-amber-900 mt-3 ml-1 leading-none">
                                                        {(verificacionForm.compras_totales || 0) - (verificacionForm.ventas_totales || 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SECTION 3: RESULTADO DE VERIFICACIÓN */}
                                        <div className="bg-white border-2 border-gray-100 rounded-[18px] overflow-hidden shadow-sm">
                                            <div className="bg-[#198754] p-2 px-4 font-black text-white text-[11px] uppercase flex items-center gap-2">
                                                <div className="w-6 h-2 bg-white/30 rounded-full"></div>
                                                RESULTADO DE VERIFICACIÓN
                                            </div>
                                            <div className="p-4 grid grid-cols-3 gap-4 items-center">
                                                {(() => {
                                                    // Usar Number() para asegurar cálculos correctos
                                                    const compras = Number(verificacionForm.compras_totales || 0);
                                                    const ventas = Number(verificacionForm.ventas_totales || 0);
                                                    const stockExistencia = compras - ventas;

                                                    const stockFisico = Number(selectedItem?.cantidad_fisica || 0);
                                                    const stockSistema = Number(selectedItem?.cantidad_sistema || 0);

                                                    let estado = '';
                                                    let colorClass = '';
                                                    let cardFisicoClass = 'bg-white text-gray-900';
                                                    let cardSistemaClass = 'bg-white text-gray-900';

                                                    const matchFisico = Math.abs(stockExistencia - stockFisico) < 0.01;
                                                    const matchSistema = Math.abs(stockExistencia - stockSistema) < 0.01;

                                                    if (matchFisico && matchSistema) {
                                                        estado = 'CONFORME';
                                                        colorClass = 'bg-[#198754] border-[#13653f] shadow-emerald-100 text-white';
                                                        cardFisicoClass = 'bg-[#F0FDF4] border-emerald-200 text-emerald-900';
                                                        cardSistemaClass = 'bg-[#F0FDF4] border-emerald-200 text-emerald-900';
                                                    } else if (matchFisico && !matchSistema) {
                                                        estado = 'ERROR DE SISTEMA';
                                                        colorClass = 'bg-[#FFC107] border-[#d39e00] shadow-amber-100 text-gray-900';
                                                        cardFisicoClass = 'bg-[#F0FDF4] border-emerald-200 text-emerald-900 font-black';
                                                        cardSistemaClass = 'bg-red-50 border-red-200 text-red-900 animate-pulse';
                                                    } else if (matchSistema && !matchFisico) {
                                                        estado = 'ERROR DE LOGÍSTICA';
                                                        colorClass = 'bg-[#DC3545] border-[#a71d2a] shadow-red-100 text-white';
                                                        cardSistemaClass = 'bg-[#F0FDF4] border-emerald-200 text-emerald-900 font-black';
                                                        cardFisicoClass = 'bg-red-50 border-red-200 text-red-900 animate-pulse';
                                                    } else {
                                                        estado = 'REALIZAR NUEVO CONTEO';
                                                        colorClass = 'bg-[#007BFF] border-[#0056b3] shadow-blue-100 text-white';
                                                        cardFisicoClass = 'bg-orange-50 border-orange-200 text-orange-900';
                                                        cardSistemaClass = 'bg-orange-50 border-orange-200 text-orange-900';
                                                    }

                                                    return (
                                                        <>
                                                            <div className={`${cardFisicoClass} border-2 p-2.5 rounded-xl relative flex flex-col justify-center items-start shadow-sm min-h-[60px] transition-all`}>
                                                                <label className={`text-[9px] uppercase absolute top-1.5 left-3 tracking-widest font-black opacity-40`}>Stock Físico</label>
                                                                <span className="text-[20px] font-black mt-3 ml-1 leading-none">
                                                                    {stockFisico.toLocaleString()}
                                                                </span>
                                                                {(estado === 'ERROR DE LOGÍSTICA' || estado === 'REALIZAR NUEVO CONTEO') && (
                                                                    <div className="absolute top-2 right-4">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className={`${cardSistemaClass} border-2 p-2.5 rounded-xl relative flex flex-col justify-center items-start shadow-sm min-h-[60px] transition-all`}>
                                                                <label className="text-[9px] uppercase absolute top-1.5 left-3 tracking-widest font-black opacity-40">Stock Sistema</label>
                                                                <span className="text-[20px] font-black mt-3 ml-1 leading-none">
                                                                    {stockSistema.toLocaleString()}
                                                                </span>
                                                                {(estado === 'ERROR DE SISTEMA' || estado === 'REALIZAR NUEVO CONTEO') && (
                                                                    <div className="absolute top-2 right-4">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-center">
                                                                <div className={`${colorClass} px-3 py-2 rounded-[12px] text-[10px] font-black uppercase tracking-[0.05em] shadow-lg border-b-4 flex items-center justify-center min-h-[48px] w-full text-center transition-all animate-in zoom-in duration-300 transform active:scale-95`}>
                                                                    {estado}
                                                                </div>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t-2 border-gray-100 bg-white rounded-b-2xl sticky bottom-0 z-30">
                                {activeModal === 'verificacion' && (
                                    <div className="flex justify-between items-center gap-4 mb-4">
                                        {/* Left side: PDF Download */}
                                        <div className="flex-shrink-0">
                                            <button
                                                onClick={() => window.open(`${API_BASE_URL}/?action=descargar_verificacion_pdf&id=${selectedItem?.id}`, '_blank')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-[#0B3B8C] text-[#0B3B8C] rounded-lg font-black hover:bg-blue-50 transition-all text-[10px] shadow-sm uppercase tracking-wide active:scale-95"
                                            >
                                                <FileDown className="w-3.5 h-3.5" />
                                                <span>PDF Reporte</span>
                                            </button>
                                        </div>

                                        {/* Right side: Responsable */}
                                        <div className="relative w-48">
                                            <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-wider">Responsable</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 bg-white border-2 border-gray-100 rounded-lg font-bold text-gray-700 outline-none focus:border-blue-500 transition-all text-[10px]"
                                                placeholder="Nombre del responsable"
                                                value={verificacionForm.registrado_por}
                                                onChange={(e) => setVerificacionForm({ ...verificacionForm, registrado_por: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Main Action Row */}
                                <div className={`flex justify-end gap-3 ${activeModal === 'verificacion' ? 'pt-4 border-t border-gray-100' : ''}`}>
                                    <button
                                        onClick={() => setActiveModal(null)}
                                        className="px-6 py-2 bg-gray-50 border border-gray-200 text-gray-500 font-black rounded-lg hover:bg-gray-100 hover:text-gray-600 transition-all text-[11px] uppercase tracking-wide active:scale-95"
                                    >
                                        Cerrar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (activeModal === 'verificacion') {
                                                handleSubmitVerification();
                                            } else {
                                                handleSubmitEdit();
                                            }
                                        }}
                                        className="px-8 py-2 bg-[#0B3B8C] text-white font-black rounded-lg hover:bg-blue-900 transition-all shadow-md flex items-center gap-2 text-[11px] uppercase tracking-widest active:scale-95"
                                    >
                                        <Save className="w-4 h-4" /> Guardar
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                )
            }
            {/* Text Detail Modal */}
            {modalText && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                            <h3 className="text-lg font-black text-[#0B3B8C] uppercase tracking-tight">{modalText.title}</h3>
                            <button
                                onClick={() => setModalText(null)}
                                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-8">
                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                {modalText.content}
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setModalText(null)}
                                className="px-8 py-3 bg-[#0B3B8C] text-white font-black rounded-2xl hover:bg-blue-900 transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Verification Modal */}
            {verificacionDetalle && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in slide-in-from-bottom-4 duration-400 border border-gray-100">
                        {/* Header - Changed to WHITE */}
                        <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-[#002D5A] uppercase tracking-tight">Detalle de Verificación Técnica</h3>
                                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                                        ID: {verificacionDetalle.id} | Almacén: {verificacionDetalle.almacen}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setVerificacionDetalle(null)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="px-5 py-3 overflow-y-auto max-h-[75vh]">
                            {/* Main Grid - Hyper-compact */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Section: Compras */}
                                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2 border-b border-gray-50 pb-1.5">
                                        <div className="w-1.5 h-3.5 bg-blue-500 rounded-full"></div>
                                        <h5 className="font-black text-gray-800 text-[10px] uppercase tracking-widest">COMPRAS</h5>
                                    </div>
                                    <div className="space-y-1.5">
                                        <DetailItem label="F. Ingreso" value={verificacionDetalle.detalles?.fecha_ingreso_compra} />
                                        <DetailItem label="H. Ingreso" value={verificacionDetalle.detalles?.hora_ingreso_compra} />
                                        <DetailItem label="F. Descarga" value={verificacionDetalle.detalles?.fecha_descarga_compra} />
                                        <DetailItem label="H. Descarga" value={verificacionDetalle.detalles?.hora_descarga_compra} />
                                        <div className="pt-1.5 mt-0.5 border-t border-gray-50">
                                            <DetailItem label="Total" value={verificacionDetalle.detalles?.compras_totales} isBadge highlight />
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Ventas y Sistema */}
                                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2 border-b border-gray-50 pb-1.5">
                                        <div className="w-1.5 h-3.5 bg-orange-500 rounded-full"></div>
                                        <h5 className="font-black text-gray-800 text-[10px] uppercase tracking-widest">VENTAS / SIS.</h5>
                                    </div>
                                    <div className="space-y-1.5">
                                        <DetailItem label="F. Vtas" value={verificacionDetalle.detalles?.fecha_descarga_ventas} />
                                        <DetailItem label="H. Vtas" value={verificacionDetalle.detalles?.hora_descarga_ventas} />
                                        <DetailItem label="F. Sis" value={verificacionDetalle.detalles?.fecha_descarga_sistema} />
                                        <DetailItem label="H. Sis" value={verificacionDetalle.detalles?.hora_descarga_sistema} />
                                        <div className="pt-1.5 mt-0.5 border-t border-gray-50">
                                            <DetailItem label="Total" value={verificacionDetalle.detalles?.ventas_totales} isBadge highlight />
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Balances */}
                                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2 border-b border-gray-50 pb-1.5">
                                        <div className="w-1.5 h-3.5 bg-emerald-500 rounded-full"></div>
                                        <h5 className="font-black text-gray-800 text-[10px] uppercase tracking-widest">BALANCES</h5>
                                    </div>
                                    <div className="space-y-1.5">
                                        <DetailItem label="Existencia" value={verificacionDetalle.detalles?.stock_existencia} isBadge highlight color="blue" />
                                        <DetailItem label="Físico" value={verificacionDetalle.detalles?.stock_fisico} isBadge highlight color="emerald" />
                                        <DetailItem label="Sistema" value={verificacionDetalle.detalles?.stock_sistema} isBadge highlight color="amber" />
                                        <div className="pt-1.5 mt-0.5 border-t border-gray-50">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ESTADO</span>
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border uppercase ${verificacionDetalle.detalles?.estado === 'CONFORME' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    'bg-red-50 text-red-700 border-red-200'
                                                    }`}>
                                                    {verificacionDetalle.detalles?.estado || 'VERIFICADO'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                            <div className="text-[10px] font-bold text-gray-400">
                                Responsable: <span className="text-[#002D5A] font-black uppercase">{verificacionDetalle.registrado_por}</span>
                            </div>
                            <button
                                onClick={() => setVerificacionDetalle(null)}
                                className="px-8 py-2.5 bg-[#002D5A] text-white font-black rounded-xl hover:bg-blue-900 transition-all shadow-lg active:scale-95 uppercase tracking-widest text-[10px]"
                            >
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

// Helper component for details
function DetailItem({ label, value, isBadge = false, highlight = false, color = 'blue' }: any) {
    const getColorClass = () => {
        if (!isBadge) return 'text-gray-900';
        switch (color) {
            case 'emerald': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'amber': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'blue': return 'bg-blue-50 text-blue-700 border-blue-200';
            default: return 'bg-blue-50 text-blue-700 border-blue-200';
        }
    };

    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
            {isBadge ? (
                <span className={`px-3 py-1 rounded-xl text-[10px] font-black border shadow-sm ${getColorClass()}`}>
                    {value ?? '-'}
                </span>
            ) : (
                <span className={`text-[11px] font-black ${highlight ? 'text-[#002D5A]' : 'text-gray-700 uppercase'}`}>
                    {value || '-'}
                </span>
            )}
        </div>
    );
}
