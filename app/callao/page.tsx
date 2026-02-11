'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useInventory, fmt12 } from '@/context/InventoryContext';
import { apiCall } from '@/lib/api';
import { Building, Box, Columns, PlayCircle, FileText, Search, ShieldCheck, Loader2 } from 'lucide-react';
import IniciarConteoModal from '@/components/modals/IniciarConteoModal';
import Modal from '@/components/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function CallaoPage() {
    const { state, setState, updateSesionActual, showAlert, showConfirm } = useInventory();
    const [filterText, setFilterText] = useState('');
    const [isIniciarOpen, setIsIniciarOpen] = useState(false);
    const [tipoConteo, setTipoConteo] = useState<'cajas' | 'stand'>('cajas');

    // Control de flujo de conteo
    const [currentConteo, setCurrentConteo] = useState<any>(null);
    const [showTable, setShowTable] = useState(false);
    const [tableFilter, setTableFilter] = useState('');
    const [isAvisoOpen, setIsAvisoOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const checkExistingCount = async (tipo: 'cajas' | 'stand') => {
        // 1. Verificar primero en el estado local (incluye optimistas)
        if (state.sesiones.callao) {
            const existsLocally = state.sesiones.callao.some((s: any) =>
                s.numero === state.sesionActual.numero && s.tipo === tipo
            );
            if (existsLocally) return true;
        }

        // 2. Verificar en API (por si acaso el estado local no está completo)
        if (!state.sesionActual.inventario_id) return false;
        try {
            const response = await apiCall(`obtener_detalle_conteo&conteo_id=${state.sesionActual.inventario_id}`, 'GET');
            if (response.success && response.productos) {
                return response.productos.some((p: any) => p.tipo_conteo === tipo);
            }
        } catch (e) {
            console.error(e);
        }
        return false;
    };

    const cargarSesionesAPI = React.useCallback(async () => {
        try {
            const response = await apiCall('obtener_historial', 'GET');
            if (response.success && response.inventarios) {
                const filtered = response.inventarios
                    .filter((inv: any) => inv.almacen === 'Callao')
                    .map((inv: any) => ({
                        id: inv.id,
                        numero: inv.numero_inventario,
                        registrado: inv.autorizado_por,
                        inicio: inv.fecha_inicio,
                        fin: inv.fecha_fin,
                        pdfUrl: inv.archivo_pdf,
                        tipo: inv.tipo_conteo || 'cajas',
                        filas: []
                    }));
                setState((prev: any) => ({
                    ...prev,
                    sesiones: { ...prev.sesiones, callao: filtered }
                }));
            }
        } catch (e) {
            console.error('Error al cargar historial:', e);
        }
    }, [setState]);

    useEffect(() => {
        cargarSesionesAPI();
    }, [cargarSesionesAPI]);

    const handleIniciarConfirm = (data: any) => {
        setCurrentConteo({
            ...data,
            filas: state.productos.map(p => ({
                ...p,
                cantidad_conteo: ''
            }))
        });
        setIsIniciarOpen(false);
        setIsAvisoOpen(true);
    };

    const handleAvisoEntendido = () => {
        setIsAvisoOpen(false);
    };

    const handleUpdateCantidad = (codigo: string, valor: string) => {
        if (!currentConteo) return;
        const nuevasFilas = currentConteo.filas.map((f: any) =>
            f.codigo === codigo ? { ...f, cantidad_conteo: valor } : f
        );
        setCurrentConteo({ ...currentConteo, filas: nuevasFilas });
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentConteo) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                let updatedCount = 0;
                const newFilas = currentConteo.filas.map((fila: any) => {
                    // Buscar en el excel una fila que coincida con el código
                    // Normalizamos las claves del excel a minúsculas para buscar 'codigo'
                    const match = data.find((row: any) => {
                        const keys = Object.keys(row);
                        const codigoKey = keys.find(k => k.toLowerCase().includes('codigo') || k.toLowerCase().includes('código'));
                        if (!codigoKey) return false;
                        return String(row[codigoKey]).trim() === String(fila.codigo).trim();
                    });

                    if (match) {
                        const keys = Object.keys(match);
                        const cantKey = keys.find(k => k.toLowerCase().includes('cantidad') || k.toLowerCase().includes('cant') || k.toLowerCase().includes('conteo'));
                        if (cantKey) {
                            updatedCount++;
                            const val = (match as any)[cantKey];
                            return { ...fila, cantidad_conteo: val !== undefined && val !== null ? String(val) : '' };
                        }
                    }
                    return fila;
                });

                if (updatedCount > 0) {
                    setCurrentConteo({ ...currentConteo, filas: newFilas });
                    setShowTable(true);
                    showAlert('Carga Exitosa', `Se actualizaron ${updatedCount} productos desde el archivo.`, 'success');
                } else {
                    showAlert('Aviso', 'No se encontraron coincidencias de CÓDIGO en el archivo. Verifique las columnas.', 'warning');
                }
            } catch (error) {
                console.error(error);
                showAlert('Error', 'Hubo un problema al procesar el archivo Excel.', 'error');
            }
        };
        reader.readAsBinaryString(file);
        // Limpiar input para permitir subir el mismo archivo de nuevo si es necesario
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRegistrarInventario = async () => {
        if (!currentConteo) return;

        const count = currentConteo.filas.filter((f: any) => f.cantidad_conteo !== '').length;
        if (count < currentConteo.filas.length) {
            showConfirm(
                '¿Continuar registro?',
                `Hay ${currentConteo.filas.length - count} productos sin cantidad. ¿Deseas continuar?`,
                proceedWithRegistration
            );
            return;
        }

        proceedWithRegistration();
    };

    const proceedWithRegistration = async () => {
        if (!currentConteo) return;
        setIsSubmitting(true);
        try {
            const dataToSave = {
                ...currentConteo,
                fin: fmt12(),
                tipo: currentConteo.tipo,
                filas: currentConteo.filas.map((f: any) => ({
                    ...f,
                    cantidad: f.cantidad_conteo || '0',
                    unidad_medida: f.unidad_medida || 'UND'
                }))
            };

            // Guardar solo los que tienen conteo (o ceros explícitos si fuera necesario, pero mantenemos la lógica de no ensuciar BD con vacíos)
            const filasAGuardar = currentConteo.filas.filter((f: any) => f.cantidad_conteo !== '');

            for (const fila of filasAGuardar) {
                const val = Number(fila.cantidad_conteo);
                await apiCall('registrar_conteo', 'POST', {
                    inventario_id: state.sesionActual.inventario_id,
                    detalle_id: fila.id || fila.codigo,
                    cantidad_fisica: isNaN(val) ? 0 : val,
                    observacion: '',
                    fecha: fmt12(),
                    tipo_conteo: currentConteo.tipo,
                    almacen: 'Callao',
                    registrado_por: currentConteo.registrado
                });
            }

            showAlert('¡Éxito!', 'Inventario registrado correctamente.', 'success');

            // Actualización optimista del historial
            const newItem = {
                id: `temp-${Date.now()}`,
                numero: currentConteo.numero,
                registrado: currentConteo.registrado,
                inicio: currentConteo.inicio,
                fin: fmt12(),
                pdfUrl: null, // El PDF se generará/vinculará posteriormente
                tipo: currentConteo.tipo,
                filas: currentConteo.filas.map((f: any) => ({
                    ...f,
                    cantidad: f.cantidad_conteo || '0',
                    unidad_medida: f.unidad_medida || 'UND'
                }))
            };

            setState((prev: any) => ({
                ...prev,
                sesiones: {
                    ...prev.sesiones,
                    callao: [...(prev.sesiones.callao || []), newItem]
                }
            }));

            setCurrentConteo(null);
            setShowTable(false);
            // cargarSesionesAPI(); // Se comenta para mantener el update optimista
        } catch (e) {
            console.error(e);
            showAlert('Error', 'Error al registrar inventario', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadPDF = async (sesion: any) => {
        try {
            let filas = sesion.filas || [];

            // Si no hay filas (historial antiguo), cargar detalle
            if (filas.length === 0 && sesion.id && !String(sesion.id).startsWith('temp-')) {
                const response = await apiCall(`obtener_detalle_conteo&conteo_id=${sesion.id}`, 'GET');
                if (response.success && response.productos) {
                    filas = response.productos.map((p: any) => ({
                        item: p.item,
                        producto: p.producto,
                        codigo: p.codigo,
                        cantidad: p.cantidad_fisica,
                        unidad_medida: p.unidad_medida
                    }));
                }
            }

            if (filas.length === 0) {
                showAlert('Información', 'No hay detalles para generar el PDF.', 'warning');
                return;
            }

            const doc = new jsPDF();

            // Encabezado
            doc.setFontSize(18);
            doc.text(`Inventario Callao – ${sesion.numero}`, 14, 20);

            doc.setFontSize(10);
            doc.text(`Registrado por: ${sesion.registrado}`, 14, 30);
            doc.text(`Fecha Inicio: ${sesion.inicio} - Fecha Fin: ${sesion.fin || 'En curso'}`, 14, 36);

            // Tabla
            const tableBody = filas.map((f: any) => [
                f.item || '-',
                f.producto,
                f.codigo,
                f.cantidad || f.cantidad_conteo || '0',
                f.unidad_medida || 'UND'
            ]);

            autoTable(doc, {
                startY: 45,
                head: [['Item', 'Producto', 'Código', 'Cantidad', 'U.M.']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [11, 59, 140] }, // #0B3B8C
            });

            doc.save(`Inventario_Callao_${sesion.numero}.pdf`);

        } catch (error) {
            console.error('Error generando PDF:', error);
            showAlert('Error', 'No se pudo generar el PDF', 'error');
        }
    };

    const handleGenerateReport = () => {
        try {
            const dataToExport = state.sesiones.callao?.filter((s: any) =>
                s.numero.toLowerCase().includes(filterText.toLowerCase()) ||
                s.registrado.toLowerCase().includes(filterText.toLowerCase())
            ) || [];

            if (dataToExport.length === 0) {
                showAlert('Aviso', 'No hay datos para exportar.', 'warning');
                return;
            }

            const doc = new jsPDF();
            doc.text('Historial de Inventarios - Callao', 14, 20);
            doc.setFontSize(10);
            doc.text(`Fecha de reporte: ${new Date().toLocaleString()}`, 14, 30);

            const tableBody = dataToExport.map((s: any, idx: number) => [
                idx + 1,
                s.inicio,
                s.numero,
                s.tipo.toUpperCase(),
                s.registrado,
                s.fin || '-'
            ]);

            autoTable(doc, {
                startY: 40,
                head: [['#', 'Fecha Registro', 'N° Inventario', 'Tipo', 'Registrado Por', 'Hora Final']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [11, 59, 140] },
            });

            doc.save(`Reporte_Historial_Callao_${Date.now()}.pdf`);
        } catch (e) {
            console.error(e);
            showAlert('Error', 'No se pudo generar el reporte.', 'error');
        }
    };

    const filtradas = currentConteo ? currentConteo.filas.filter((f: any) =>
        f.producto.toLowerCase().includes(tableFilter.toLowerCase()) ||
        f.codigo.toLowerCase().includes(tableFilter.toLowerCase())
    ) : [];

    return (
        <div id="view-callao" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 transition-all">
                    <header className="flex justify-between items-start flex-wrap gap-4 mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-[#002D5A] to-[#002D5A] rounded-xl flex items-center justify-center text-white shadow-sm">
                                <Building className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0" style={{ fontSize: '22px' }}>
                                    Almacén Callao
                                </h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    Gestiona el inventario del almacén Callao
                                </p>
                            </div>
                        </div>
                        <div className="header-actions flex gap-3">
                            <button
                                onClick={async () => {
                                    if (!state.sesionActual.activo) { showAlert('Error', 'Asigne un N° de Inventario primero', 'error'); return; }

                                    const exists = await checkExistingCount('cajas');
                                    if (exists) {
                                        showAlert('Atención', `El conteo por CAJAS ya fue registrado para el inventario ${state.sesionActual.numero}.`, 'warning');
                                        return;
                                    }

                                    setTipoConteo('cajas');
                                    setIsIniciarOpen(true);
                                }}
                                className="flex items-center space-x-1.5 px-6 py-2 bg-gradient-to-br from-[#E9F1FF] to-[#D9E6FF] hover:from-[#D9E6FF] hover:to-[#C9D6FF] text-[#0B3B8C] rounded-full btn-oval font-semibold hover:shadow-md hover:scale-105 transition-all duration-200 shadow-sm active:scale-[0.98] text-xs"
                            >
                                <Box className="w-4 h-4" />
                                <span>Conteo por Cajas</span>
                            </button>
                            <button
                                onClick={async () => {
                                    if (!state.sesionActual.activo) { showAlert('Error', 'Asigne un N° de Inventario primero', 'error'); return; }

                                    const exists = await checkExistingCount('stand');
                                    if (exists) {
                                        showAlert('Atención', `El conteo por STAND ya fue registrado para el inventario ${state.sesionActual.numero}.`, 'warning');
                                        return;
                                    }

                                    setTipoConteo('stand');
                                    setIsIniciarOpen(true);
                                }}
                                className="flex items-center space-x-1.5 px-6 py-2 bg-gradient-to-br from-[#E9F1FF] to-[#D9E6FF] hover:from-[#D9E6FF] hover:to-[#C9D6FF] text-[#0B3B8C] rounded-full btn-oval font-semibold hover:shadow-md hover:scale-105 transition-all duration-200 shadow-sm active:scale-[0.98] text-xs"
                            >
                                <Columns className="w-4 h-4" />
                                <span className="whitespace-nowrap">Conteo de Stand</span>
                            </button>
                        </div>
                    </header>

                    {/* Panel de Conteo Activo */}
                    {currentConteo && (
                        <div className="mb-6 p-4 rounded-2xl border-2 border-[#E9F1FF] bg-[#F8FAFF] animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-[#0B3B8C] uppercase tracking-wider">Inventario actual:</span>
                                        <span className="px-2 py-0.5 bg-[#0B3B8C] text-white text-xs font-bold rounded-lg">{currentConteo.numero}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 font-medium">
                                        Registrado por: <span className="text-[#0B3B8C] font-bold">{currentConteo.registrado}</span>
                                        <span className="mx-2">•</span>
                                        Inicio: <span className="text-[#0B3B8C] font-bold">{currentConteo.inicio}</span>
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white rounded-full btn-oval font-bold shadow-sm transition-all text-xs"
                                    >
                                        <PlayCircle className="w-4 h-4" />
                                        <span>Subir (Emergencia)</span>
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => setShowTable(true)}
                                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full btn-oval font-bold shadow-sm transition-all text-xs"
                                    >
                                        <PlayCircle className="w-4 h-4" />
                                        <span>Empezar Inventario</span>
                                    </button>
                                </div>
                            </div>

                            {/* Tabla de Conteo */}
                            {showTable && (
                                <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="relative flex-grow max-w-lg">
                                            <input
                                                type="text"
                                                className="w-full bg-white border-2 border-gray-100 text-sm rounded-xl pl-10 p-2.5 focus:border-[#0B3B8C] outline-none transition-all"
                                                placeholder="Buscar por producto o código..."
                                                value={tableFilter}
                                                onChange={(e) => setTableFilter(e.target.value)}
                                            />
                                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                        <div className="max-h-[500px] overflow-y-auto">
                                            <table className="w-full text-left">
                                                <thead className="sticky top-0 z-10">
                                                    <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-white uppercase tracking-wider">ITEM</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-white uppercase tracking-wider">PRODUCTO</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-white uppercase tracking-wider">CÓDIGO</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-white uppercase tracking-wider">CANTIDAD</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-white uppercase tracking-wider">U.M.</th>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-white uppercase tracking-wider">ESTADO</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {filtradas.map((p: any, idx: number) => (
                                                        <tr key={p.codigo} className="hover:bg-blue-50/30 transition-colors">
                                                            <td className="px-4 py-3 text-xs text-gray-500">{p.item || idx + 1}</td>
                                                            <td className="px-4 py-3 text-xs font-bold text-gray-900">{p.producto}</td>
                                                            <td className="px-4 py-3 text-xs text-gray-600">{p.codigo}</td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="number"
                                                                    className="w-24 px-2 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold focus:border-[#0B3B8C] outline-none transition-all"
                                                                    value={p.cantidad_conteo}
                                                                    onChange={(e) => handleUpdateCantidad(p.codigo, e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-xs text-gray-500">{p.unidad_medida || 'UND'}</td>
                                                            <td className="px-4 py-3">
                                                                {p.cantidad_conteo === '' ? (
                                                                    <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg uppercase">Pendiente</span>
                                                                ) : (
                                                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-lg uppercase">Registrado</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-4">
                                        <button
                                            onClick={handleRegistrarInventario}
                                            disabled={isSubmitting}
                                            className={`px-8 py-2.5 bg-[#0B3B8C] text-white rounded-full btn-oval font-bold shadow-md hover:bg-[#002D5A] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Registrando...</span>
                                                </>
                                            ) : (
                                                'Registrar Inventario'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-4 mb-4">
                        <h5 className="m-0 font-bold text-slate-800 text-xl tracking-tight">Historial de Conteos</h5>
                        <div className="flex gap-3">
                            <div className="relative">
                                <input
                                    type="text"
                                    className="bg-white border-2 border-gray-200 text-sm rounded-xl block w-64 pl-10 p-2.5 focus:border-[#0B3B8C] outline-none transition-all shadow-sm"
                                    placeholder="Buscar..."
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                />
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                            </div>
                            <button
                                onClick={handleGenerateReport}
                                className="bg-white border-2 border-[#0B3B8C] text-[#0B3B8C] font-bold px-6 py-2 rounded-full btn-oval flex items-center gap-2 hover:bg-blue-50 transition-colors text-sm shadow-sm"
                            >
                                <FileText className="w-4 h-4" />
                                <span>Generar reporte</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ID</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">FECHA REGISTRO</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">N° INVENTARIO</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">TIPO</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">REGISTRADO POR</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ARCHIVO</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">HORA FINAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(state.sesiones.callao || []).length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-12 text-center text-sm text-gray-500 font-medium italic">
                                                No hay registros aún
                                            </td>
                                        </tr>
                                    ) : (
                                        state.sesiones.callao.map((s: any, idx: number) => (
                                            <tr key={s.id} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                                                <td className="px-4 py-3 whitespace-nowrap text-[10px] font-medium text-gray-900">{idx + 1}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-700">{s.inicio}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-700">{s.numero}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[10px] font-bold text-[#0B3B8C] uppercase">{s.tipo}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-700">{s.registrado}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-700">
                                                    <button
                                                        onClick={() => handleDownloadPDF(s)}
                                                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white border border-red-500 text-red-500 rounded-lg text-[10px] font-bold hover:bg-red-50 transition-all duration-200 shadow-sm"
                                                    >
                                                        <FileText className="w-3 h-3" />
                                                        <span>PDF</span>
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-700">{s.fin || '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <IniciarConteoModal
                isOpen={isIniciarOpen}
                onClose={() => setIsIniciarOpen(false)}
                almacen="Callao"
                tipo={tipoConteo}
                onConfirm={handleIniciarConfirm}
            />

            <Modal
                isOpen={isAvisoOpen}
                onClose={handleAvisoEntendido}
                title={<div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-amber-500" /> <span>Aviso de Prioridad de Conteo</span></div>}
                footer={
                    <button className="px-8 py-2.5 bg-[#0B3B8C] text-white rounded-xl font-bold hover:bg-[#002D5A] transition-all" onClick={handleAvisoEntendido}>
                        Entendido
                    </button>
                }
            >
                <div className="p-2 space-y-4">
                    <p className="text-sm font-medium text-gray-700">A partir de este momento el inventario está <span className="font-bold underline">en curso</span>. Toda digitación tiene <span className="font-bold">prioridad operativa</span>.</p>
                    <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
                        <li>Verifique <span className="font-bold text-gray-800">código</span> y <span className="font-bold text-gray-800">descripción</span> del producto antes de registrar.</li>
                        <li>Ingrese la <span className="font-bold text-gray-800">cantidad exacta</span> y confirme visualmente el valor.</li>
                        <li>Evite correcciones repetidas y mantenga <span className="font-bold text-gray-800">concentración</span> durante el conteo.</li>
                        <li>Ante cualquier duda, <span className="font-bold text-gray-800">deténgase</span> y consulte al responsable.</li>
                    </ul>
                    <p className="text-[11px] text-gray-500 italic">El incumplimiento del procedimiento puede generar observaciones o sanciones conforme a las políticas internas. Al continuar usted declara conocer y cumplir el procedimiento.</p>
                </div>
            </Modal>
        </div>
    );
}
