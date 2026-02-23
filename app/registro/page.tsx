'use client';

import React, { useState, useEffect } from 'react';
import { useInventory } from '@/context/InventoryContext';
import { apiCall, API_BASE_URL } from '@/lib/api';
import {
    Archive,
    FileDown,
    ChevronDown,
    ChevronUp,
    Folder,
    Eye,
    Package,
    ClipboardCheck,
    History,
    Building2,
    Store,
    X,
    BarChart3,
    FileText,
    ShieldCheck,
    Activity,
    CheckCircle2,
    AlertTriangle,
    Info,
    PackageSearch
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InventarioFichero {
    id: number;
    numero_inventario: string;
    area?: string;
    autorizado_por?: string;
    fecha_hora_asignacion: string;
    estado: string;
    fecha_cierre?: string;
    observaciones?: string;
    total_conteos: number;
    total_proformas: number;
    total_verificaciones: number;
    total_acciones: number;
}

interface ConsolidadoItem {
    id: number;
    producto_item: number;
    producto: string;
    codigo: string;
    sistema: number;
    fisico: number;
    diferencia: number;
    resultado: string;
    unidad_medida: string;
}

interface ProformaItem {
    proforma_id: number;
    numero_proforma: string;
    asesor?: string;
    almacen: string;
    registrado_por: string;
    fecha_hora_registro: string;
    estado: string;
    archivo_pdf?: string | null;
    total_productos: number;
    cantidad_total_items: number;
    productos_descontados: number;
}

interface VerificacionItem {
    verificacion_id: number;
    almacen: string;
    codigo_producto: string;
    producto: string;
    estado_verificacion: string;
    stock_fisico?: number;
    stock_sistema?: number;
    registrado_por: string;
    fecha_hora: string;
}

interface AccionItem {
    accion_id: number;
    almacen: string;
    codigo: string;
    producto: string;
    tipo_accion: string;
    motivo: string;
    cantidad_afectada: number;
    registrado_por: string;
    fecha_hora: string;
}

interface ConteoItem {
    conteo_id: number;
    almacen: string;
    numero_inventario: string;
    tipo_conteo_tienda: string;
    registrado_por: string;
    fecha_hora_inicio: string;
    fecha_hora_final: string;
    autorizado: string;
    total_productos_contados: number;
}

export default function RegistroPage() {
    const { showAlert } = useInventory();
    const [loading, setLoading] = useState(false);
    const [inventarios, setInventarios] = useState<InventarioFichero[]>([]);
    const [inventarioExpandido, setInventarioExpandido] = useState<number | null>(null);
    const [vistaActiva, setVistaActiva] = useState<'detalle' | 'conteos' | null>(null);
    const [tabActiva, setTabActiva] = useState<'consolidado' | 'proformas' | 'verificaciones' | 'acciones'>('consolidado');

    // Estados para los modales/listados
    const [consolidadoData, setConsolidadoData] = useState<any>(null);
    const [proformasData, setProformasData] = useState<ProformaItem[]>([]);
    const [verificacionesData, setVerificacionesData] = useState<VerificacionItem[]>([]);
    const [accionesData, setAccionesData] = useState<AccionItem[]>([]);
    const [conteosData, setConteosData] = useState<ConteoItem[]>([]);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [modalDetalleConteo, setModalDetalleConteo] = useState<{ open: boolean; conteoId: number | null; datos: any[] }>({ open: false, conteoId: null, datos: [] });

    useEffect(() => {
        cargarFicheroInventarios();
    }, []);

    const cargarFicheroInventarios = async () => {
        setLoading(true);
        try {
            const response = await apiCall('obtener_fichero_inventarios', 'GET');
            if (response.success) {
                setInventarios(response.inventarios || []);
            } else {
                showAlert('Error', response.message || 'Error al cargar inventarios', 'error');
            }
        } catch (error) {
            console.error('Error al cargar fichero:', error);
            showAlert('Error', 'Error de conexión al cargar inventarios', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleExpandirInventario = (inventarioId: number) => {
        if (inventarioExpandido === inventarioId) {
            // Si ya está expandido, colapsar
            setInventarioExpandido(null);
            setVistaActiva(null);
            setConsolidadoData(null);
            setProformasData([]);
            setVerificacionesData([]);
            setAccionesData([]);
            setConteosData([]);
        } else {
            // Expandir nuevo inventario
            setInventarioExpandido(inventarioId);
            setVistaActiva(null);
            setConsolidadoData(null);
            setProformasData([]);
            setVerificacionesData([]);
            setAccionesData([]);
            setConteosData([]);
        }
    };

    const handleVerDetalleAcciones = async (inventarioId: number) => {
        setVistaActiva('detalle');
        setConteosData([]);
        setTabActiva('consolidado');
        // Limpiar datos de otras pestañas
        setProformasData([]);
        setVerificacionesData([]);
        setAccionesData([]);
        setConsolidadoData(null);
        // Cargar consolidado por defecto
        await handleVerConsolidado(inventarioId);
    };

    const handleVerConsolidado = async (inventarioId: number) => {
        setLoadingDetalle(true);
        try {
            const response = await apiCall(`obtener_consolidado_registro&inventario_id=${inventarioId}`, 'GET');
            if (response.success) {
                setConsolidadoData(response);
            } else {
                showAlert('Error', response.message || 'Error al cargar consolidado', 'error');
            }
        } catch (error) {
            console.error('Error al cargar consolidado:', error);
            showAlert('Error', 'Error de conexión al cargar consolidado', 'error');
        } finally {
            setLoadingDetalle(false);
        }
    };

    const handleVerProformas = async (inventarioId: number) => {
        setLoadingDetalle(true);
        try {
            const response = await apiCall(`obtener_proformas_registro&inventario_id=${inventarioId}`, 'GET');
            if (response.success) {
                setProformasData(response.proformas || []);
            } else {
                showAlert('Error', response.message || 'Error al cargar proformas', 'error');
            }
        } catch (error) {
            console.error('Error al cargar proformas:', error);
            showAlert('Error', 'Error de conexión al cargar proformas', 'error');
        } finally {
            setLoadingDetalle(false);
        }
    };

    const handleVerVerificaciones = async (inventarioId: number) => {
        setLoadingDetalle(true);
        try {
            const response = await apiCall(`obtener_verificaciones_registro&inventario_id=${inventarioId}`, 'GET');
            if (response.success) {
                setVerificacionesData(response.verificaciones || []);
            } else {
                showAlert('Error', response.message || 'Error al cargar verificaciones', 'error');
            }
        } catch (error) {
            console.error('Error al cargar verificaciones:', error);
            showAlert('Error', 'Error de conexión al cargar verificaciones', 'error');
        } finally {
            setLoadingDetalle(false);
        }
    };

    const handleVerAcciones = async (inventarioId: number) => {
        setLoadingDetalle(true);
        try {
            const response = await apiCall(`obtener_acciones_registro&inventario_id=${inventarioId}`, 'GET');
            if (response.success) {
                setAccionesData(response.acciones || []);
            } else {
                showAlert('Error', response.message || 'Error al cargar acciones', 'error');
            }
        } catch (error) {
            console.error('Error al cargar acciones:', error);
            showAlert('Error', 'Error de conexión al cargar acciones', 'error');
        } finally {
            setLoadingDetalle(false);
        }
    };

    const handleVerConteos = async (inventarioId: number) => {
        setVistaActiva('conteos');
        setLoadingDetalle(true);
        try {
            const response = await apiCall(`obtener_conteos_registro&inventario_id=${inventarioId}`, 'GET');
            if (response.success) {
                setConteosData(response.conteos || []);
            } else {
                showAlert('Error', response.message || 'Error al cargar conteos', 'error');
            }
        } catch (error) {
            console.error('Error al cargar conteos:', error);
            showAlert('Error', 'Error de conexión al cargar conteos', 'error');
        } finally {
            setLoadingDetalle(false);
        }
    };

    const formatearFecha = (fecha: string) => {
        if (!fecha) return '-';
        try {
            const date = new Date(fecha);
            return date.toLocaleDateString('es-PE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return fecha;
        }
    };

    const calcularTotalRegistros = (inv: InventarioFichero) => {
        return inv.total_conteos + inv.total_proformas + inv.total_verificaciones + inv.total_acciones;
    };

    const descargarProformaPDF = (archivoPdf: string | null) => {
        if (!archivoPdf) {
            showAlert('Información', 'El PDF aún no está disponible.', 'warning');
            return;
        }
        // Las URLs de Google Cloud Storage son públicas y se pueden abrir directamente
        window.open(archivoPdf, '_blank');
    };

    const handleVerDetalleConteo = async (conteoId: number) => {
        setLoadingDetalle(true);
        try {
            const response = await apiCall(`obtener_detalle_conteo&conteo_id=${conteoId}`, 'GET');
            if (response.success && response.productos) {
                setModalDetalleConteo({
                    open: true,
                    conteoId: conteoId,
                    datos: response.productos
                });
            } else {
                showAlert('Error', response.message || 'Error al cargar detalle del conteo', 'error');
            }
        } catch (error) {
            console.error('Error al cargar detalle:', error);
            showAlert('Error', 'Error de conexión al cargar detalle del conteo', 'error');
        } finally {
            setLoadingDetalle(false);
        }
    };

    const handleDescargarPDFConteo = async (conteo: ConteoItem) => {
        try {
            setLoadingDetalle(true);
            // Obtener detalle del conteo
            const response = await apiCall(`obtener_detalle_conteo&conteo_id=${conteo.conteo_id}`, 'GET');

            if (!response.success || !response.productos || response.productos.length === 0) {
                showAlert('Información', 'No hay detalles para generar el PDF.', 'warning');
                return;
            }

            const doc = new jsPDF();

            // Encabezado
            doc.setFontSize(16);
            doc.text(`Conteo - ${conteo.almacen}`, 14, 20);

            doc.setFontSize(10);
            doc.text(`N° Inventario: ${conteo.numero_inventario}`, 14, 30);
            doc.text(`Tipo/Tienda: ${conteo.tipo_conteo_tienda}`, 14, 36);
            doc.text(`Registrado por: ${conteo.registrado_por}`, 14, 42);
            doc.text(`Inicio: ${formatearFecha(conteo.fecha_hora_inicio)}`, 14, 48);
            doc.text(`Fin: ${formatearFecha(conteo.fecha_hora_final)}`, 14, 54);
            doc.text(`Autorizado: ${conteo.autorizado || '-'}`, 14, 60);

            // Tabla
            const tableBody = response.productos.map((p: any) => [
                p.item_producto || p.item || '-',
                p.producto || '-',
                p.codigo || '-',
                p.cantidad || p.cantidad_fisica || p.cantidad_conteo || '0',
                p.unidad_medida || 'UND'
            ]);

            autoTable(doc, {
                startY: 65,
                head: [['Item', 'Producto', 'Código', 'Cantidad', 'U.M.']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [11, 59, 140] },
            });

            doc.save(`Conteo_${conteo.almacen}_${conteo.numero_inventario}_${conteo.conteo_id}.pdf`);
            showAlert('Éxito', 'PDF generado correctamente', 'success');
        } catch (error) {
            console.error('Error generando PDF:', error);
            showAlert('Error', 'No se pudo generar el PDF', 'error');
        } finally {
            setLoadingDetalle(false);
        }
    };

    // --- Funciones para Generar PDFs de Listados ---
    const handleDescargarPDFConsolidado = () => {
        if (!consolidadoData || !consolidadoData.consolidado) return;
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text(`Consolidado General - Doc: ${consolidadoData.inventario?.numero_inventario || ''}`, 14, 20);

        let finalY = 25;

        // Tabla Callao
        if (consolidadoData.consolidado.callao?.datos?.length) {
            doc.setFontSize(12);
            doc.text('Inventario Callao', 14, finalY + 10);
            autoTable(doc, {
                startY: finalY + 15,
                head: [['Item', 'Producto', 'Sistema', 'Físico', 'Dif.']],
                body: consolidadoData.consolidado.callao.datos.map((i: any) => [i.producto_item, i.producto, i.sistema, i.fisico, i.diferencia]),
                theme: 'grid',
                headStyles: { fillColor: [0, 45, 90] },
                styles: { fontSize: 8 }
            });
            finalY = (doc as any).lastAutoTable?.finalY || finalY + 15;
        }

        // Tabla Malvinas
        if (consolidadoData.consolidado.malvinas?.datos?.length) {
            doc.setFontSize(12);
            doc.text('Inventario Malvinas', 14, finalY + 10);
            autoTable(doc, {
                startY: finalY + 15,
                head: [['Producto', 'Sistema', 'Físico', 'Dif.']],
                body: consolidadoData.consolidado.malvinas.datos.map((i: any) => [i.producto, i.sistema, i.fisico, i.diferencia]),
                theme: 'grid',
                headStyles: { fillColor: [244, 180, 0] },
                styles: { fontSize: 8 }
            });
            finalY = (doc as any).lastAutoTable?.finalY || finalY + 15;
        }

        // Tabla General
        if (consolidadoData.consolidado.general?.datos?.length) {
            doc.setFontSize(12);
            doc.text('Conteo General', 14, finalY + 10);
            autoTable(doc, {
                startY: finalY + 15,
                head: [['Producto', 'Total Sistema', 'Total Físico', 'Dif.', 'Resultado']],
                body: consolidadoData.consolidado.general.datos.map((i: any) => [i.producto, i.total_sistema, i.total_fisico, i.diferencia, i.resultado || 'N/A']),
                theme: 'grid',
                headStyles: { fillColor: [25, 135, 84] },
                styles: { fontSize: 8 }
            });
        }

        doc.save(`Consolidado_${consolidadoData.inventario?.numero_inventario || 'Export'}.pdf`);
    };

    const handleDescargarPDFProformas = () => {
        if (!proformasData || !proformasData.length) return;
        const doc = new jsPDF('landscape');
        doc.setFontSize(14);
        doc.text(`Proformas Emitidas`, 14, 20);

        autoTable(doc, {
            startY: 30,
            head: [['N° Proforma', 'Almacén', 'Asesor', 'Cantidad Total', 'Estado', 'Fecha']],
            body: proformasData.map((p: any) => [
                p.numero_proforma, p.almacen, p.asesor || '-', p.cantidad_total_items,
                p.estado || (p.archivo_pdf ? 'Tiene comprobante' : 'PROFORMA INGRESADA'),
                formatearFecha(p.fecha_hora_registro)
            ]),
            theme: 'grid',
            headStyles: { fillColor: [0, 45, 90] },
            styles: { fontSize: 8 }
        });
        doc.save(`Proformas_Inventario.pdf`);
    };

    const handleDescargarPDFVerificaciones = () => {
        if (!verificacionesData || !verificacionesData.length) return;
        const doc = new jsPDF('landscape');
        doc.setFontSize(14);
        doc.text(`Verificaciones Registradas`, 14, 20);

        autoTable(doc, {
            startY: 30,
            head: [['Producto', 'Código', 'Almacén', 'Estado', 'S. Físico', 'S. Sistema', 'Registrado Por', 'Fecha']],
            body: verificacionesData.map((v: any) => [
                v.producto, v.codigo_producto, v.almacen, v.estado_verificacion,
                v.stock_fisico || '-', v.stock_sistema || '-', v.registrado_por, formatearFecha(v.fecha_hora)
            ]),
            theme: 'grid',
            headStyles: { fillColor: [0, 45, 90] },
            styles: { fontSize: 8 }
        });
        doc.save(`Verificaciones_Inventario.pdf`);
    };

    const handleDescargarPDFAcciones = () => {
        if (!accionesData || !accionesData.length) return;
        const doc = new jsPDF('landscape');
        doc.setFontSize(14);
        doc.text(`Acciones Realizadas`, 14, 20);

        autoTable(doc, {
            startY: 30,
            head: [['Producto', 'Código', 'Almacén', 'Tipo Acción', 'S. Sistema', 'Contado', 'Sobrantes', 'Faltantes', 'Observador', 'Autorizado', 'Fecha']],
            body: accionesData.map((a: any) => [
                a.producto, a.codigo_producto, a.almacen, a.tipo_accion,
                a.stock_sistema || '-', a.contado_total || '-', a.sobrantes || '-', a.faltantes || '-',
                a.registrado_por || '-', a.autorizado_por || '-', formatearFecha(a.fecha)
            ]),
            theme: 'grid',
            headStyles: { fillColor: [0, 45, 90] },
            styles: { fontSize: 7 }
        });
        doc.save(`Acciones_Inventario.pdf`);
    };

    return (
        <div id="view-registro" className="animate-in fade-in duration-500 font-poppins pb-10">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                    <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-[#002D5A] to-[#002D5A] rounded-xl flex items-center justify-center text-white shadow-sm transition-all duration-200">
                                <Archive className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0" style={{ fontFamily: 'var(--font-poppins)', fontSize: '22px' }}>
                                    Registro de Inventarios
                                </h1>
                                <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    Consulta el historial detallado de inventarios finalizados de todos los usuarios
                                </p>
                            </div>
                        </div>

                    </header>

                    {/* Fichero de Inventarios - Tarjetas */}
                    <div className="space-y-1.5">
                        {loading ? (
                            <div className="text-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#002D5A] mx-auto mb-2"></div>
                                <span className="text-sm text-gray-500">Cargando inventarios...</span>
                            </div>
                        ) : inventarios.length === 0 ? (
                            <div className="text-center py-16">
                                <Archive className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-400 font-medium">No hay inventarios registrados</p>
                            </div>
                        ) : (
                            inventarios.map((inventario) => {
                                const estaExpandido = inventarioExpandido === inventario.id;
                                const totalRegistros = calcularTotalRegistros(inventario);

                                return (
                                    <div key={inventario.id} className="group bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md hover:border-[#002D5A]/30 transition-all duration-300">
                                        {/* Tarjeta Principal */}
                                        <div
                                            className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                            onClick={() => handleExpandirInventario(inventario.id)}
                                        >
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="w-10 h-10 bg-[#002D5A] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md transition-all duration-300 group-hover:shadow-lg group-hover:bg-[#001f3f]">
                                                    <Folder className="w-5 h-5 text-white transition-colors" />
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <div className="font-semibold text-slate-700 text-[13px] md:text-sm tracking-tight m-0 truncate group-hover:text-[#002D5A] transition-colors">
                                                        {inventario.numero_inventario}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#002D5A]/5 text-[#002D5A] border border-[#002D5A]/10">
                                                            {totalRegistros} registro{totalRegistros !== 1 ? 's' : ''}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 font-medium hidden sm:inline-block">
                                                            {inventario.fecha_cierre ? formatearFecha(inventario.fecha_cierre) : formatearFecha(inventario.fecha_hora_asignacion)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${estaExpandido ? 'bg-[#002D5A] text-white shadow-sm' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600'}`}>
                                                    {estaExpandido ? (
                                                        <ChevronUp className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Contenido Expandido */}
                                        {estaExpandido && (
                                            <div className="border-t border-gray-200 bg-gray-50 p-4">
                                                <div className="flex flex-col gap-3">
                                                    {/* Botones de Acción */}
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        {/* Botón: Ver detalle de acciones */}
                                                        <button
                                                            onClick={() => handleVerDetalleAcciones(inventario.id)}
                                                            className={`inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-full border transition-all font-semibold text-[11px] shadow-sm ${vistaActiva === 'detalle' || vistaActiva === null
                                                                ? 'bg-[#002D5A] text-white border-[#002D5A] hover:bg-[#001f3f]'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span>Ver detalle de acciones</span>
                                                        </button>

                                                        {/* Botón: Conteos por Almacén */}
                                                        <button
                                                            onClick={() => handleVerConteos(inventario.id)}
                                                            className={`inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-full border transition-all font-semibold text-[11px] shadow-sm ${vistaActiva === 'conteos'
                                                                ? 'bg-[#002D5A] text-white border-[#002D5A] hover:bg-[#001f3f]'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <Building2 className="w-3.5 h-3.5" />
                                                            <span>Conteos por Almacén (Cajas/Stand)</span>
                                                        </button>
                                                    </div>

                                                    {/* Vista con Pestañas de Detalle de Acciones */}
                                                    {vistaActiva === 'detalle' && (
                                                        <div className="mt-4 mb-2">
                                                            {/* Pestañas (Botones tipo Pill) */}
                                                            <div className="flex flex-wrap gap-2.5">
                                                                <button
                                                                    onClick={async () => {
                                                                        setTabActiva('consolidado');
                                                                        await handleVerConsolidado(inventario.id);
                                                                    }}
                                                                    className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-full border shadow-sm transition-all ${tabActiva === 'consolidado'
                                                                        ? 'bg-[#002D5A] text-white border-[#002D5A] scale-105'
                                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <FileText className="w-3.5 h-3.5" />
                                                                    <span>Consolidado</span>
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        setTabActiva('proformas');
                                                                        await handleVerProformas(inventario.id);
                                                                    }}
                                                                    className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-full border shadow-sm transition-all ${tabActiva === 'proformas'
                                                                        ? 'bg-[#002D5A] text-white border-[#002D5A] scale-105'
                                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <FileText className="w-3.5 h-3.5" />
                                                                    <span>Proformas</span>
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        setTabActiva('verificaciones');
                                                                        await handleVerVerificaciones(inventario.id);
                                                                    }}
                                                                    className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-full border shadow-sm transition-all ${tabActiva === 'verificaciones'
                                                                        ? 'bg-[#002D5A] text-white border-[#002D5A] scale-105'
                                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <FileText className="w-3.5 h-3.5" />
                                                                    <span>Verificaciones</span>
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        setTabActiva('acciones');
                                                                        await handleVerAcciones(inventario.id);
                                                                    }}
                                                                    className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-full border shadow-sm transition-all ${tabActiva === 'acciones'
                                                                        ? 'bg-[#002D5A] text-white border-[#002D5A] scale-105'
                                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <FileText className="w-3.5 h-3.5" />
                                                                    <span>Acciones</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Contenido de los Listados - Debajo de las pestañas */}
                                                    {vistaActiva === 'detalle' && (
                                                        <div className="mt-0 bg-white rounded-b-lg border-t-0 border-l border-r border-b border-gray-200 shadow-sm">
                                                            {loadingDetalle && (
                                                                <div className="text-center py-6">
                                                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#002D5A] mx-auto mb-2"></div>
                                                                    <span className="text-xs text-gray-500">Cargando datos...</span>
                                                                </div>
                                                            )}

                                                            {/* Modal/Listado de Consolidado */}
                                                            {consolidadoData && tabActiva === 'consolidado' && !loadingDetalle && (
                                                                <div className="p-4 max-h-[75vh] overflow-y-auto overflow-x-hidden">
                                                                    <div className="flex justify-between items-start mb-6">
                                                                        <div className="flex items-center gap-3">
                                                                            <div>
                                                                                <h4 className="font-extrabold text-gray-900 text-xl tracking-tight leading-tight">Consolidado General</h4>
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                    <span className="bg-[#002D5A]/10 text-[#002D5A] px-2 py-0.5 rounded-md text-[11px] font-bold border border-[#002D5A]/20">
                                                                                        Doc: {consolidadoData.inventario?.numero_inventario}
                                                                                    </span>
                                                                                    <span className="text-gray-500 text-xs font-medium">Comparativo de stocks y diferencias</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={() => handleDescargarPDFConsolidado()}
                                                                                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all text-xs shadow-sm hover:shadow-md active:scale-95 border border-red-700/50"
                                                                            >
                                                                                <FileDown className="w-4 h-4" />
                                                                                <span className="hidden sm:inline">Exportar PDF</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setConsolidadoData(null)}
                                                                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all active:scale-95"
                                                                                title="Cerrar Consolidado"
                                                                            >
                                                                                <X className="w-5 h-5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    {/* Las 3 tablas del consolidado */}
                                                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                                                                        {/* Tabla Callao */}
                                                                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                                                                            <div className="bg-[#002D5A] text-white p-2 flex justify-center items-center">
                                                                                <span className="font-bold tracking-wide uppercase text-[10px]">Inventario Callao</span>
                                                                            </div>
                                                                            <div className="overflow-x-auto flex-1 pb-2">
                                                                                <table className="w-full text-sm min-w-[450px]">
                                                                                    <thead className="bg-[#f0f4f8] sticky top-0 z-10 shadow-sm">
                                                                                        <tr className="border-b border-[#002D5A]/10">
                                                                                            <th className="px-3 py-3.5 text-center font-bold text-gray-700 text-[10px] uppercase">Item</th>
                                                                                            <th className="px-3 py-3.5 text-left font-bold text-gray-700 text-[10px] uppercase">Producto</th>
                                                                                            <th className="px-3 py-3.5 text-center font-bold text-gray-700 text-[10px] uppercase">Sistema</th>
                                                                                            <th className="px-3 py-3.5 text-center font-bold text-gray-700 text-[10px] uppercase">Físico</th>
                                                                                            <th className="px-3 py-3.5 text-center font-bold text-gray-700 text-[10px] uppercase">Dif.</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-gray-100">
                                                                                        {consolidadoData.consolidado?.callao?.datos?.length > 0 ? (
                                                                                            consolidadoData.consolidado.callao.datos.map((item: any, idx: number) => (
                                                                                                <tr key={idx} className="hover:bg-blue-50/50 transition-colors h-[54px]">
                                                                                                    <td className="px-3 py-2 text-center text-[11px] text-gray-500 whitespace-nowrap">{item.producto_item}</td>
                                                                                                    <td className="px-3 py-2 text-left text-[11px] text-[#002D5A] font-bold" title={item.producto}>
                                                                                                        <div className="line-clamp-2 leading-tight break-words whitespace-normal w-full min-w-[130px] pr-2">
                                                                                                            {item.producto}
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2 text-center text-[11px] text-gray-600 whitespace-nowrap">{item.sistema}</td>
                                                                                                    <td className="px-3 py-2 text-center text-[11px] text-[#002D5A] font-extrabold whitespace-nowrap">{item.fisico}</td>
                                                                                                    <td className={`px-3 py-2 text-center text-[11px] font-bold whitespace-nowrap ${item.diferencia < 0 ? 'text-red-500' : item.diferencia > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                                                                                                        {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ))
                                                                                        ) : (
                                                                                            <tr>
                                                                                                <td colSpan={5} className="px-3 py-10 text-center text-xs text-gray-400">Sin datos</td>
                                                                                            </tr>
                                                                                        )}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>

                                                                        {/* Tabla Malvinas */}
                                                                        <div className="bg-white rounded-lg border border-[#F4B400]/50 shadow-sm overflow-hidden flex flex-col">
                                                                            <div className="bg-[#F4B400] text-[#001F3D] p-2 flex justify-center items-center">
                                                                                <span className="font-bold tracking-wide uppercase text-[10px]">Inventario Malvinas</span>
                                                                            </div>
                                                                            <div className="overflow-x-auto flex-1 pb-2">
                                                                                <table className="w-full text-sm min-w-[420px]">
                                                                                    <thead className="bg-[#fffdf8] sticky top-0 z-10 shadow-sm border-b border-[#F4B400]/20">
                                                                                        <tr className="border-b border-[#F4B400]/20">
                                                                                            <th className="px-3 py-3.5 text-left font-bold text-gray-700 text-[10px] uppercase">Producto</th>
                                                                                            <th className="px-3 py-3.5 text-center font-bold text-gray-700 text-[10px] uppercase">Sistema</th>
                                                                                            <th className="px-3 py-3.5 text-center font-bold text-gray-700 text-[10px] uppercase">Físico</th>
                                                                                            <th className="px-3 py-3.5 text-center font-bold text-gray-700 text-[10px] uppercase">Dif.</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-gray-100">
                                                                                        {consolidadoData.consolidado?.malvinas?.datos?.length > 0 ? (
                                                                                            consolidadoData.consolidado.malvinas.datos.map((item: any, idx: number) => (
                                                                                                <tr key={idx} className="hover:bg-[#F4B400]/5 transition-colors h-[54px]">
                                                                                                    <td className="px-3 py-2 text-left text-[11px] text-[#002D5A] font-bold" title={item.producto}>
                                                                                                        <div className="line-clamp-2 leading-tight break-words whitespace-normal w-full min-w-[160px] pr-2">
                                                                                                            {item.producto}
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2 text-center text-[11px] text-gray-600 whitespace-nowrap">{item.sistema}</td>
                                                                                                    <td className="px-3 py-2 text-center text-[11px] text-[#002D5A] font-extrabold whitespace-nowrap">{item.fisico}</td>
                                                                                                    <td className={`px-3 py-2 text-center text-[11px] font-bold whitespace-nowrap ${item.diferencia < 0 ? 'text-red-500' : item.diferencia > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                                                                                                        {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ))
                                                                                        ) : (
                                                                                            <tr>
                                                                                                <td colSpan={4} className="px-3 py-10 text-center text-xs text-gray-400">Sin datos</td>
                                                                                            </tr>
                                                                                        )}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>

                                                                        {/* Tabla General */}
                                                                        <div className="bg-white rounded-lg border border-[#198754]/50 shadow-sm overflow-hidden flex flex-col">
                                                                            <div className="bg-[#198754] text-white p-2 flex justify-center items-center">
                                                                                <span className="font-bold tracking-wide uppercase text-[10px]">Conteo General</span>
                                                                            </div>
                                                                            <div className="overflow-x-auto flex-1 pb-2">
                                                                                <table className="w-full text-sm min-w-[550px]">
                                                                                    <thead className="bg-[#f2fcf6] sticky top-0 z-10 shadow-sm border-b border-[#198754]/20">
                                                                                        <tr className="border-b border-[#198754]/20">
                                                                                            <th className="px-3 py-3.5 text-left font-bold text-gray-700 text-[10px] uppercase">Producto</th>
                                                                                            <th className="px-3 py-3.5 text-center font-bold text-gray-700 text-[10px] uppercase">Total Sistema</th>
                                                                                            <th className="px-3 py-3.5 text-center font-bold text-gray-700 text-[10px] uppercase">Total Físico</th>
                                                                                            <th className="px-3 py-3.5 text-center font-bold text-gray-700 text-[10px] uppercase">Dif.</th>
                                                                                            <th className="px-3 py-3.5 text-center font-bold text-gray-700 text-[10px] uppercase">Resultado</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-gray-100">
                                                                                        {consolidadoData.consolidado?.general?.datos?.length > 0 ? (
                                                                                            consolidadoData.consolidado.general.datos.map((item: any, idx: number) => {
                                                                                                const getResultadoStyle = (resultado?: string) => {
                                                                                                    switch (resultado) {
                                                                                                        case 'CONFORME': return 'bg-green-100 text-green-700 border-green-200';
                                                                                                        case 'SOBRANTE': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
                                                                                                        case 'FALTANTE': return 'bg-red-100 text-red-700 border-red-200';
                                                                                                        default: return 'bg-gray-100 text-gray-700 border-gray-200';
                                                                                                    }
                                                                                                };
                                                                                                const getResultadoIcon = (resultado?: string) => {
                                                                                                    switch (resultado) {
                                                                                                        case 'CONFORME': return <CheckCircle2 className="w-3 h-3 mr-1" />;
                                                                                                        case 'SOBRANTE': return <Info className="w-3 h-3 mr-1" />;
                                                                                                        case 'FALTANTE': return <AlertTriangle className="w-3 h-3 mr-1" />;
                                                                                                        default: return null;
                                                                                                    }
                                                                                                };
                                                                                                return (
                                                                                                    <tr key={idx} className="hover:bg-green-50/50 transition-colors h-[54px]">
                                                                                                        <td className="px-3 py-2 text-left text-[11px] text-[#002D5A] font-bold" title={item.producto}>
                                                                                                            <div className="line-clamp-2 leading-tight break-words whitespace-normal w-full min-w-[170px] pr-2">
                                                                                                                {item.producto}
                                                                                                            </div>
                                                                                                        </td>
                                                                                                        <td className="px-3 py-2 text-center text-[11px] text-gray-600 whitespace-nowrap">{item.total_sistema || 0}</td>
                                                                                                        <td className="px-3 py-2 text-center text-[11px] text-[#002D5A] font-extrabold whitespace-nowrap">{item.total_fisico || 0}</td>
                                                                                                        <td className={`px-3 py-2 text-center text-[11px] font-bold whitespace-nowrap ${item.diferencia < 0 ? 'text-red-500' : item.diferencia > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                                                                                                            {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                                                                                                        </td>
                                                                                                        <td className="px-3 py-2 text-center whitespace-nowrap">
                                                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${getResultadoStyle(item.resultado)}`}>
                                                                                                                {getResultadoIcon(item.resultado)}
                                                                                                                {item.resultado || 'N/A'}
                                                                                                            </span>
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                );
                                                                                            })
                                                                                        ) : (
                                                                                            <tr>
                                                                                                <td colSpan={5} className="px-3 py-8 text-center text-xs text-gray-400">Sin datos</td>
                                                                                            </tr>
                                                                                        )}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Listado de Proformas */}
                                                            {proformasData.length > 0 && tabActiva === 'proformas' && !loadingDetalle && (
                                                                <div className="p-4">
                                                                    <div className="flex justify-between items-start mb-6">
                                                                        <div className="flex items-center gap-3">
                                                                            <div>
                                                                                <h4 className="font-extrabold text-gray-900 text-xl tracking-tight leading-tight">Proformas Emitidas</h4>
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                    <span className="text-gray-500 text-xs font-medium">Historial detallado de registro de proformas en el sistema</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={() => handleDescargarPDFProformas()}
                                                                                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all text-xs shadow-sm hover:shadow-md active:scale-95 border border-red-700/50"
                                                                            >
                                                                                <FileDown className="w-4 h-4" />
                                                                                <span className="hidden sm:inline">Exportar PDF</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                                                                        <div className="overflow-auto max-h-[500px]">
                                                                            <table className="w-full text-sm">
                                                                                <thead className="sticky top-0 z-10">
                                                                                    <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">N° Proforma</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Almacén</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Asesor</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Cantidad Total</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Estado</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Archivo</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Fecha</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-100">
                                                                                    {proformasData.map((proforma, idx) => {
                                                                                        // Determinar el estado: usar el campo estado del backend o determinar basado en archivo_pdf
                                                                                        let estadoTexto = 'PROFORMA INGRESADA';
                                                                                        let estadoColor = 'bg-blue-100 text-blue-700 border-blue-200';

                                                                                        if (proforma.estado) {
                                                                                            // Si viene el estado del backend, usarlo
                                                                                            if (proforma.estado === 'TIENE COMPROBANTE') {
                                                                                                estadoTexto = 'Tiene comprobante';
                                                                                                estadoColor = 'bg-green-100 text-green-700 border-green-200';
                                                                                            } else if (proforma.estado === 'PROFORMA INGRESADA') {
                                                                                                estadoTexto = 'PROFORMA INGRESADA';
                                                                                                estadoColor = 'bg-blue-100 text-blue-700 border-blue-200';
                                                                                            }
                                                                                        } else {
                                                                                            // Si no viene el estado, determinar basado en archivo_pdf
                                                                                            const tieneComprobante = proforma.archivo_pdf && proforma.archivo_pdf.trim() !== '';
                                                                                            if (tieneComprobante) {
                                                                                                estadoTexto = 'Tiene comprobante';
                                                                                                estadoColor = 'bg-green-100 text-green-700 border-green-200';
                                                                                            }
                                                                                        }

                                                                                        return (
                                                                                            <tr key={proforma.proforma_id} className={`hover:bg-blue-50/50 transition-colors border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                                                                                <td className="px-3 py-3 text-[10px] font-semibold text-gray-900 uppercase">{proforma.numero_proforma}</td>
                                                                                                <td className="px-3 py-3 text-[10px] text-gray-700 uppercase font-bold text-[#0B3B8C]">{proforma.almacen}</td>
                                                                                                <td className="px-3 py-3 text-[10px] text-gray-600 uppercase">{proforma.asesor || '-'}</td>
                                                                                                <td className="px-3 py-3 text-[10px] text-gray-600">{proforma.cantidad_total_items}</td>
                                                                                                <td className="px-3 py-3 text-[10px]">
                                                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${estadoColor}`}>
                                                                                                        {estadoTexto}
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td className="px-3 py-3 text-[10px]">
                                                                                                    {proforma.archivo_pdf ? (
                                                                                                        <button
                                                                                                            onClick={() => descargarProformaPDF(proforma.archivo_pdf || null)}
                                                                                                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg text-[9px] font-bold hover:opacity-90 transition-all duration-200 shadow-sm"
                                                                                                        >
                                                                                                            <FileText className="w-3 h-3" />
                                                                                                            <span>PDF</span>
                                                                                                        </button>
                                                                                                    ) : (
                                                                                                        <span className="text-gray-400 text-[9px] italic">No disponible</span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="px-3 py-3 text-[10px] text-gray-500">{formatearFecha(proforma.fecha_hora_registro)}</td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Listado de Verificaciones */}
                                                            {verificacionesData.length > 0 && tabActiva === 'verificaciones' && !loadingDetalle && (
                                                                <div className="p-4">
                                                                    <div className="flex justify-between items-start mb-6">
                                                                        <div className="flex items-center gap-3">
                                                                            <div>
                                                                                <h4 className="font-extrabold text-gray-900 text-xl tracking-tight leading-tight">Verificaciones Registradas</h4>
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                    <span className="text-gray-500 text-xs font-medium">Historial completo de verificaciones realizadas en almacenes</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={() => handleDescargarPDFVerificaciones()}
                                                                                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all text-xs shadow-sm hover:shadow-md active:scale-95 border border-red-700/50"
                                                                            >
                                                                                <FileDown className="w-4 h-4" />
                                                                                <span className="hidden sm:inline">Exportar PDF</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                                                                        <div className="overflow-auto max-h-[500px]">
                                                                            <table className="w-full text-sm">
                                                                                <thead className="sticky top-0 z-10">
                                                                                    <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Producto</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Código</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Almacén</th>
                                                                                        <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Estado</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Stock Físico</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Stock Sistema</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Registrado Por</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Fecha</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-100">
                                                                                    {verificacionesData.map((verif, idx) => (
                                                                                        <tr key={verif.verificacion_id} className={`hover:bg-blue-50/50 transition-colors border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                                                                            <td className="px-3 py-3 text-[10px] font-semibold text-gray-900 uppercase" title={verif.producto}>{verif.producto}</td>
                                                                                            <td className="px-3 py-3 text-[10px] text-gray-600 uppercase">{verif.codigo_producto}</td>
                                                                                            <td className="px-3 py-3 text-[10px] text-gray-700 uppercase font-bold text-[#0B3B8C]">{verif.almacen}</td>
                                                                                            <td className="px-3 py-3 text-[10px] text-center">
                                                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${verif.estado_verificacion === 'CONFORME' ? 'bg-green-100 text-green-700' :
                                                                                                    verif.estado_verificacion === 'ERROR_SISTEMA' ? 'bg-red-100 text-red-700' :
                                                                                                        verif.estado_verificacion === 'ERROR_LOGISTICA' ? 'bg-yellow-100 text-yellow-700' :
                                                                                                            'bg-gray-100 text-gray-700'
                                                                                                    }`}>
                                                                                                    {verif.estado_verificacion}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="px-3 py-3 text-[10px] text-gray-600">{verif.stock_fisico || '-'}</td>
                                                                                            <td className="px-3 py-3 text-[10px] text-gray-600">{verif.stock_sistema || '-'}</td>
                                                                                            <td className="px-3 py-3 text-[10px] text-gray-600 uppercase">{verif.registrado_por}</td>
                                                                                            <td className="px-3 py-3 text-[10px] text-gray-500">{formatearFecha(verif.fecha_hora)}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Listado de Acciones */}
                                                            {accionesData.length > 0 && tabActiva === 'acciones' && !loadingDetalle && (
                                                                <div className="p-4">
                                                                    <div className="flex justify-between items-start mb-6">
                                                                        <div className="flex items-center gap-3">
                                                                            <div>
                                                                                <h4 className="font-extrabold text-gray-900 text-xl tracking-tight leading-tight">Acciones Realizadas</h4>
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                    <span className="text-gray-500 text-xs font-medium">Historial de acciones y ajustes aplicados a los stocks</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={() => handleDescargarPDFAcciones()}
                                                                                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all text-xs shadow-sm hover:shadow-md active:scale-95 border border-red-700/50"
                                                                            >
                                                                                <FileDown className="w-4 h-4" />
                                                                                <span className="hidden sm:inline">Exportar PDF</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                                                                        <div className="overflow-auto max-h-[500px]">
                                                                            <table className="w-full text-sm">
                                                                                <thead className="sticky top-0 z-10">
                                                                                    <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Producto</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Código</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Almacén</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Tipo Acción</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Motivo</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Cantidad Afectada</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Registrado Por</th>
                                                                                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Fecha</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-100">
                                                                                    {accionesData.map((accion, idx) => (
                                                                                        <tr key={accion.accion_id} className={`hover:bg-blue-50/50 transition-colors border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                                                                            <td className="px-3 py-3 text-[10px] font-semibold text-gray-900 uppercase" title={accion.producto}>{accion.producto}</td>
                                                                                            <td className="px-3 py-3 text-[10px] text-gray-600 uppercase">{accion.codigo}</td>
                                                                                            <td className="px-3 py-3 text-[10px] text-gray-700 uppercase font-bold text-[#0B3B8C]">{accion.almacen}</td>
                                                                                            <td className="px-3 py-3 text-[10px]">
                                                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700">
                                                                                                    {accion.tipo_accion}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="px-3 py-3 text-[10px] text-gray-600 uppercase" title={accion.motivo || ''}>{accion.motivo || '-'}</td>
                                                                                            <td className="px-3 py-3 text-[10px] font-bold text-gray-400">{accion.cantidad_afectada || '-'}</td>
                                                                                            <td className="px-3 py-3 text-[10px] text-gray-600 uppercase">{accion.registrado_por}</td>
                                                                                            <td className="px-3 py-3 text-[10px] text-gray-500">{formatearFecha(accion.fecha_hora)}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Listado de Conteos */}
                                                    {conteosData.length > 0 && vistaActiva === 'conteos' && (
                                                        <div className="mt-3">
                                                            <div className="flex justify-between items-center mb-3">
                                                                <h4 className="font-bold text-gray-900 text-sm">Conteos por Almacén ({conteosData.length})</h4>
                                                                <button
                                                                    onClick={() => setConteosData([])}
                                                                    className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-sm">
                                                                        <thead>
                                                                            <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Almacén</th>
                                                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">N° Inventario</th>
                                                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Tipo/Tienda</th>
                                                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Registrado Por</th>
                                                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Inicio</th>
                                                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Fin</th>
                                                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Autorizado</th>
                                                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Acciones</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-100">
                                                                            {conteosData.map((conteo, idx) => (
                                                                                <tr key={conteo.conteo_id} className={`hover:bg-blue-50/50 transition-colors border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                                                                    <td className="px-3 py-3 text-[10px] text-gray-700 uppercase font-bold">{conteo.almacen}</td>
                                                                                    <td className="px-3 py-3 text-[10px] text-gray-900 font-semibold uppercase">{conteo.numero_inventario}</td>
                                                                                    <td className="px-3 py-3 text-[10px] text-gray-600 uppercase">{conteo.tipo_conteo_tienda}</td>
                                                                                    <td className="px-3 py-3 text-[10px] text-gray-600 uppercase">{conteo.registrado_por}</td>
                                                                                    <td className="px-3 py-3 text-[10px] text-gray-600 uppercase">{formatearFecha(conteo.fecha_hora_inicio)}</td>
                                                                                    <td className="px-3 py-3 text-[10px] text-gray-600 uppercase">{formatearFecha(conteo.fecha_hora_final)}</td>
                                                                                    <td className="px-3 py-3 text-[10px] text-gray-600 uppercase">{conteo.autorizado || '-'}</td>
                                                                                    <td className="px-3 py-3 text-center">
                                                                                        <div className="flex items-center justify-center gap-2">
                                                                                            <button
                                                                                                onClick={() => handleVerDetalleConteo(conteo.conteo_id)}
                                                                                                className="flex items-center justify-center px-3 py-1.5 rounded-full bg-[#002D5A] text-white hover:bg-[#001F3D] transition-all shadow-sm"
                                                                                                title="Ver detalle del conteo"
                                                                                            >
                                                                                                <Eye className="w-3.5 h-3.5" />
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleDescargarPDFConteo(conteo)}
                                                                                                className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all shadow-sm"
                                                                                                title="Descargar PDF"
                                                                                            >
                                                                                                <FileText className="w-3.5 h-3.5" />
                                                                                                <span className="text-[10px] font-bold">PDF</span>
                                                                                            </button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Modal para ver detalle del conteo */}
            {modalDetalleConteo.open && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-start p-4 border-b border-gray-200">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-[#002D5A] to-[#004a8d] rounded-xl flex items-center justify-center text-white shadow-md">
                                    <ClipboardCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 m-0 leading-tight" style={{ fontSize: '20px' }}>
                                        Detalle del Conteo
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Visualiza los productos registrados en este conteo de inventario
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModalDetalleConteo({ open: false, conteoId: null, datos: [] })}
                                className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 p-4">
                            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                                <div className="overflow-x-auto overflow-y-auto max-h-[calc(90vh-200px)]">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap" style={{ backgroundColor: '#002D5A' }}>Item</th>
                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap" style={{ backgroundColor: '#002D5A' }}>Producto</th>
                                                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap" style={{ backgroundColor: '#002D5A' }}>Código</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap" style={{ backgroundColor: '#002D5A' }}>Cantidad</th>
                                                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap" style={{ backgroundColor: '#002D5A' }}>U.M.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {modalDetalleConteo.datos.length > 0 ? (
                                                modalDetalleConteo.datos.map((producto: any, idx: number) => (
                                                    <tr key={idx} className={`hover:bg-blue-50/50 transition-colors border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                                        <td className="px-3 py-4 text-xs font-medium text-gray-900 uppercase">{producto.item_producto || producto.item || '-'}</td>
                                                        <td className="px-3 py-4 text-xs font-semibold text-gray-900 uppercase" title={producto.producto || '-'}>{producto.producto || '-'}</td>
                                                        <td className="px-3 py-4 text-xs text-gray-600 uppercase">{producto.codigo || '-'}</td>
                                                        <td className="px-3 py-4 text-xs text-center font-bold text-gray-900">{producto.cantidad || producto.cantidad_fisica || producto.cantidad_conteo || '0'}</td>
                                                        <td className="px-3 py-4 text-xs text-center text-gray-600 uppercase">{producto.unidad_medida || 'UND'}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-3 py-8 text-center text-xs text-gray-400">No hay datos disponibles</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
