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
    History,
    ShieldCheck
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
        motivo: ''
    });

    // Dropdown Action State
    const [openActionId, setOpenActionId] = useState<number | null>(null);

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

    const fetchComparison = async (almacen: 'callao' | 'malvinas') => {
        console.log('🔍 fetchComparison llamado para:', almacen);
        console.log('📋 inventario_id:', state.sesionActual.inventario_id);

        if (!state.sesionActual.inventario_id) {
            console.error('❌ No hay inventario_id activo');
            // Ya no mostramos alerta aquí para evitar el error al cerrar sesión
            // showAlert('Error', 'No hay un inventario activo...', 'error');
            return;
        }

        setLoading(true);
        try {
            const apiUrl = `obtener_comparacion_${almacen}&inventario_id=${state.sesionActual.inventario_id}`;
            console.log('📡 Llamando API:', apiUrl);

            const response = await apiCall(apiUrl);
            console.log('📥 Respuesta recibida:', response);

            if (response.success) {
                // Manejar dos formatos de respuesta:
                // 1. response.comparaciones (cuando hay comparación generada)
                // 2. response.datos (cuando solo hay datos del sistema sin comparación)

                let dataToDisplay: ComparacionItem[] = [];

                if (response.comparaciones && response.comparaciones.length > 0) {
                    // Hay comparación generada
                    console.log('✅ Comparación encontrada:', response.comparaciones.length, 'items');
                    dataToDisplay = response.comparaciones;
                } else if (response.datos && response.datos.length > 0) {
                    // Solo hay datos del sistema, transformarlos al formato esperado
                    console.log('📊 Datos del sistema encontrados:', response.datos.length, 'items');
                    dataToDisplay = response.datos.map((dato: any) => ({
                        id: dato.id,
                        item: dato.item,
                        producto: dato.producto,
                        codigo: dato.codigo,
                        cantidad_sistema: dato.cantidad_sistema,
                        cantidad_fisica: 0, // Sin conteo físico aún
                        resultado: -dato.cantidad_sistema, // Todo es faltante si no hay conteo
                        estado: 'FALTANTE',
                        unidad_medida: dato.unidad_medida || 'UND'
                    }));
                } else {
                    console.log('⚠️ No hay datos ni comparaciones para este inventario (esperando carga de sistema)');
                }

                console.log('✅ Datos a mostrar:', dataToDisplay.length, 'items');
                setComparacionData(dataToDisplay);
                setResumen(response.resumen || null);
                setSistemaCargado(response.sistema_cargado || dataToDisplay.length > 0);
            } else {
                console.error('❌ Error en respuesta:', response.message);
                showAlert('Error', response.message || 'No se pudo obtener la comparación', 'error');
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
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

    const handlePasswordConfirm = () => {
        if (password === '0427') {
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
                    motivo: ''
                });
            }
        } else {
            showAlert('Error', 'Contraseña incorrecta', 'error');
        }
    };

    const handleSubmitEdit = async () => {
        if (!selectedItem || !selectedAlmacen) return;

        const action = activeModal === 'fisico' ? 'editar_cantidad_fisica' : 'editar_cantidad_sistema';
        const payload = {
            comparacion_id: selectedItem.id,
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
                                <span>Almacén Callao {selectedAlmacen === 'callao' && comparacionData.length > 0 ? `(${comparacionData.length})` : ''}</span>
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
                                <span>Almacén Malvinas {selectedAlmacen === 'malvinas' && comparacionData.length > 0 ? `(${comparacionData.length})` : ''}</span>
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
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span className="font-medium text-gray-400">Inicio:</span>
                                            <b className="text-[#0B3B8C] bg-white px-3 py-1 rounded-lg shadow-sm border border-gray-100">{state.sesionActual.inicio || '-'}</b>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="btn-group flex p-1 bg-white rounded-full shadow-sm border border-gray-200">
                                            <button
                                                onClick={handleDownloadPDF}
                                                className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                                            >
                                                <FileDown className="w-4 h-4" /> PDF
                                            </button>
                                            <button
                                                onClick={handleDownloadExcel}
                                                className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-[#198754] hover:bg-green-50 rounded-full transition-colors"
                                            >
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
                                        Correctos: {comparacionData.filter(item => item.estado === 'CONFORME').length}
                                    </div>
                                    <div className="bg-red-50 text-red-700 border border-red-100 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                        Incorrectos: {comparacionData.filter(item => item.estado === 'FALTANTE').length}
                                    </div>
                                    <div className="bg-yellow-50 text-yellow-700 border border-yellow-100 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                                        Sobrantes: {comparacionData.filter(item => item.estado === 'SOBRANTE').length}
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
                                                <tr>
                                                    <td colSpan={8} className="px-4 py-16 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <Upload className="w-12 h-12 text-gray-300" />
                                                            <div className="text-sm font-medium text-gray-600">No hay datos de comparación para este almacén</div>
                                                            <div className="text-xs text-gray-400 max-w-md">
                                                                Para generar la comparación, primero debes subir el archivo Excel del sistema usando el botón
                                                                <span className="font-bold text-[#0B3B8C]"> "Subir Sistema {selectedAlmacen === 'callao' ? 'Callao' : 'Malvinas'}"</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
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

            {/* Password Modal */}
            {/* Password Modal */}
            {showPasswordModal && (
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
            )}

            {/* Modals Overlay */}
            {activeModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
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

                        <div className="p-6 space-y-6">
                            {/* Product Info (Readonly) */}
                            <div className="grid grid-cols-2 gap-6 bg-[#F8FAFF] p-5 rounded-2xl border-2 border-[#E9F1FF]">
                                <div>
                                    <label className="text-[11px] font-black text-[#0B3B8C] uppercase tracking-wider mb-1 block">Producto en Evaluación</label>
                                    <p className="font-black text-gray-900 text-[19px] leading-tight">{selectedItem?.producto}</p>
                                </div>
                                <div className="text-right">
                                    <label className="text-[11px] font-black text-[#0B3B8C] uppercase tracking-wider mb-1 block">Código de Serie</label>
                                    <p className="font-mono font-black text-blue-700 text-[19px]">{selectedItem?.codigo}</p>
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
                                                className="w-full p-4 border-2 border-gray-100 rounded-2xl focus:border-blue-500 outline-none font-black text-gray-700 text-lg transition-all"
                                                value={editForm.cantidad}
                                                onChange={(e) => setEditForm({ ...editForm, cantidad: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="relative">
                                            <label className="absolute -top-2.5 left-3 px-1.5 bg-white text-[10px] font-black text-gray-400 uppercase tracking-wider">Motivo de Ajuste</label>
                                            {activeModal === 'fisico' ? (
                                                <select
                                                    className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-white font-black text-gray-700 outline-none focus:border-blue-500 appearance-none transition-all"
                                                    value={editForm.motivo_tipo}
                                                    onChange={(e) => setEditForm({ ...editForm, motivo_tipo: e.target.value, motivo: e.target.value !== 'otro' ? e.target.value : '' })}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    <option value="Error de conteo">Error de conteo</option>
                                                    <option value="otro">Otro Motivo</option>
                                                </select>
                                            ) : (
                                                <select
                                                    className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-white font-black text-gray-700 outline-none focus:border-blue-500 appearance-none transition-all"
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
                                                className="w-full p-4 border-2 border-gray-100 rounded-2xl focus:border-blue-500 outline-none font-black text-gray-700 transition-all border-dashed"
                                                value={editForm.motivo}
                                                onChange={(e) => setEditForm({ ...editForm, motivo: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="relative">
                                            <label className="absolute -top-2.5 left-3 px-1.5 bg-white text-[10px] font-black text-gray-400 uppercase tracking-wider">Operador Responsable</label>
                                            <select
                                                className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-white font-black text-gray-700 outline-none focus:border-blue-500 appearance-none transition-all"
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
                                                className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-white font-black text-gray-700 outline-none focus:border-blue-500 appearance-none transition-all"
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
                                            className="w-full p-4 border-2 border-gray-100 rounded-2xl h-28 font-medium text-gray-600 outline-none focus:border-blue-500 transition-all resize-none"
                                            value={editForm.observaciones}
                                            onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                                            placeholder="Detalle cualquier información relevante aquí..."
                                        ></textarea>
                                    </div>
                                </div>
                            )}

                            {activeModal === 'verificacion' && (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    {/* SECTION 1: COMPRAS Y VENTAS */}
                                    <div className="bg-white border-2 border-gray-100 rounded-[20px] overflow-hidden shadow-sm">
                                        <div className="bg-[#0061F2] p-3 px-5 font-black text-white text-[15px] uppercase flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-white/40 rounded-full"></div>
                                            COMPRAS Y VENTAS
                                        </div>
                                        <div className="p-6 grid grid-cols-2 gap-12">
                                            {/* Column Compras */}
                                            <div className="space-y-5">
                                                <h4 className="text-[#0061F2] font-black text-[16px] flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-[#0061F2]"></div>
                                                    Compras
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="relative group">
                                                        <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-colors">Fecha ingreso inventario</label>
                                                        <input type="date" className="w-full p-3.5 border-2 border-gray-100 rounded-xl text-xs font-black text-gray-700 outline-none focus:border-[#0061F2] h-[48px] transition-all bg-gray-50/30 focus:bg-white"
                                                            value={verificacionForm.fecha_ingreso_compra}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, fecha_ingreso_compra: e.target.value })} />
                                                    </div>
                                                    <div className="relative group">
                                                        <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-colors">Hora ingreso</label>
                                                        <input type="time" className="w-full p-3.5 border-2 border-gray-100 rounded-xl text-xs font-black text-gray-700 outline-none focus:border-[#0061F2] h-[48px] transition-all bg-gray-50/30 focus:bg-white"
                                                            value={verificacionForm.hora_ingreso_compra}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, hora_ingreso_compra: e.target.value })} />
                                                    </div>
                                                </div>
                                                <div className="relative group">
                                                    <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-colors">Número de acta</label>
                                                    <input type="text" className="w-full p-3.5 border-2 border-gray-100 rounded-xl text-xs font-black text-gray-700 outline-none focus:border-[#0061F2] h-[48px] transition-all bg-gray-50/30 focus:bg-white pl-4"
                                                        value={verificacionForm.numero_acta}
                                                        placeholder="Escriba el N° de Acta..."
                                                        onChange={(e) => setVerificacionForm({ ...verificacionForm, numero_acta: e.target.value })} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="relative group">
                                                        <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-colors">Fecha descarga inventario</label>
                                                        <input type="date" className="w-full p-3.5 border-2 border-gray-100 rounded-xl text-xs font-black text-gray-700 outline-none focus:border-[#0061F2] h-[48px] transition-all bg-gray-50/30 focus:bg-white"
                                                            value={verificacionForm.fecha_descarga_compra}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, fecha_descarga_compra: e.target.value })} />
                                                    </div>
                                                    <div className="relative group">
                                                        <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-colors">Hora descarga inventario</label>
                                                        <input type="time" className="w-full p-3.5 border-2 border-gray-100 rounded-xl text-xs font-black text-gray-700 outline-none focus:border-[#0061F2] h-[48px] transition-all bg-gray-50/30 focus:bg-white"
                                                            value={verificacionForm.hora_descarga_compra}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, hora_descarga_compra: e.target.value })} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Column Ventas */}
                                            <div className="space-y-5">
                                                <h4 className="text-[#0061F2] font-black text-[16px] flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-[#0061F2]"></div>
                                                    Ventas
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="relative group">
                                                        <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-colors">Fecha descarga ventas</label>
                                                        <input type="date" className="w-full p-3.5 border-2 border-gray-100 rounded-xl text-xs font-black text-gray-700 outline-none focus:border-[#0061F2] h-[48px] transition-all bg-gray-50/30 focus:bg-white"
                                                            value={verificacionForm.fecha_descarga_ventas}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, fecha_descarga_ventas: e.target.value })} />
                                                    </div>
                                                    <div className="relative group">
                                                        <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-colors">Hora descarga ventas</label>
                                                        <input type="time" className="w-full p-3.5 border-2 border-gray-100 rounded-xl text-xs font-black text-gray-700 outline-none focus:border-[#0061F2] h-[48px] transition-all bg-gray-50/30 focus:bg-white"
                                                            value={verificacionForm.hora_descarga_ventas}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, hora_descarga_ventas: e.target.value })} />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="relative group">
                                                        <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-colors">Fecha descarga sistema</label>
                                                        <input type="date" className="w-full p-3.5 border-2 border-gray-100 rounded-xl text-xs font-black text-gray-700 outline-none focus:border-[#0061F2] h-[48px] transition-all bg-gray-50/30 focus:bg-white"
                                                            value={verificacionForm.fecha_descarga_sistema}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, fecha_descarga_sistema: e.target.value })} />
                                                    </div>
                                                    <div className="relative group">
                                                        <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-[#0061F2] transition-colors">Hora descarga sistema</label>
                                                        <input type="time" className="w-full p-3.5 border-2 border-gray-100 rounded-xl text-xs font-black text-gray-700 outline-none focus:border-[#0061F2] h-[48px] transition-all bg-gray-50/30 focus:bg-white"
                                                            value={verificacionForm.hora_descarga_sistema}
                                                            onChange={(e) => setVerificacionForm({ ...verificacionForm, hora_descarga_sistema: e.target.value })} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECTION 2: RESULTADO GENERAL */}
                                    <div className="bg-white border-2 border-gray-100 rounded-[20px] overflow-hidden shadow-sm">
                                        <div className="bg-[#FFC107] p-3 px-5 font-black text-gray-900 text-[15px] uppercase flex items-center gap-2 border-b-2 border-gray-50">
                                            <div className="w-1.5 h-4 bg-gray-900/10 rounded-full"></div>
                                            RESULTADO GENERAL
                                        </div>
                                        <div className="p-6 grid grid-cols-3 gap-6">
                                            <div className="relative group">
                                                <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-amber-600 transition-colors">Compras Totales</label>
                                                <input
                                                    type="number"
                                                    className="w-full p-4 border-2 border-gray-100 rounded-xl text-[17px] font-black focus:border-[#FFC107] outline-none transition-all h-[54px] bg-gray-50/30"
                                                    value={verificacionForm.compras_totales || ''}
                                                    onChange={(e) => setVerificacionForm({ ...verificacionForm, compras_totales: Number(e.target.value) })}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <label className="absolute -top-2 left-3 px-1.5 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest group-focus-within:text-amber-600 transition-colors">Ventas Totales</label>
                                                <input
                                                    type="number"
                                                    className="w-full p-4 border-2 border-gray-100 rounded-xl text-[17px] font-black focus:border-[#FFC107] outline-none transition-all h-[54px] bg-gray-50/30"
                                                    value={verificacionForm.ventas_totales || ''}
                                                    onChange={(e) => setVerificacionForm({ ...verificacionForm, ventas_totales: Number(e.target.value) })}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="bg-[#FDF9ED] border-2 border-amber-50 p-3 rounded-xl relative flex flex-col justify-center shadow-inner">
                                                <label className="text-[9px] text-amber-800 font-black uppercase absolute top-2 left-3 tracking-widest opacity-60">Stock de Existencias</label>
                                                <span className="text-[20px] font-black text-amber-900 mt-2 ml-1">
                                                    {(verificacionForm.compras_totales || 0) - (verificacionForm.ventas_totales || 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECTION 3: RESULTADO DE VERIFICACIÓN */}
                                    <div className="bg-white border-2 border-gray-100 rounded-[20px] overflow-hidden shadow-sm">
                                        <div className="bg-[#198754] p-3 px-5 font-black text-white text-[15px] uppercase flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-white/40 rounded-full"></div>
                                            RESULTADO DE VERIFICACIÓN
                                        </div>
                                        <div className="p-6 grid grid-cols-3 gap-6 items-center">
                                            <div className="bg-[#ECFDF5] border-2 border-emerald-50 p-3 rounded-xl relative shadow-inner">
                                                <label className="text-[9px] text-emerald-800 font-black uppercase absolute top-2 left-3 tracking-widest opacity-60">Stock Físico</label>
                                                <span className="text-[20px] font-black text-emerald-900 block mt-5 ml-1 leading-none">
                                                    {(selectedItem?.cantidad_fisica || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="bg-[#ECFDF5] border-2 border-emerald-50 p-3 rounded-xl relative shadow-inner">
                                                <label className="text-[9px] text-emerald-800 font-black uppercase absolute top-2 left-3 tracking-widest opacity-60">Stock Sistema</label>
                                                <span className="text-[20px] font-black text-emerald-900 block mt-5 ml-1 leading-none">
                                                    {(selectedItem?.cantidad_sistema || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                {(() => {
                                                    const stockExistencia = (verificacionForm.compras_totales || 0) - (verificacionForm.ventas_totales || 0);
                                                    const stockFisico = selectedItem?.cantidad_fisica || 0;
                                                    const stockSistema = selectedItem?.cantidad_sistema || 0;

                                                    let estado = '';
                                                    let colorClass = '';

                                                    if (stockExistencia === stockFisico && stockExistencia === stockSistema) {
                                                        estado = 'CONFORME';
                                                        colorClass = 'bg-green-500 shadow-green-200 border-green-400';
                                                    } else if (stockExistencia === stockFisico && stockExistencia !== stockSistema) {
                                                        estado = 'ERROR DE SISTEMA';
                                                        colorClass = 'bg-orange-500 shadow-orange-200 border-orange-400';
                                                    } else if (stockExistencia === stockSistema && stockExistencia !== stockFisico) {
                                                        estado = 'ERROR DE LOGÍSTICA';
                                                        colorClass = 'bg-red-500 shadow-red-200 border-red-400';
                                                    } else {
                                                        estado = 'REALIZAR NUEVO CONTEO';
                                                        colorClass = 'bg-blue-500 shadow-blue-200 border-blue-400';
                                                    }

                                                    return (
                                                        <span className={`${colorClass} text-white px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] shadow-lg border-2 block w-full text-center transition-all animate-in zoom-in duration-300`}>
                                                            {estado}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t-[3px] border-gray-50 flex justify-between items-center bg-white rounded-b-2xl sticky bottom-0 z-20">
                            <div>
                                {activeModal === 'verificacion' && (
                                    <button
                                        onClick={() => window.open(`${API_BASE_URL}/?action=descargar_verificacion_pdf&id=${selectedItem?.id}`, '_blank')}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-white border-[2.5px] border-[#0B3B8C] text-[#0B3B8C] rounded-2xl font-black hover:bg-blue-50 transition-all text-xs shadow-sm uppercase tracking-wide active:scale-95"
                                    >
                                        <FileDown className="w-4 h-4" />
                                        <span>Descargar reporte en PDF</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                {activeModal === 'verificacion' && (
                                    <button className="px-5 py-2.5 bg-gray-100 border-2 border-gray-200 text-gray-400 font-black rounded-2xl opacity-70 cursor-not-allowed text-xs uppercase tracking-wide">
                                        Sin guardar
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="px-8 py-2.5 bg-gray-100 border-2 border-gray-200 text-gray-500 font-black rounded-2xl hover:bg-gray-200 hover:text-gray-600 transition-all text-xs uppercase tracking-wide active:scale-95"
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
                                    className="px-10 py-2.5 bg-[#0B3B8C] text-white font-black rounded-2xl hover:bg-blue-900 transition-all shadow-xl shadow-blue-100 flex items-center gap-2 text-xs uppercase tracking-widest active:scale-95"
                                >
                                    <Save className="w-4 h-4" /> Guardar Cambios
                                </button>
                            </div>
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
