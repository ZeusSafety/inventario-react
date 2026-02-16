'use client';

import React, { useState, useMemo } from 'react';
import { useInventory } from '@/context/InventoryContext';
import { apiCall } from '@/lib/api';
import { Archive, Calendar, FileDown, ChevronLeft, ChevronRight } from 'lucide-react';

// Función para generar un color único y consistente basado en el nombre del usuario
const generarColorUsuario = (nombre: string): string => {
    if (!nombre || nombre.trim() === '') {
        return '#F5F5F5'; // Gris claro para usuarios sin nombre
    }

    // Paleta de colores suaves y diferenciables (expandida)
    const colores = [
        '#E3F2FD', // Azul claro
        '#F3E5F5', // Morado claro
        '#E8F5E9', // Verde claro
        '#FFF3E0', // Naranja claro
        '#FCE4EC', // Rosa claro
        '#E0F2F1', // Turquesa claro
        '#FFF9C4', // Amarillo claro
        '#F1F8E9', // Lima claro
        '#EDE7F6', // Lila claro
        '#E8EAF6', // Índigo claro
        '#FFEBEE', // Rojo claro
        '#E0F7FA', // Cyan claro
        '#F9FBE7', // Verde lima muy claro
        '#FFF8E1', // Ámbar claro
        '#E1F5FE', // Azul claro
        '#F3E5F5', // Púrpura claro
        '#E8EAF6', // Índigo claro
        '#E0F2F1', // Teal claro
        '#FFF3E0', // Naranja claro
        '#FCE4EC', // Rosa claro
    ];

    // Generar un hash más robusto del nombre (normalizado a mayúsculas para consistencia)
    const nombreNormalizado = nombre.trim().toUpperCase();
    let hash = 0;
    for (let i = 0; i < nombreNormalizado.length; i++) {
        const char = nombreNormalizado.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir a entero de 32 bits
    }
    
    // Usar el hash absoluto para seleccionar un color de la paleta
    const indice = Math.abs(hash) % colores.length;
    return colores[indice];
};

export default function RegistroPage() {
    const { state, showAlert } = useInventory();
    const [loadingCallao, setLoadingCallao] = useState(false);
    const [loadingMalvinas, setLoadingMalvinas] = useState(false);
    const [conteosCallao, setConteosCallao] = useState<any[]>([]);
    const [conteosMalvinas, setConteosMalvinas] = useState<any[]>([]);
    const [paginationCallao, setPaginationCallao] = useState<any>(null);
    const [paginationMalvinas, setPaginationMalvinas] = useState<any>(null);
    const [pageCallao, setPageCallao] = useState(1);
    const [pageMalvinas, setPageMalvinas] = useState(1);
    const [almacenActivo, setAlmacenActivo] = useState<'callao' | 'malvinas' | 'todos'>('todos');
    const [nuevosConteosIds, setNuevosConteosIds] = useState<Set<number>>(new Set());
    const [conteosAnterioresIds, setConteosAnterioresIds] = useState<Set<number>>(new Set());

    const cargarHistorialCallao = React.useCallback(async (page: number = 1) => {
        setLoadingCallao(true);
        try {
            const response = await apiCall(`obtener_historial_conteos_callao&page=${page}&per_page=10`, 'GET');
            if (response.success) {
                // Combinar conteos por cajas y por stand
                const todosConteos = [
                    ...(response.conteos_por_cajas || []).map((c: any) => ({ ...c, tipo_conteo: 'por_cajas' })),
                    ...(response.conteos_por_stand || []).map((c: any) => ({ ...c, tipo_conteo: 'por_stand' }))
                ];
                
                // Si es la primera carga (set vacío), solo inicializar sin marcar como nuevos
                const esPrimeraCarga = conteosAnterioresIds.size === 0;
                let nuevosIds = new Set<number>();
                
                if (esPrimeraCarga) {
                    // Primera carga: solo inicializar el set sin animaciones
                    const todosIds = new Set<number>();
                    todosConteos.forEach((c: any) => todosIds.add(c.id));
                    setConteosAnterioresIds(todosIds);
                } else {
                    // Cargas posteriores: detectar conteos nuevos
                    nuevosIds = new Set<number>();
                    const nuevosConteos: any[] = [];
                    
                    todosConteos.forEach((c: any) => {
                        if (!conteosAnterioresIds.has(c.id)) {
                            nuevosIds.add(c.id);
                            nuevosConteos.push(c);
                        }
                    });
                    
                    if (nuevosIds.size > 0) {
                        setNuevosConteosIds(prev => {
                            const nuevoSet = new Set(prev);
                            nuevosIds.forEach(id => nuevoSet.add(id));
                            return nuevoSet;
                        });
                        
                        // Mostrar notificación profesional
                        if (nuevosConteos.length === 1) {
                            const conteo = nuevosConteos[0];
                            const tipoTexto = conteo.tipo_conteo === 'por_cajas' ? 'Cajas' : 'Stand';
                            showAlert(
                                'Nuevo Conteo Registrado',
                                `Se registró un conteo de tipo "${tipoTexto}" para el inventario "${conteo.numero_inventario || conteo.inventario_numero}" por ${conteo.registrado_por} en Callao`,
                                'success'
                            );
                        } else {
                            showAlert(
                                'Nuevos Conteos Registrados',
                                `Se registraron ${nuevosConteos.length} nuevos conteos en Callao`,
                                'success'
                            );
                        }
                        
                        // Remover la animación después de 3 segundos
                        nuevosIds.forEach(id => {
                            setTimeout(() => {
                                setNuevosConteosIds(prev => {
                                    const nuevoSet = new Set(prev);
                                    nuevoSet.delete(id);
                                    return nuevoSet;
                                });
                            }, 3000);
                        });
                    }
                    
                    // Actualizar el set global de IDs vistos (acumulativo)
                    setConteosAnterioresIds(prev => {
                        const nuevoSet = new Set(prev);
                        todosConteos.forEach((c: any) => nuevoSet.add(c.id));
                        return nuevoSet;
                    });
                }
                
                // Ordenar: primero los nuevos, luego por número de inventario
                const idsNuevosParaOrdenar = nuevosIds;
                const conteosOrdenados = [...todosConteos].sort((a, b) => {
                    const aEsNuevo = idsNuevosParaOrdenar.has(a.id);
                    const bEsNuevo = idsNuevosParaOrdenar.has(b.id);
                    
                    // Si uno es nuevo y el otro no, el nuevo va primero
                    if (aEsNuevo && !bEsNuevo) return -1;
                    if (!aEsNuevo && bEsNuevo) return 1;
                    
                    // Si ambos son nuevos o ambos no son nuevos, ordenar por número de inventario
                    const numA = ((a.numero_inventario || a.inventario_numero) || '').toUpperCase();
                    const numB = ((b.numero_inventario || b.inventario_numero) || '').toUpperCase();
                    return numA.localeCompare(numB);
                });
                
                setConteosCallao(conteosOrdenados);
                setPaginationCallao(response.pagination);
            }
        } catch (e) {
            console.error('Error al cargar historial Callao:', e);
        } finally {
            setLoadingCallao(false);
        }
    }, [conteosAnterioresIds]);

    const cargarHistorialMalvinas = React.useCallback(async (page: number = 1) => {
        setLoadingMalvinas(true);
        try {
            const response = await apiCall(`obtener_historial_conteos_malvinas&page=${page}&per_page=10`, 'GET');
            if (response.success) {
                // Combinar conteos por cajas y por stand
                const todosConteos = [
                    ...(response.conteos_por_cajas || []).map((c: any) => ({ ...c, tipo_conteo: 'por_cajas' })),
                    ...(response.conteos_por_stand || []).map((c: any) => ({ ...c, tipo_conteo: 'por_stand' }))
                ];
                
                // Si es la primera carga (set vacío), solo inicializar sin marcar como nuevos
                const esPrimeraCarga = conteosAnterioresIds.size === 0;
                let nuevosIds = new Set<number>();
                
                if (esPrimeraCarga) {
                    // Primera carga: solo inicializar el set sin animaciones
                    const todosIds = new Set<number>();
                    todosConteos.forEach((c: any) => todosIds.add(c.id));
                    setConteosAnterioresIds(todosIds);
                } else {
                    // Cargas posteriores: detectar conteos nuevos
                    nuevosIds = new Set<number>();
                    const nuevosConteos: any[] = [];
                    
                    todosConteos.forEach((c: any) => {
                        if (!conteosAnterioresIds.has(c.id)) {
                            nuevosIds.add(c.id);
                            nuevosConteos.push(c);
                        }
                    });
                    
                    if (nuevosIds.size > 0) {
                        setNuevosConteosIds(prev => {
                            const nuevoSet = new Set(prev);
                            nuevosIds.forEach(id => nuevoSet.add(id));
                            return nuevoSet;
                        });
                        
                        // Mostrar notificación profesional
                        if (nuevosConteos.length === 1) {
                            const conteo = nuevosConteos[0];
                            const tipoTexto = conteo.tipo_conteo === 'por_cajas' ? 'Cajas' : 'Stand';
                            showAlert(
                                'Nuevo Conteo Registrado',
                                `Se registró un conteo de tipo "${tipoTexto}" para el inventario "${conteo.numero_inventario || conteo.inventario_numero}" por ${conteo.registrado_por} en ${conteo.nombre_tienda || 'Malvinas'}`,
                                'success'
                            );
                        } else {
                            showAlert(
                                'Nuevos Conteos Registrados',
                                `Se registraron ${nuevosConteos.length} nuevos conteos en Malvinas`,
                                'success'
                            );
                        }
                        
                        // Remover la animación después de 3 segundos
                        nuevosIds.forEach(id => {
                            setTimeout(() => {
                                setNuevosConteosIds(prev => {
                                    const nuevoSet = new Set(prev);
                                    nuevoSet.delete(id);
                                    return nuevoSet;
                                });
                            }, 3000);
                        });
                    }
                    
                    // Actualizar el set global de IDs vistos (acumulativo)
                    setConteosAnterioresIds(prev => {
                        const nuevoSet = new Set(prev);
                        todosConteos.forEach((c: any) => nuevoSet.add(c.id));
                        return nuevoSet;
                    });
                }
                
                // Ordenar: primero los nuevos, luego por número de inventario
                const idsNuevosParaOrdenar = nuevosIds;
                const conteosOrdenados = [...todosConteos].sort((a, b) => {
                    const aEsNuevo = idsNuevosParaOrdenar.has(a.id);
                    const bEsNuevo = idsNuevosParaOrdenar.has(b.id);
                    
                    // Si uno es nuevo y el otro no, el nuevo va primero
                    if (aEsNuevo && !bEsNuevo) return -1;
                    if (!aEsNuevo && bEsNuevo) return 1;
                    
                    // Si ambos son nuevos o ambos no son nuevos, ordenar por número de inventario
                    const numA = ((a.numero_inventario || a.inventario_numero) || '').toUpperCase();
                    const numB = ((b.numero_inventario || b.inventario_numero) || '').toUpperCase();
                    return numA.localeCompare(numB);
                });
                
                setConteosMalvinas(conteosOrdenados);
                setPaginationMalvinas(response.pagination);
            }
        } catch (e) {
            console.error('Error al cargar historial Malvinas:', e);
        } finally {
            setLoadingMalvinas(false);
        }
    }, [conteosAnterioresIds]);

    React.useEffect(() => {
        // Cargar según el almacén seleccionado
        if (almacenActivo === 'callao') {
            cargarHistorialCallao(pageCallao);
        } else if (almacenActivo === 'malvinas') {
            cargarHistorialMalvinas(pageMalvinas);
        } else if (almacenActivo === 'todos') {
            // Cuando se muestran todos, cargar la primera página de cada almacén
            cargarHistorialCallao(1);
            cargarHistorialMalvinas(1);
        }
    }, [almacenActivo, pageCallao, pageMalvinas, cargarHistorialCallao, cargarHistorialMalvinas]);

    // Combinar todos los conteos para mostrar
    const todasLasSesiones = useMemo(() => {
        const callaoConAlmacen = conteosCallao.map(s => ({ ...s, almacen: 'Callao' }));
        const malvinasConAlmacen = conteosMalvinas.map(s => ({ ...s, almacen: 'Malvinas' }));
        const todos = [...callaoConAlmacen, ...malvinasConAlmacen];
        
        // Ordenar: primero los nuevos, luego por número de inventario
        return todos.sort((a, b) => {
            const aEsNuevo = nuevosConteosIds.has(a.id);
            const bEsNuevo = nuevosConteosIds.has(b.id);
            
            // Si uno es nuevo y el otro no, el nuevo va primero
            if (aEsNuevo && !bEsNuevo) return -1;
            if (!aEsNuevo && bEsNuevo) return 1;
            
            // Si ambos son nuevos o ambos no son nuevos, ordenar por número de inventario
            const numA = ((a.numero_inventario || a.inventario_numero) || '').toUpperCase();
            const numB = ((b.numero_inventario || b.inventario_numero) || '').toUpperCase();
            return numA.localeCompare(numB);
        });
    }, [conteosCallao, conteosMalvinas, nuevosConteosIds]);

    // Obtener paginación activa según el almacén seleccionado
    const paginacionActiva = almacenActivo === 'callao' ? paginationCallao : almacenActivo === 'malvinas' ? paginationMalvinas : null;
    const paginaActiva = almacenActivo === 'callao' ? pageCallao : almacenActivo === 'malvinas' ? pageMalvinas : 1;

    const handlePageChange = (nuevaPagina: number, almacen: 'callao' | 'malvinas') => {
        if (almacen === 'callao') {
            setPageCallao(nuevaPagina);
        } else {
            setPageMalvinas(nuevaPagina);
        }
    };

    // Resetear páginas cuando se cambia de almacén
    React.useEffect(() => {
        if (almacenActivo === 'callao') {
            setPageCallao(1);
        } else if (almacenActivo === 'malvinas') {
            setPageMalvinas(1);
        } else if (almacenActivo === 'todos') {
            setPageCallao(1);
            setPageMalvinas(1);
        }
    }, [almacenActivo]);

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

    const obtenerTipoConteoTexto = (tipo: string) => {
        if (tipo === 'por_cajas') return 'Por Cajas';
        if (tipo === 'por_stand') return 'Por Stand';
        return tipo || '-';
    };

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
                                    Consulta el historial detallado de inventarios finalizados de todos los usuarios
                                </p>
                            </div>
                        </div>

                        <div className="header-actions flex flex-wrap gap-3 items-center">
                            {/* Filtro por almacén */}
                            <div className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                                <button
                                    onClick={() => setAlmacenActivo('todos')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        almacenActivo === 'todos'
                                            ? 'bg-[#002D5A] text-white shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setAlmacenActivo('callao')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        almacenActivo === 'callao'
                                            ? 'bg-[#002D5A] text-white shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    Callao
                                </button>
                                <button
                                    onClick={() => setAlmacenActivo('malvinas')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        almacenActivo === 'malvinas'
                                            ? 'bg-[#002D5A] text-white shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    Malvinas
                                </button>
                            </div>

                            <button className="flex items-center gap-2 px-6 py-2 bg-white border-2 border-[#1f2937] text-[#1f2937] rounded-full btn-oval font-bold hover:bg-gray-50 transition-all text-xs shadow-sm">
                                <FileDown className="w-4 h-4" />
                                <span>Exportar PDF</span>
                            </button>
                        </div>
                    </header>

                    {/* Tabla */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                        <div className="overflow-hidden">
                            <table className="w-full table-auto">
                                <thead>
                                    <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">#</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ALMACÉN</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">N° INVENTARIO</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">TIPO</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">TIENDA</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">REGISTRADO POR</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">INICIO</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">FIN</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">PRODUCTOS</th>
                                        <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ACCIÓN</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(loadingCallao || loadingMalvinas) && todasLasSesiones.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="px-3 py-16 text-center text-sm text-gray-500">
                                                Cargando historial...
                                            </td>
                                        </tr>
                                    ) : todasLasSesiones.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="px-3 py-16 text-center text-sm text-gray-400 font-medium italic">
                                                No hay conteos registrados
                                            </td>
                                        </tr>
                                    ) : (
                                        todasLasSesiones.map((s, idx) => {
                                            // Obtener el nombre del usuario (puede venir en diferentes campos)
                                            const nombreUsuario = s.registrado_por || s.registradoPor || 'Desconocido';
                                            const colorUsuario = generarColorUsuario(nombreUsuario);
                                            const esNuevo = nuevosConteosIds.has(s.id);
                                            
                                            // Calcular el número de fila considerando la paginación
                                            let numeroFila = idx + 1;
                                            if (almacenActivo === 'callao' && paginationCallao) {
                                                // Cuando se muestra solo Callao, calcular según su paginación
                                                numeroFila = (pageCallao - 1) * 10 + idx + 1;
                                            } else if (almacenActivo === 'malvinas' && paginationMalvinas) {
                                                // Cuando se muestra solo Malvinas, calcular según su paginación
                                                numeroFila = (pageMalvinas - 1) * 10 + idx + 1;
                                            }
                                            // Cuando se muestran "todos", el índice es secuencial desde 1
                                            
                                            return (
                                                <tr 
                                                    key={`${s.almacen}-${s.id}-${idx}`} 
                                                    className={`hover:opacity-80 border-l-4 ${
                                                        esNuevo ? 'animate-pulse-new' : ''
                                                    }`}
                                                    style={{ 
                                                        backgroundColor: esNuevo ? `rgba(11, 59, 140, 0.08)` : colorUsuario,
                                                        borderLeftColor: esNuevo ? '#0B3B8C' : colorUsuario.replace('F', 'D').replace('E', 'C') // Borde más oscuro o azul si es nuevo
                                                    }}
                                                >
                                                    <td className="px-3 py-4 text-xs font-medium text-gray-900">{numeroFila}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600 uppercase font-bold text-[#0B3B8C]">{s.almacen}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-900 font-bold">{s.inventario_numero || s.numero_inventario || '-'}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600 uppercase">{obtenerTipoConteoTexto(s.tipo_conteo)}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600 uppercase">{s.nombre_tienda || '-'}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-700 font-semibold">{nombreUsuario}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600">{formatearFecha(s.fecha_hora_inicio)}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600">{formatearFecha(s.fecha_hora_final)}</td>
                                                    <td className="px-3 py-4 text-xs text-gray-600">{s.total_productos || 0}</td>
                                                    <td className="px-3 py-4 text-center">
                                                        {s.archivo_pdf ? (
                                                            <a 
                                                                href={s.archivo_pdf} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-[#0B3B8C] hover:text-[#002D5A] font-bold text-[10px] uppercase"
                                                            >
                                                                Ver PDF
                                                            </a>
                                                        ) : (
                                                            <span className="text-gray-400 text-[10px]">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación para almacén específico */}
                        {almacenActivo !== 'todos' && paginacionActiva && (
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                                <button
                                    onClick={() => {
                                        if (almacenActivo === 'callao') {
                                            handlePageChange(1, 'callao');
                                        } else if (almacenActivo === 'malvinas') {
                                            handlePageChange(1, 'malvinas');
                                        }
                                    }}
                                    disabled={paginaActiva === 1}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    «
                                </button>
                                <button
                                    onClick={() => {
                                        if (almacenActivo === 'callao') {
                                            handlePageChange(pageCallao - 1, 'callao');
                                        } else if (almacenActivo === 'malvinas') {
                                            handlePageChange(pageMalvinas - 1, 'malvinas');
                                        }
                                    }}
                                    disabled={!paginacionActiva.has_prev}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    &lt;
                                </button>
                                <span className="text-xs text-gray-700 font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    Página {paginaActiva} de {paginacionActiva.total_pages}
                                </span>
                                <button
                                    onClick={() => {
                                        if (almacenActivo === 'callao') {
                                            handlePageChange(pageCallao + 1, 'callao');
                                        } else if (almacenActivo === 'malvinas') {
                                            handlePageChange(pageMalvinas + 1, 'malvinas');
                                        }
                                    }}
                                    disabled={!paginacionActiva.has_next}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    &gt;
                                </button>
                                <button
                                    onClick={() => {
                                        if (almacenActivo === 'callao') {
                                            handlePageChange(paginacionActiva.total_pages, 'callao');
                                        } else if (almacenActivo === 'malvinas') {
                                            handlePageChange(paginacionActiva.total_pages, 'malvinas');
                                        }
                                    }}
                                    disabled={paginaActiva === paginacionActiva.total_pages}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    »
                                </button>
                            </div>
                        )}

                        {/* Paginación cuando se muestran todos los almacenes */}
                        {almacenActivo === 'todos' && (
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 px-4 py-3">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-4 text-xs text-gray-600">
                                        <div>
                                            <span className="font-medium">Callao:</span> {paginationCallao?.total || 0} conteos
                                            {paginationCallao && (
                                                <span className="text-gray-400 ml-1">
                                                    (Página {pageCallao} de {paginationCallao.total_pages})
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="font-medium">Malvinas:</span> {paginationMalvinas?.total || 0} conteos
                                            {paginationMalvinas && (
                                                <span className="text-gray-400 ml-1">
                                                    (Página {pageMalvinas} de {paginationMalvinas.total_pages})
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="font-medium">Total:</span> {(paginationCallao?.total || 0) + (paginationMalvinas?.total || 0)} conteos
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Mostrando {todasLasSesiones.length} conteos en esta vista
                                    </div>
                                </div>
                                
                                {/* Controles de paginación para Callao */}
                                {paginationCallao && (
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                                        <span className="text-xs font-medium text-gray-700" style={{ fontFamily: 'var(--font-poppins)' }}>Callao:</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handlePageChange(1, 'callao')}
                                                disabled={pageCallao === 1}
                                                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                                style={{ fontFamily: 'var(--font-poppins)' }}
                                            >
                                                «
                                            </button>
                                            <button
                                                onClick={() => handlePageChange(pageCallao - 1, 'callao')}
                                                disabled={!paginationCallao.has_prev}
                                                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                                style={{ fontFamily: 'var(--font-poppins)' }}
                                            >
                                                &lt;
                                            </button>
                                            <span className="text-xs text-gray-700 font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                                                Página {pageCallao} de {paginationCallao.total_pages}
                                            </span>
                                            <button
                                                onClick={() => handlePageChange(pageCallao + 1, 'callao')}
                                                disabled={!paginationCallao.has_next}
                                                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                                style={{ fontFamily: 'var(--font-poppins)' }}
                                            >
                                                &gt;
                                            </button>
                                            <button
                                                onClick={() => handlePageChange(paginationCallao.total_pages, 'callao')}
                                                disabled={pageCallao === paginationCallao.total_pages}
                                                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                                style={{ fontFamily: 'var(--font-poppins)' }}
                                            >
                                                »
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Controles de paginación para Malvinas */}
                                {paginationMalvinas && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-gray-700" style={{ fontFamily: 'var(--font-poppins)' }}>Malvinas:</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handlePageChange(1, 'malvinas')}
                                                disabled={pageMalvinas === 1}
                                                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                                style={{ fontFamily: 'var(--font-poppins)' }}
                                            >
                                                «
                                            </button>
                                            <button
                                                onClick={() => handlePageChange(pageMalvinas - 1, 'malvinas')}
                                                disabled={!paginationMalvinas.has_prev}
                                                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                                style={{ fontFamily: 'var(--font-poppins)' }}
                                            >
                                                &lt;
                                            </button>
                                            <span className="text-xs text-gray-700 font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                                                Página {pageMalvinas} de {paginationMalvinas.total_pages}
                                            </span>
                                            <button
                                                onClick={() => handlePageChange(pageMalvinas + 1, 'malvinas')}
                                                disabled={!paginationMalvinas.has_next}
                                                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                                style={{ fontFamily: 'var(--font-poppins)' }}
                                            >
                                                &gt;
                                            </button>
                                            <button
                                                onClick={() => handlePageChange(paginationMalvinas.total_pages, 'malvinas')}
                                                disabled={pageMalvinas === paginationMalvinas.total_pages}
                                                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                                style={{ fontFamily: 'var(--font-poppins)' }}
                                            >
                                                »
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
