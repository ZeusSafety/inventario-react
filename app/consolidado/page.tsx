'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useInventory } from '@/context/InventoryContext';
import { BarChart3, RefreshCw, Download, CheckCircle2, AlertTriangle, Info, PackageSearch } from 'lucide-react';
import { apiCall } from '@/lib/api';
import * as XLSX from 'xlsx';

interface ConsolidadoItem {
    id: number;
    producto_item: number;
    producto: string;
    codigo: string;
    sistema: number;
    fisico: number;
    diferencia: number;
    unidad_medida: string;
    total_sistema?: number;
    total_fisico?: number;
    resultado?: 'CONFORME' | 'SOBRANTE' | 'FALTANTE';
}

interface ResumenData {
    total_productos: number;
    total_sistema?: number;
    total_fisico?: number;
    gran_total_sistema?: number;
    gran_total_fisico?: number;
    diferencia_total: number;
    productos_sobrantes?: number;
    productos_faltantes?: number;
    productos_conformes?: number;
    total_sobrantes?: number;
    total_faltantes?: number;
    total_conformes?: number;
}

export default function ConsolidadoPage() {
    const { state, showAlert } = useInventory();
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [callaoData, setCallaoData] = useState<ConsolidadoItem[]>([]);
    const [malvinasData, setMalvinasData] = useState<ConsolidadoItem[]>([]);
    const [generalData, setGeneralData] = useState<ConsolidadoItem[]>([]);
    const [resumenCallao, setResumenCallao] = useState<ResumenData | null>(null);
    const [resumenMalvinas, setResumenMalvinas] = useState<ResumenData | null>(null);
    const [resumenGeneral, setResumenGeneral] = useState<ResumenData | null>(null);
    const hasFetchedRef = useRef(false);

    const inventoryId = state?.sesionActual?.inventario_id;

    const fetchConsolidados = useCallback(async () => {
        if (!inventoryId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setFetchError(null);
        
        try {
            // Timeout normal (60 segundos) - el backend ahora está optimizado
            const data = await apiCall(`obtener_consolidados_completos&inventario_id=${inventoryId}`);

            if (data.success) {
                const callaoConsolidado = data.callao?.consolidado || [];
                const malvinasConsolidado = data.malvinas?.consolidado || [];
                
                console.log('Datos recibidos - Callao:', callaoConsolidado.length, 'Malvinas:', malvinasConsolidado.length);
                
                // Crear mapa de Malvinas una sola vez (optimizado)
                const malvinasMap = new Map<string, ConsolidadoItem>();
                malvinasConsolidado.forEach((item: ConsolidadoItem) => {
                    const codigo = String(item.codigo || '').trim().toUpperCase();
                    if (codigo) {
                        malvinasMap.set(codigo, item);
                    }
                });
                
                // Ordenar Malvinas según el orden de Callao
                const sortedMalvinasData: ConsolidadoItem[] = [];
                const malvinasMapCopy = new Map(malvinasMap); // Copia para no modificar el original
                
                // Primero agregar los productos que están en Callao, en el mismo orden
                callaoConsolidado.forEach((callaoItem: ConsolidadoItem) => {
                    const codigo = String(callaoItem.codigo || '').trim().toUpperCase();
                    const malvinasItem = malvinasMapCopy.get(codigo);
                    if (malvinasItem) {
                        sortedMalvinasData.push(malvinasItem);
                        malvinasMapCopy.delete(codigo);
                    }
                });
                
                // Luego agregar los productos que solo están en Malvinas (al final)
                malvinasMapCopy.forEach((item) => {
                    sortedMalvinasData.push(item);
                });
                
                // Construir Conteo General de forma optimizada (usando el mapa original)
                const sortedGeneralData: ConsolidadoItem[] = [];
                
                // Procesar productos de Callao (en su orden)
                callaoConsolidado.forEach((callaoItem: ConsolidadoItem) => {
                    const codigo = String(callaoItem.codigo || '').trim().toUpperCase();
                    const malvinasItem = malvinasMap.get(codigo);
                    
                    // Calcular totales
                    const callaoSistema = Number(callaoItem.sistema || 0);
                    const callaoFisico = Number(callaoItem.fisico || 0);
                    const malvinasSistema = Number(malvinasItem?.sistema || 0);
                    const malvinasFisico = Number(malvinasItem?.fisico || 0);
                    
                    const totalSistema = callaoSistema + malvinasSistema;
                    const totalFisico = callaoFisico + malvinasFisico;
                    const diferencia = totalFisico - totalSistema;
                    
                    // Determinar resultado
                    let resultado: 'CONFORME' | 'SOBRANTE' | 'FALTANTE' = 'CONFORME';
                    if (totalFisico > totalSistema) {
                        resultado = 'SOBRANTE';
                    } else if (totalSistema > totalFisico) {
                        resultado = 'FALTANTE';
                    }
                    
                    sortedGeneralData.push({
                        id: callaoItem.id || 0,
                        producto_item: callaoItem.producto_item || 0,
                        producto: callaoItem.producto || '',
                        codigo: codigo,
                        sistema: callaoSistema,
                        fisico: callaoFisico,
                        diferencia: diferencia,
                        unidad_medida: callaoItem.unidad_medida || 'UNIDAD',
                        total_sistema: totalSistema,
                        total_fisico: totalFisico,
                        resultado: resultado,
                        callao_sistema: callaoSistema,
                        callao_fisico: callaoFisico,
                        malvinas_sistema: malvinasSistema,
                        malvinas_fisico: malvinasFisico
                    } as any);
                });
                
                // Agregar productos que solo están en Malvinas
                malvinasConsolidado.forEach((malvinasItem: ConsolidadoItem) => {
                    const codigo = String(malvinasItem.codigo || '').trim().toUpperCase();
                    // Solo agregar si no está en Callao (no está en sortedGeneralData)
                    const yaExiste = sortedGeneralData.some(item => item.codigo === codigo);
                    if (!yaExiste) {
                        const malvinasSistema = Number(malvinasItem.sistema || 0);
                        const malvinasFisico = Number(malvinasItem.fisico || 0);
                        
                        const totalSistema = malvinasSistema;
                        const totalFisico = malvinasFisico;
                        const diferencia = totalFisico - totalSistema;
                        
                        // Determinar resultado
                        let resultado: 'CONFORME' | 'SOBRANTE' | 'FALTANTE' = 'CONFORME';
                        if (totalFisico > totalSistema) {
                            resultado = 'SOBRANTE';
                        } else if (totalSistema > totalFisico) {
                            resultado = 'FALTANTE';
                        }
                        
                        sortedGeneralData.push({
                            id: malvinasItem.id || 0,
                            producto_item: malvinasItem.producto_item || 0,
                            producto: malvinasItem.producto || '',
                            codigo: codigo,
                            sistema: malvinasSistema,
                            fisico: malvinasFisico,
                            diferencia: diferencia,
                            unidad_medida: malvinasItem.unidad_medida || 'UNIDAD',
                            total_sistema: totalSistema,
                            total_fisico: totalFisico,
                            resultado: resultado,
                            callao_sistema: 0,
                            callao_fisico: 0,
                            malvinas_sistema: malvinasSistema,
                            malvinas_fisico: malvinasFisico
                        } as any);
                    }
                });
                
                // Actualizar todos los estados de una vez
                setCallaoData(callaoConsolidado);
                setMalvinasData(sortedMalvinasData);
                setGeneralData(sortedGeneralData);
                setResumenCallao(data.callao?.resumen || null);
                setResumenMalvinas(data.malvinas?.resumen || null);
                setResumenGeneral(data.general?.resumen || null);
                
                if (callaoConsolidado.length === 0 && malvinasConsolidado.length === 0 && sortedGeneralData.length === 0) {
                    setFetchError('No hay datos de consolidado. Asegúrate de haber cargado los archivos Excel de sistema para Callao y Malvinas.');
                } else {
                    setFetchError(null);
                }
            } else {
                const msg = data.message || 'Error al cargar los consolidados';
                if (!callaoData.length && !malvinasData.length && !generalData.length) {
                    setFetchError(msg);
                }
            }
        } catch (error: any) {
            console.error('Error fetching consolidados:', error);
            const errorMessage = error?.message || 'Error desconocido';
            
            // Distinguir entre timeout y otros errores
            if (errorMessage.includes('tardando demasiado')) {
                setFetchError('La carga está tardando más de lo esperado. Por favor, espere un momento y vuelva a intentar. El proceso puede tardar varios minutos con grandes volúmenes de datos.');
            } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('504')) {
                setFetchError('El servidor está procesando los datos. Por favor, espere unos momentos y vuelva a intentar. Este proceso puede tardar varios minutos.');
            } else {
                setFetchError(`Error al cargar los consolidados: ${errorMessage}`);
            }
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inventoryId]);

    // Cargar solo una vez cuando cambia el inventario - SIN recargas automáticas
    useEffect(() => {
        if (inventoryId && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            fetchConsolidados();
        }
        // Resetear flag si cambia el inventario
        if (!inventoryId) {
            hasFetchedRef.current = false;
        }
    }, [inventoryId]); // Solo depende de inventoryId, no de fetchConsolidados para evitar recargas

    // Escuchar eventos de actualización para recargar datos solo cuando sea necesario
    useEffect(() => {
        const handleProformaRegistrada = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { almacen, inventario_id } = customEvent.detail || {};
            
            // Solo recargar si es el mismo inventario
            if (inventoryId && inventario_id === inventoryId) {
                // Resetear flag para forzar recarga
                hasFetchedRef.current = false;
                // Delay más largo para dar tiempo al backend de regenerar completamente el consolidado
                // Aumentado a 3000ms para asegurar que el backend termine de regenerar
                setTimeout(() => {
                    fetchConsolidados();
                }, 3000);
            }
        };

        // Escuchar evento cuando se actualiza Comparar
        const handleCompararActualizado = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { inventario_id } = customEvent.detail || {};
            
            // Solo recargar si es el mismo inventario
            if (inventoryId && inventario_id === inventoryId) {
                // Resetear flag para forzar recarga
                hasFetchedRef.current = false;
                // Delay para dar tiempo al backend de procesar
                setTimeout(() => {
                    fetchConsolidados();
                }, 500);
            }
        };

        window.addEventListener('proformaRegistrada', handleProformaRegistrada);
        window.addEventListener('compararActualizado', handleCompararActualizado);
        
        return () => {
            window.removeEventListener('proformaRegistrada', handleProformaRegistrada);
            window.removeEventListener('compararActualizado', handleCompararActualizado);
        };
    }, [fetchConsolidados, inventoryId]);

    const handleGenerarConsolidados = async () => {
        if (!inventoryId) {
            showAlert('Atención', 'No hay un inventario activo seleccionado', 'warning');
            return;
        }

        setGenerating(true);
        try {
            const data = await apiCall('generar_todos_consolidados', 'POST', { inventario_id: inventoryId });

            if (data.success) {
                showAlert('Éxito', 'Consolidados generados correctamente', 'success');
                hasFetchedRef.current = false;
                fetchConsolidados();
            } else {
                showAlert('Error', data.message || 'Error al generar los consolidados', 'error');
            }
        } catch (error) {
            console.error('Error generating consolidados:', error);
            showAlert('Error', 'Error de conexión al servidor', 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleRefresh = () => {
        hasFetchedRef.current = false;
        fetchConsolidados();
    };

    const handleExportarExcel = async (tipo: 'callao' | 'malvinas' | 'general') => {
        if (!inventoryId) return;

        try {
            // Obtener datos según el tipo
            let dataToExport: any[] = [];
            let sheetName = '';
            
            if (tipo === 'general') {
                dataToExport = generalData;
                sheetName = 'Conteo General';
            } else if (tipo === 'callao') {
                dataToExport = callaoData;
                sheetName = 'Callao';
            } else {
                dataToExport = malvinasData;
                sheetName = 'Malvinas';
            }

            if (!dataToExport || dataToExport.length === 0) {
                showAlert('Error', 'No hay datos para exportar', 'error');
                return;
            }

            // Preparar datos para Excel
            let excelData: any[] = [];
            
            if (tipo === 'general') {
                excelData = dataToExport.map(item => ({
                    'ITEM': item.producto_item || '',
                    'PRODUCTO': item.producto || '',
                    'CODIGO': item.codigo || '',
                    'TOTAL SISTEMA': item.total_sistema || 0,
                    'TOTAL FISICO': item.total_fisico || 0,
                    'DIFERENCIA': item.diferencia || 0,
                    'RESULTADO': item.resultado || '',
                    'UNIDAD': item.unidad_medida || '',
                    'CALLAO SISTEMA': (item as any).callao_sistema || 0,
                    'CALLAO FISICO': (item as any).callao_fisico || 0,
                    'MALVINAS SISTEMA': (item as any).malvinas_sistema || 0,
                    'MALVINAS FISICO': (item as any).malvinas_fisico || 0
                }));
            } else {
                excelData = dataToExport.map(item => ({
                    'ITEM': item.producto_item || '',
                    'PRODUCTO': item.producto || '',
                    'CODIGO': item.codigo || '',
                    'SISTEMA': item.sistema || 0,
                    'FISICO': item.fisico || 0,
                    'DIFERENCIA': item.diferencia || 0,
                    'UNIDAD': item.unidad_medida || ''
                }));
            }

            // Crear workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);
            
            // Ajustar ancho de columnas
            const colWidths = Object.keys(excelData[0] || {}).map(key => ({
                wch: Math.max(key.length, 15)
            }));
            ws['!cols'] = colWidths;
            
            // Agregar hoja al workbook
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            
            // Generar archivo Excel
            const numeroInventario = state.sesionActual.numero || 'INV';
            const filename = `consolidado_${tipo}_${numeroInventario}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, filename);
            
            showAlert('Éxito', `Archivo ${tipo} exportado con éxito`, 'success');
        } catch (error) {
            console.error('Error exporting excel:', error);
            showAlert('Error', 'Error al exportar los datos', 'error');
        }
    };

    const getResultadoStyle = (resultado?: string) => {
        switch (resultado) {
            case 'CONFORME':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'SOBRANTE':
                return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'FALTANTE':
                return 'bg-red-100 text-red-700 border-red-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getResultadoIcon = (resultado?: string) => {
        switch (resultado) {
            case 'CONFORME':
                return <CheckCircle2 className="w-3.5 h-3.5 mr-1" />;
            case 'SOBRANTE':
                return <Info className="w-3.5 h-3.5 mr-1" />;
            case 'FALTANTE':
                return <AlertTriangle className="w-3.5 h-3.5 mr-1" />;
            default:
                return null;
        }
    };

    return (
        <div id="view-consolidado" className="animate-in fade-in duration-500 font-poppins pb-10">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 transition-all">
                    <header className="flex justify-between items-center flex-wrap gap-4 mb-8">
                        <div className="flex items-center space-x-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-[#002D5A] to-[#004a8d] rounded-2xl flex items-center justify-center text-white shadow-md transition-all duration-200">
                                <BarChart3 className="w-7 h-7" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0 leading-tight" style={{ fontSize: '24px' }}>
                                    Consolidado de Inventarios
                                </h1>
                                <p className="text-sm text-gray-500 mt-1">
                                    Resumen técnico y consolidado final por almacén y general
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleExportarExcel('general')}
                                className="flex items-center gap-2 px-4 py-2 bg-[#217346] text-white rounded-full text-xs font-bold hover:bg-[#1a5a37] transition-colors shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                Excel
                            </button>
                            <button
                                onClick={handleRefresh}
                                disabled={loading}
                                className="flex items-center justify-center px-4 py-2 bg-[#002D5A] text-white rounded-full hover:bg-[#001F3D] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Actualizar Vista"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </header>

                    {/* Error banner */}
                    {fetchError && !loading && (
                        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-red-700">Error al cargar consolidados</p>
                                <p className="text-xs text-red-600 mt-0.5">{fetchError}</p>
                            </div>
                            <button
                                onClick={handleRefresh}
                                className="text-xs text-red-600 hover:text-red-800 font-semibold underline"
                            >
                                Reintentar
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                        {/* Almacén Callao */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="bg-[#002D5A] text-white p-4 flex justify-center items-center rounded-t-2xl">
                                <span className="font-bold tracking-wide uppercase text-xs">Inventario Callao</span>
                            </div>
                            <div className="flex-grow">
                                <table className="w-full text-sm border-collapse table-auto">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-2 py-3 text-center font-bold text-gray-600 text-[10px] uppercase w-16">Item</th>
                                            <th className="px-2 py-3 text-left font-bold text-gray-600 text-[10px] uppercase">Producto</th>
                                            <th className="px-2 py-3 text-center font-bold text-gray-600 text-[10px] uppercase w-20">Sistema</th>
                                            <th className="px-2 py-3 text-center font-bold text-gray-600 text-[10px] uppercase w-20">Físico</th>
                                            <th className="px-2 py-3 text-center font-bold text-gray-600 text-[10px] uppercase w-24">Dif.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={5} className="px-3 py-10 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#002D5A]"></div>
                                                        <span className="text-xs text-gray-500">Cargando datos...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : callaoData.length > 0 ? (
                                            callaoData.map((item, idx) => (
                                                <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-2 py-3 text-center text-gray-500 font-medium text-[11px]">{item.producto_item}</td>
                                                    <td className="px-2 py-3 text-left text-gray-700 font-semibold line-clamp-1 text-[11px]" title={item.producto}>{item.producto}</td>
                                                    <td className="px-2 py-3 text-center text-gray-600 font-medium text-[11px]">{item.sistema}</td>
                                                    <td className="px-2 py-3 text-center text-[#002D5A] font-bold text-[11px]">{item.fisico}</td>
                                                    <td className={`px-2 py-3 text-center font-bold text-[11px] ${item.diferencia < 0 ? 'text-red-500' : item.diferencia > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                                                        {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={5} className="px-3 py-16 text-center">
                                                <PackageSearch className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                                <p className="text-gray-400 font-medium text-sm">Sin datos de Callao</p>
                                                <p className="text-gray-300 text-xs mt-1">Genera los consolidados primero</p>
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Almacén Malvinas */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="bg-[#F4B400] text-[#001F3D] p-4 flex justify-center items-center rounded-t-2xl">
                                <span className="font-bold tracking-wide uppercase text-xs">Inventario Malvinas</span>
                            </div>
                            <div className="flex-grow">
                                <table className="w-full text-sm border-collapse table-auto">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-2 py-3 text-left font-bold text-gray-600 text-[10px] uppercase">Producto</th>
                                            <th className="px-2 py-3 text-center font-bold text-gray-600 text-[10px] uppercase w-20">Sistema</th>
                                            <th className="px-2 py-3 text-center font-bold text-gray-600 text-[10px] uppercase w-20">Físico</th>
                                            <th className="px-2 py-3 text-center font-bold text-gray-600 text-[10px] uppercase w-24">Dif.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-10 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#F4B400]"></div>
                                                        <span className="text-xs text-gray-500">Cargando datos...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : malvinasData.length > 0 ? (
                                            malvinasData.map((item, idx) => (
                                                <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-2 py-3 text-left text-gray-700 font-semibold line-clamp-1 text-[11px]" title={item.producto}>{item.producto}</td>
                                                    <td className="px-2 py-3 text-center text-gray-600 font-medium text-[11px]">{item.sistema}</td>
                                                    <td className="px-2 py-3 text-center text-[#002D5A] font-bold text-[11px]">{item.fisico}</td>
                                                    <td className={`px-2 py-3 text-center font-bold text-[11px] ${item.diferencia < 0 ? 'text-red-500' : item.diferencia > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                                                        {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={4} className="px-3 py-16 text-center">
                                                <PackageSearch className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                                <p className="text-gray-400 font-medium text-sm">Sin datos de Malvinas</p>
                                                <p className="text-gray-300 text-xs mt-1">Genera los consolidados primero</p>
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Conteo General */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="bg-[#198754] text-white p-4 flex justify-center items-center rounded-t-2xl">
                                <span className="font-bold tracking-wide uppercase text-xs">Conteo General</span>
                            </div>
                            <div className="flex-grow">
                                <table className="w-full text-sm border-collapse table-auto">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-2 py-3 text-center font-bold text-gray-600 text-[10px] uppercase w-24">Total Sistema</th>
                                            <th className="px-2 py-3 text-center font-bold text-gray-600 text-[10px] uppercase w-24">Total Físico</th>
                                            <th className="px-2 py-3 text-center font-bold text-gray-600 text-[10px] uppercase w-24">Diferencia</th>
                                            <th className="px-2 py-3 text-center font-bold text-gray-600 text-[10px] uppercase w-28">Resultado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-10 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#198754]"></div>
                                                        <span className="text-xs text-gray-500">Cargando datos...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : generalData.length > 0 ? (
                                            generalData.map((item, idx) => (
                                                <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-2 py-3 text-center text-gray-600 font-medium text-[11px]">{item.total_sistema || 0}</td>
                                                    <td className="px-2 py-3 text-center text-[#002D5A] font-extrabold text-[11px]">{item.total_fisico || 0}</td>
                                                    <td className={`px-2 py-3 text-center font-bold text-[11px] ${item.diferencia < 0 ? 'text-red-500' : item.diferencia > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                                                        {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                                                    </td>
                                                    <td className="px-2 py-3 text-center">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${getResultadoStyle(item.resultado)} shadow-sm`}>
                                                            {getResultadoIcon(item.resultado)}
                                                            {item.resultado || 'N/A'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={4} className="px-3 py-16 text-center">
                                                <PackageSearch className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                                <p className="text-gray-400 font-medium text-sm">Sin datos generales</p>
                                                <p className="text-gray-300 text-xs mt-1">Genera los consolidados primero</p>
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
