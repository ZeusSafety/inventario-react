'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useInventory, fmt12 } from '@/context/InventoryContext';
import { apiCall } from '@/lib/api';
import { Store, Box, Columns, PlayCircle, FileText, Search, ShieldCheck, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import IniciarConteoModal from '@/components/modals/IniciarConteoModal';
import Modal from '@/components/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TIENDAS = ['TIENDA 3006', 'TIENDA 3006 B', 'TIENDA 3131', 'TIENDA 3133', 'TIENDA 412-A'];

// Función helper para formatear fechas a hora de Perú
const formatearFechaPeru = (fechaStr: string) => {
    if (!fechaStr) return '-';
    try {
        // La fecha viene del backend ya en formato YYYY-MM-DD HH:MM:SS
        // MySQL con time_zone = '-05:00' ya devuelve en hora de Perú
        // Solo formatear a DD/MM/YYYY HH:MM:SS
        const [datePart, timePart] = fechaStr.split(' ');
        if (!datePart || !timePart) return fechaStr;

        const [year, month, day] = datePart.split('-');
        const [hour, minute, second] = timePart.split(':');

        // Formatear directamente (ya viene en hora de Perú del backend)
        return `${day}/${month}/${year} ${hour}:${minute}:${second || '00'}`;
    } catch {
        return fechaStr;
    }
};

export default function MalvinasPage() {
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
    const [activeSessionCounts, setActiveSessionCounts] = useState<any>(null); // Datos de conteos por tienda y tipo

    // Modal de previsualización de Excel
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [excelPreviewData, setExcelPreviewData] = useState<Array<{ codigo: string, cantidad: any, producto?: string }>>([]);
    const [pendingExcelFile, setPendingExcelFile] = useState<File | null>(null);

    // Función para guardar currentConteo en localStorage (incluyendo filas con cantidades)
    const guardarCurrentConteo = useCallback((conteo: any) => {
        if (conteo && typeof window !== 'undefined') {
            // Guardar información básica + filas con sus cantidades para restauración completa
            const datosAGuardar = {
                conteo_id: conteo.conteo_id,
                tipo: conteo.tipo,
                numero: conteo.numero,
                registrado: conteo.registrado,
                tienda: conteo.tienda,
                inicio: conteo.inicio,
                // Guardar solo las filas con sus cantidades (para restauración rápida)
                filas: conteo.filas ? conteo.filas.map((f: any) => ({
                    codigo: f.codigo,
                    cantidad_conteo: f.cantidad_conteo || '',
                    unidad_medida: f.unidad_medida || 'UNIDAD',
                    detalle_id: f.detalle_id || f.id
                })) : []
            };
            localStorage.setItem('malvinas_current_conteo', JSON.stringify(datosAGuardar));
        }
    }, []);

    // Función para limpiar currentConteo de localStorage
    const limpiarCurrentConteo = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('malvinas_current_conteo');
        }
    }, []);

    // Restaurar currentConteo al cargar la página (solo si no hay uno activo)
    useEffect(() => {
        // Solo restaurar si no hay un currentConteo ya cargado
        if (currentConteo) return;

        const restaurarConteo = async () => {
            if (!state.sesionActual.inventario_id || !state.sesionActual.activo) {
                limpiarCurrentConteo();
                return;
            }

            // Verificar si hay un conteo guardado en localStorage
            const savedConteo = typeof window !== 'undefined'
                ? localStorage.getItem('malvinas_current_conteo')
                : null;

            if (!savedConteo) return;

            try {
                const conteoInfo = JSON.parse(savedConteo);

                // Verificar que el conteo guardado corresponde al inventario actual
                if (conteoInfo.numero !== state.sesionActual.numero) {
                    limpiarCurrentConteo();
                    return;
                }

                // Verificar en el servidor si el conteo sigue en proceso
                const response = await apiCall(`listar_conteos_malvinas&inventario_id=${state.sesionActual.inventario_id}`, 'GET');
                if (response.success && response.tiendas) {
                    const tipoConteoBusqueda = conteoInfo.tipo === 'cajas' ? 'por_cajas' : 'por_stand';
                    const tiendaData = response.tiendas[conteoInfo.tienda];

                    if (!tiendaData) {
                        limpiarCurrentConteo();
                        return;
                    }

                    const list = conteoInfo.tipo === 'cajas' ? tiendaData.conteos_por_cajas : tiendaData.conteos_por_stand;
                    const conteoEnServidor = (list || []).find((c: any) =>
                        c.id === conteoInfo.conteo_id &&
                        c.estado === 'en_proceso'
                    );

                    if (conteoEnServidor) {
                        // Cargar los detalles del conteo desde el servidor
                        const detailRes = await apiCall(`obtener_detalle_conteo&conteo_id=${conteoInfo.conteo_id}`, 'GET');
                        if (detailRes.success && detailRes.productos) {
                            // Crear un mapa de las filas guardadas en localStorage (si existen)
                            const filasGuardadasMap = new Map();
                            if (conteoInfo.filas && Array.isArray(conteoInfo.filas)) {
                                conteoInfo.filas.forEach((f: any) => {
                                    if (f.codigo) {
                                        filasGuardadasMap.set(String(f.codigo).trim().toUpperCase(), f);
                                    }
                                });
                            }

                            const filas = detailRes.productos.map((p: any) => {
                                // El backend devuelve 'cantidad' que es la cantidad física guardada
                                const cantidadGuardada = p.cantidad;

                                // Buscar si hay datos guardados localmente para este producto
                                const codigoNormalizado = String(p.codigo || '').trim().toUpperCase();
                                const filaGuardada = filasGuardadasMap.get(codigoNormalizado);

                                // Prioridad: 1) Datos guardados localmente (más recientes), 2) Datos del servidor, 3) Vacío
                                let cantidadParaMostrar = '';
                                if (filaGuardada && filaGuardada.cantidad_conteo && filaGuardada.cantidad_conteo !== '') {
                                    cantidadParaMostrar = String(filaGuardada.cantidad_conteo);
                                } else if (cantidadGuardada && Number(cantidadGuardada) > 0) {
                                    cantidadParaMostrar = String(cantidadGuardada);
                                }

                                return {
                                    ...p,
                                    cantidad_conteo: cantidadParaMostrar,
                                    unidad_medida: filaGuardada?.unidad_medida || p.unidad_medida || 'UNIDAD',
                                    // Asegurar que tenemos el item correcto
                                    item: p.item || p.item_producto
                                };
                            });

                            const conteoRestaurado = {
                                ...conteoInfo,
                                filas: filas
                            };
                            setCurrentConteo(conteoRestaurado);
                            guardarCurrentConteo(conteoRestaurado);
                            setShowTable(true);
                            const productosConCantidad = filas.filter((f: any) => f.cantidad_conteo !== '').length;
                            console.log('✅ Conteo Malvinas restaurado desde servidor:', conteoInfo.conteo_id, 'en', conteoInfo.tienda, 'con', productosConCantidad, 'productos con cantidad');
                        }
                    } else {
                        // El conteo ya no está en proceso, limpiar localStorage
                        limpiarCurrentConteo();
                    }
                }
            } catch (e) {
                console.error('Error restaurando conteo Malvinas:', e);
                limpiarCurrentConteo();
            }
        };

        // Esperar un momento para que el estado se sincronice
        const timer = setTimeout(() => {
            restaurarConteo();
        }, 1200);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.sesionActual.inventario_id, state.sesionActual.numero, state.sesionActual.activo]);

    const checkExistingCount = async (tipo: 'cajas' | 'stand', tienda: string) => {
        // 1. Verificar primero en el estado local (sincronizado por polling)
        if (state.conteosEnProceso) {
            const inProgress = state.conteosEnProceso.some((c: any) =>
                c.tipo_conteo === (tipo === 'cajas' ? 'por_cajas' : 'por_stand') &&
                c.tienda_nombre === tienda &&
                c.almacen_nombre === 'Malvinas' &&
                c.estado === 'en_proceso'
            );
            if (inProgress) return 'en_proceso';
        }

        // 2. Verificar sesiones finalizadas localmente
        if (state.sesiones.malvinas) {
            const existsLocally = state.sesiones.malvinas.some((s: any) =>
                s.numero === state.sesionActual.numero &&
                s.tipo === tipo &&
                s.tienda === tienda
            );
            if (existsLocally) return true;
        }

        // 3. Verificar en API (fuerza de seguridad)
        if (!state.sesionActual.inventario_id) return false;
        try {
            const response = await apiCall(`listar_conteos_malvinas&inventario_id=${state.sesionActual.inventario_id}`, 'GET');
            if (response.success && response.tiendas) {
                const tiendaData = response.tiendas[tienda];
                if (!tiendaData) return false;

                const list = tipo === 'cajas' ? tiendaData.conteos_por_cajas : tiendaData.conteos_por_stand;
                if (!list || list.length === 0) return false;

                const enProceso = list.some((c: any) => c.estado === 'en_proceso');
                if (enProceso) return 'en_proceso';

                const finalizado = list.some((c: any) => c.estado === 'finalizado');
                if (finalizado) return true;
            }
        } catch (e) {
            console.error(e);
        }
        return false;
    };

    const [pageMalvinas, setPageMalvinas] = useState(1);
    const [paginationMalvinas, setPaginationMalvinas] = useState<any>(null);
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const [nuevosConteosIds, setNuevosConteosIds] = useState<Set<number>>(new Set());
    const [conteosAnterioresIds, setConteosAnterioresIds] = useState<Set<number>>(new Set());

    const cargarSesionesAPI = React.useCallback(async (page: number = 1) => {
        setLoadingHistorial(true);
        try {
            // Usar el nuevo endpoint que trae todos los conteos finalizados con paginación
            const response = await apiCall(`obtener_historial_conteos_malvinas&page=${page}&per_page=10`, 'GET');
            if (response.success) {
                const allSessions: any[] = [];

                // Combinar conteos por cajas y por stand
                if (response.conteos_por_cajas) {
                    response.conteos_por_cajas.forEach((c: any) => {
                        allSessions.push({
                            id: c.id,
                            numero: c.inventario_numero || c.numero_inventario,
                            registrado: c.registrado_por,
                            inicio: c.fecha_hora_inicio,
                            fin: c.fecha_hora_final,
                            pdfUrl: c.archivo_pdf,
                            tienda: c.nombre_tienda || '-',
                            tipo: 'cajas',
                            filas: []
                        });
                    });
                }

                if (response.conteos_por_stand) {
                    response.conteos_por_stand.forEach((c: any) => {
                        allSessions.push({
                            id: c.id,
                            numero: c.inventario_numero || c.numero_inventario,
                            registrado: c.registrado_por,
                            inicio: c.fecha_hora_inicio,
                            fin: c.fecha_hora_final,
                            pdfUrl: c.archivo_pdf,
                            tienda: c.nombre_tienda || '-',
                            tipo: 'stand',
                            filas: []
                        });
                    });
                }

                setPaginationMalvinas(response.pagination);

                // Si es la primera carga (set vacío), solo inicializar sin marcar como nuevos
                const esPrimeraCarga = conteosAnterioresIds.size === 0;
                let nuevosIds = new Set<number>();

                if (esPrimeraCarga) {
                    // Primera carga: solo inicializar el set sin animaciones
                    const todosIds = new Set<number>();
                    allSessions.forEach((s: any) => todosIds.add(s.id));
                    setConteosAnterioresIds(todosIds);
                } else {
                    // Solo detectar y mostrar notificaciones de conteos nuevos cuando estás en la página 1
                    // Si cambias de página, no mostrar notificaciones (solo actualizar el set)
                    if (page === 1) {
                        // Cargas posteriores en página 1: detectar conteos nuevos
                        nuevosIds = new Set<number>();
                        const nuevosConteos: any[] = [];

                        allSessions.forEach((s: any) => {
                            if (!conteosAnterioresIds.has(s.id)) {
                                nuevosIds.add(s.id);
                                nuevosConteos.push(s);
                            }
                        });

                        // Si hay conteos nuevos, agregarlos al set de nuevos conteos y mostrar notificación
                        if (nuevosIds.size > 0) {
                            setNuevosConteosIds(prev => {
                                const nuevoSet = new Set(prev);
                                nuevosIds.forEach(id => nuevoSet.add(id));
                                return nuevoSet;
                            });

                            // Mostrar notificación profesional
                            if (nuevosConteos.length === 1) {
                                const conteo = nuevosConteos[0];
                                showAlert(
                                    'Nuevo Conteo Registrado',
                                    `Se registró un conteo de tipo "${conteo.tipo === 'cajas' ? 'Cajas' : 'Stand'}" para el inventario "${conteo.numero}" por ${conteo.registrado} en ${conteo.tienda || 'Malvinas'}`,
                                    'success'
                                );
                            } else {
                                showAlert(
                                    'Nuevos Conteos Registrados',
                                    `Se registraron ${nuevosConteos.length} nuevos conteos`,
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
                    }

                    // Actualizar el set global de IDs vistos (acumulativo) - siempre, sin importar la página
                    setConteosAnterioresIds(prev => {
                        const nuevoSet = new Set(prev);
                        allSessions.forEach((s: any) => nuevoSet.add(s.id));
                        return nuevoSet;
                    });
                }

                // El backend ya ordena por ID DESC (más reciente primero), mantener ese orden
                // No reordenar en el frontend para preservar el orden del backend
                const sesionesOrdenadas = allSessions;

                setState((prev: any) => ({
                    ...prev,
                    sesiones: { ...prev.sesiones, malvinas: sesionesOrdenadas }
                }));
            }
        } catch (e) {
            console.error('Error al cargar historial:', e);
        } finally {
            setLoadingHistorial(false);
        }
    }, [setState]);

    const sincronizarConteosLocales = useCallback(async () => {
        if (!state.sesionActual.inventario_id) return;
        try {
            const response = await apiCall(`listar_conteos_malvinas&inventario_id=${state.sesionActual.inventario_id}`, 'GET');
            if (response.success && response.tiendas) {
                setActiveSessionCounts(response.tiendas);
            }
        } catch (e) {
            console.error("Error sincronizando conteos locales:", e);
        }
    }, [state.sesionActual.inventario_id]);

    useEffect(() => {
        cargarSesionesAPI(pageMalvinas);
        sincronizarConteosLocales();
        const interval = setInterval(() => {
            cargarSesionesAPI(pageMalvinas);
            sincronizarConteosLocales();
        }, 3000);
        return () => clearInterval(interval);
    }, [cargarSesionesAPI, sincronizarConteosLocales, pageMalvinas]);

    // Calcular estados para el encabezado
    const invNum = state.sesionActual.numero;
    const invNumNorm = (invNum || '').trim().toUpperCase();
    const sesionesMalvinas = state.sesiones.malvinas || [];

    // Lógica Global de Malvinas: Se considera que una tienda está 'totalmente terminada' si tiene AMBOS conteos (Cajas y Stand)
    const tiendasTotalmenteTerminadas = TIENDAS.filter(t => {
        const hasCajas = sesionesMalvinas.some((s: any) => (s.numero || '').trim().toUpperCase() === invNumNorm && s.tienda === t && s.tipo === 'cajas') ||
            activeSessionCounts?.[t]?.conteos_por_cajas?.some((c: any) => c.estado === 'finalizado');

        const hasStand = sesionesMalvinas.some((s: any) => (s.numero || '').trim().toUpperCase() === invNumNorm && s.tienda === t && s.tipo === 'stand') ||
            activeSessionCounts?.[t]?.conteos_por_stand?.some((c: any) => c.estado === 'finalizado');

        return hasCajas && hasStand;
    });

    const totalContadas = tiendasTotalmenteTerminadas.length;
    const todoCompletado = totalContadas === TIENDAS.length && TIENDAS.length > 0;

    // Conteo específico por tipo para los botones del header
    const tiendasCajasHechas = TIENDAS.filter(t => {
        const enHistorial = sesionesMalvinas.some((s: any) => (s.numero || '').trim().toUpperCase() === invNumNorm && s.tienda === t && s.tipo === 'cajas');
        const enActivo = activeSessionCounts?.[t]?.conteos_por_cajas?.some((c: any) => c.estado === 'finalizado');
        return enHistorial || enActivo;
    });

    const tiendasStandHechas = TIENDAS.filter(t => {
        const enHistorial = sesionesMalvinas.some((s: any) => (s.numero || '').trim().toUpperCase() === invNumNorm && s.tienda === t && s.tipo === 'stand');
        const enActivo = activeSessionCounts?.[t]?.conteos_por_stand?.some((c: any) => c.estado === 'finalizado');
        return enHistorial || enActivo;
    });

    // Los botones se mostrarán verdes si todas sus tiendas respectivas están cubiertas
    const cajasCompletadoGlobal = tiendasCajasHechas.length === TIENDAS.length && TIENDAS.length > 0;
    const standCompletadoGlobal = tiendasStandHechas.length === TIENDAS.length && TIENDAS.length > 0;

    // Indicadores de proceso: Solo mostrar cargando si hay algo en proceso QUE NO ESTÉ YA TERMINADO (POR TIPO)
    const cajasEnProcesoHeader = state.conteosEnProceso?.some((c: any) =>
        (c.almacen_nombre || '').trim().toLowerCase() === 'malvinas' &&
        (c.tipo_conteo || '').toLowerCase().includes('cajas') &&
        c.estado === 'en_proceso' &&
        !tiendasCajasHechas.map(th => th).includes(c.tienda_nombre)
    );

    const standEnProcesoHeader = state.conteosEnProceso?.some((c: any) =>
        (c.almacen_nombre || '').trim().toLowerCase() === 'malvinas' &&
        (c.tipo_conteo || '').toLowerCase().includes('stand') &&
        c.estado === 'en_proceso' &&
        !tiendasStandHechas.map(th => th).includes(c.tienda_nombre)
    );

    // Detección de bloqueo en tiempo real
    const currentIsDone = currentConteo && state.sesiones.malvinas?.some((s: any) =>
        s.numero === currentConteo.numero &&
        s.tipo === currentConteo.tipo &&
        s.tienda === currentConteo.tienda
    );
    const isLocked = currentConteo && (
        currentIsDone ||
        state.sesiones.malvinas?.some((s: any) =>
            s.numero === currentConteo.numero &&
            s.tipo === currentConteo.tipo &&
            s.tienda === currentConteo.tienda &&
            s.registrado !== currentConteo.registrado
        )
    );

    const handleIniciarConfirm = async (data: any) => {
        // Validar duplicados antes de iniciar
        const res = await checkExistingCount(data.tipo, data.tienda);
        if (res === true) {
            showAlert('Atención', `El conteo ${data.tipo.toUpperCase()} para ${data.tienda} ya fue registrado.`, 'warning');
            setIsIniciarOpen(false);
            return;
        } else if (res === 'en_proceso') {
            showAlert('En Proceso', `Ya hay alguien realizando el conteo ${data.tipo.toUpperCase()} para ${data.tienda}.`, 'warning');
            setIsIniciarOpen(false);
            return;
        }

        let initialFilas = state.productos.map(p => ({
            ...p,
            cantidad_conteo: ''
        }));

        // Si no hay productos globales, intentamos cargar desde el inventario_id si existe
        if (initialFilas.length === 0 && state.sesionActual.inventario_id) {
            try {
                const response = await apiCall(`obtener_detalle_conteo&conteo_id=${state.sesionActual.inventario_id}`, 'GET');
                if (response.success && response.productos) {
                    initialFilas = response.productos.map((p: any) => ({
                        item: p.item,
                        producto: p.producto,
                        codigo: p.codigo,
                        unidad_medida: p.unidad_medida,
                        cantidad_conteo: ''
                    }));
                }
            } catch (e) {
                console.error("Error cargando productos de emergencia:", e);
            }
        }

        // Registrar en backend que se inicia el conteo (Para que otros lo vean "En Proceso")
        const startRes = await apiCall('iniciar_conteo', 'POST', {
            numero_inventario: state.sesionActual.numero, // Usamos el del estado actual
            almacen_id: 2, // 2 para Malvinas
            tienda_id: data.tienda_id,
            registrado_por: data.registrado,
            tipo_conteo: data.tipo === 'cajas' ? 'por_cajas' : 'por_stand',
            origen_datos: 'sistema'
        });

        if (!startRes.success) {
            showAlert('Error', 'No pudo iniciarse el conteo en el servidor: ' + startRes.message, 'error');
            return;
        }

        // El ID del conteo puede venir como conteo_id o id según el endpoint
        const cid = startRes.conteo_id || startRes.id || (startRes.conteo && startRes.conteo.id);

        if (!cid) {
            console.warn("No se recibió conteo_id del servidor", startRes);
        }

        // Actualización optimista para que el botón naranja salga YA
        setState((prev: any) => ({
            ...prev,
            conteosEnProceso: [...(prev.conteosEnProceso || []), {
                conteo_id: cid,
                almacen_nombre: 'Malvinas',
                tienda_nombre: data.tienda,
                tipo_conteo: data.tipo === 'cajas' ? 'por_cajas' : 'por_stand',
                estado: 'en_proceso'
            }]
        }));

        // CRÍTICO: Cargar los detalle_id reales del conteo recién creado
        let rowsWithIds = initialFilas;
        if (cid) {
            try {
                // Esperar un momento para que el SP termine de cargar
                await new Promise(resolve => setTimeout(resolve, 500));
                const detailRes = await apiCall(`obtener_detalle_conteo&conteo_id=${cid}`, 'GET');
                if (detailRes.success && detailRes.productos) {
                    rowsWithIds = detailRes.productos.map((p: any) => ({
                        ...p,
                        cantidad_conteo: ''
                    }));
                    console.log(`✅ IDs reales cargados para Malvinas ${cid}: ${rowsWithIds.length} filas`);
                }
            } catch (e) {
                console.error("Error al cargar IDs reales en Malvinas:", e);
            }
        }

        const nuevoConteo = {
            ...data,
            conteo_id: cid,
            filas: rowsWithIds
        };
        setCurrentConteo(nuevoConteo);
        guardarCurrentConteo(nuevoConteo);
        setIsIniciarOpen(false);
        setIsAvisoOpen(true);
    };

    const handleSaveIndividual = async (codigo: string) => {
        if (!currentConteo || isLocked) return;
        const fila = currentConteo.filas.find((f: any) => f.codigo === codigo);
        if (!fila || fila.cantidad_conteo === '') return;

        const val = Number(fila.cantidad_conteo);
        const id_a_enviar = fila.detalle_id || fila.id;

        if (!id_a_enviar) {
            console.warn("⚠️ No hay detalle_id aún para", codigo);
            return;
        }

        try {
            // Usamos actualizar_masivo incluso para uno solo para asegurar que se guarde tanto cantidad como unidad
            await apiCall('actualizar_masivo', 'POST', {
                conteo_id: currentConteo.conteo_id,
                usuario: currentConteo.registrado || 'Sistema',
                productos: [{
                    detalle_id: id_a_enviar,
                    nueva_cantidad: isNaN(val) ? 0 : val,
                    nueva_unidad_medida: fila.unidad_medida || 'UNIDAD'
                }]
            });
            console.log(`💾 Auto-guardado individual (Malvinas): ${codigo} -> ${val} (${fila.unidad_medida})`);
        } catch (e) {
            console.error("❌ Error auto-guardando Malvinas:", e);
        }
    };

    const handleAvisoEntendido = () => {
        setIsAvisoOpen(false);
    };

    const handleUpdateCantidad = (codigo: string, valor: string) => {
        if (!currentConteo) return;
        const nuevasFilas = currentConteo.filas.map((f: any) =>
            f.codigo === codigo ? { ...f, cantidad_conteo: valor } : f
        );
        const conteoActualizado = { ...currentConteo, filas: nuevasFilas };
        setCurrentConteo(conteoActualizado);
        guardarCurrentConteo(conteoActualizado);
    };

    const handleUpdateUnidad = (codigo: string, valor: string) => {
        if (!currentConteo) return;
        const nuevasFilas = currentConteo.filas.map((f: any) =>
            f.codigo === codigo ? { ...f, unidad_medida: valor } : f
        );
        const conteoActualizado = { ...currentConteo, filas: nuevasFilas };
        setCurrentConteo(conteoActualizado);
        guardarCurrentConteo(conteoActualizado);
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

                // Leer como array de arrays para acceder por posición de columna
                const dataArray = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

                if (dataArray.length === 0) {
                    showAlert('Error', 'El archivo Excel está vacío.', 'error');
                    return;
                }

                // Encontrar índices de columnas: B=1 (código), N=13 (cantidad)
                let codigoColIndex = 1;
                let cantidadColIndex = 13;
                let nombreColIndex = 0; // Columna A para nombre del producto

                const headerRow = dataArray[0] || [];
                let foundCodigoByPosition = false;
                let foundCantidadByPosition = false;

                // Verificar si la columna B tiene datos (código)
                if (headerRow.length > codigoColIndex && headerRow[codigoColIndex]) {
                    foundCodigoByPosition = true;
                } else {
                    const codigoHeader = headerRow.findIndex((h: any) => {
                        const hStr = String(h || '').toLowerCase().trim();
                        return hStr.includes('codigo') || hStr.includes('código') || hStr.includes('cod');
                    });
                    if (codigoHeader >= 0) {
                        codigoColIndex = codigoHeader;
                        foundCodigoByPosition = true;
                    }
                }

                // Verificar si la columna N tiene datos (cantidad)
                if (headerRow.length > cantidadColIndex && headerRow[cantidadColIndex]) {
                    foundCantidadByPosition = true;
                } else {
                    const cantidadHeader = headerRow.findIndex((h: any) => {
                        const hStr = String(h || '').toLowerCase().trim();
                        return hStr.includes('cantidad') || hStr.includes('cant') || hStr.includes('conteo');
                    });
                    if (cantidadHeader >= 0) {
                        cantidadColIndex = cantidadHeader;
                        foundCantidadByPosition = true;
                    }
                }

                if (!foundCodigoByPosition) {
                    showAlert('Error', 'No se encontró la columna "Código" (B) en el archivo Excel.', 'error');
                    return;
                }

                if (!foundCantidadByPosition) {
                    showAlert('Error', 'No se encontró la columna "Cantidad" (N) en el archivo Excel.', 'error');
                    return;
                }

                // Extraer datos para previsualización
                const previewData: Array<{ codigo: string, cantidad: any, producto?: string }> = [];
                const startRow = headerRow.some((h: any) => String(h || '').toLowerCase().includes('codigo') || String(h || '').toLowerCase().includes('cantidad')) ? 1 : 0;

                for (let i = startRow; i < dataArray.length; i++) {
                    const row = dataArray[i];
                    if (!row || row.length === 0) continue;

                    const codigo = String(row[codigoColIndex] || '').trim().toUpperCase();
                    const cantidad = row[cantidadColIndex];
                    const producto = row[nombreColIndex] ? String(row[nombreColIndex]).trim() : undefined;

                    if (codigo && cantidad !== undefined && cantidad !== null && cantidad !== '') {
                        previewData.push({ codigo, cantidad, producto });
                    }
                }

                if (previewData.length === 0) {
                    showAlert('Aviso', 'No se encontraron datos válidos en el archivo Excel.', 'warning');
                    return;
                }

                // Mostrar modal de previsualización
                setExcelPreviewData(previewData);
                setPendingExcelFile(file);
                setShowPreviewModal(true);
            } catch (error) {
                console.error(error);
                showAlert('Error', 'Hubo un problema al procesar el archivo Excel.', 'error');
            }
        };
        reader.readAsBinaryString(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmExcelUpload = () => {
        if (!pendingExcelFile || !currentConteo) return;

        // Crear mapa: código -> cantidad
        const excelMap = new Map<string, any>();
        excelPreviewData.forEach(item => {
            excelMap.set(item.codigo, item.cantidad);
        });

        // Actualizar filas usando el mapa
        let updatedCount = 0;
        const newFilas = currentConteo.filas.map((fila: any) => {
            const codigoNormalizado = String(fila.codigo || '').trim().toUpperCase();
            const cantidadExcel = excelMap.get(codigoNormalizado);

            if (cantidadExcel !== undefined && cantidadExcel !== null && cantidadExcel !== '') {
                updatedCount++;
                return { ...fila, cantidad_conteo: String(cantidadExcel) };
            }
            return fila;
        });

        if (updatedCount > 0) {
            const conteoActualizado = { ...currentConteo, filas: newFilas };
            setCurrentConteo(conteoActualizado);
            guardarCurrentConteo(conteoActualizado);
            setShowTable(true);
            showAlert('Carga Exitosa', `Se actualizaron ${updatedCount} productos desde el archivo.`, 'success');
        } else {
            showAlert('Aviso', 'No se encontraron coincidencias de CÓDIGO en el archivo. Verifique las columnas.', 'warning');
        }

        // Cerrar modal y limpiar
        setShowPreviewModal(false);
        setExcelPreviewData([]);
        setPendingExcelFile(null);
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
                filas: currentConteo.filas.filter((f: any) => f.cantidad_conteo !== '')
            };

            // Guardar solo los que tienen conteo
            const filasAGuardar = currentConteo.filas.filter((f: any) => f.cantidad_conteo !== '');

            if (filasAGuardar.length > 0) {
                // Usar actualización masiva
                await apiCall('actualizar_masivo', 'POST', {
                    conteo_id: currentConteo.conteo_id,
                    usuario: currentConteo.registrado || 'Sistema',
                    productos: filasAGuardar.map((f: any) => ({
                        detalle_id: f.detalle_id || f.id,
                        nueva_cantidad: Number(f.cantidad_conteo),
                        nueva_unidad_medida: f.unidad_medida || 'UNIDAD'
                    }))
                });
            }

            // Notificar al servidor que el conteo ha terminado
            if (currentConteo.conteo_id) {
                await apiCall('finalizar_conteo', 'POST', {
                    conteo_id: currentConteo.conteo_id,
                    archivo_pdf: null
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
                tienda: currentConteo.tienda,
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
                    malvinas: [...(prev.sesiones.malvinas || []), newItem]
                }
            }));


            setCurrentConteo(null);
            limpiarCurrentConteo();
            setShowTable(false);
            // cargarSesionesAPI(); // Se comenta para mantener el update optimista
        } catch (e) {
            console.error(e);
            showAlert('Error', 'Error al registrar inventario', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getTiendaStatus = (tienda: string) => {
        // 1. Verificar si AMBOS están completados (Cajas y Stand)
        const hasCajas = (state.sesiones.malvinas || []).some((s: any) =>
            s.tienda === tienda && s.numero === state.sesionActual.numero && s.tipo === 'cajas' && s.fin
        ) || activeSessionCounts?.[tienda]?.conteos_por_cajas?.some((c: any) => c.estado === 'finalizado');

        const hasStand = (state.sesiones.malvinas || []).some((s: any) =>
            s.tienda === tienda && s.numero === state.sesionActual.numero && s.tipo === 'stand' && s.fin
        ) || activeSessionCounts?.[tienda]?.conteos_por_stand?.some((c: any) => c.estado === 'finalizado');

        if (hasCajas && hasStand) return 'listo';

        // Si al menos uno está listo o en proceso, podríamos considerarlo "en_proceso" para la visualización global
        if (hasCajas || hasStand) {
            // Pero comprobamos si el que falta está realmente en proceso
            return 'en_proceso';
        }

        // 3. Verificar si está en proceso por alguien más (vía conteosEnProceso)
        const enProceso = state.conteosEnProceso?.some((c: any) =>
            c.tienda_nombre === tienda &&
            c.almacen_nombre === 'Malvinas' &&
            c.estado === 'en_proceso'
        );
        if (enProceso) return 'en_proceso';

        return 'pendiente';
    };

    const handleDownloadPDF = async (sesion: any) => {
        try {
            let filas = sesion.filas || [];

            // Si no hay filas (historial antiguo), cargar detalle
            if (filas.length === 0 && sesion.id && !String(sesion.id).startsWith('temp-')) {
                const response = await apiCall(`obtener_detalle_conteo&conteo_id=${sesion.id}`, 'GET');
                if (response.success && response.productos) {
                    filas = response.productos.map((p: any) => ({
                        item: p.item_producto || p.item,
                        producto: p.producto,
                        codigo: p.codigo,
                        cantidad: p.cantidad || p.cantidad_fisica || 0,
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
            doc.text(`Inventario Malvinas – ${sesion.numero}`, 14, 20);

            doc.setFontSize(10);
            doc.text(`Registrado por: ${sesion.registrado}`, 14, 30);
            doc.text(`Fecha Inicio: ${sesion.inicio} - Fecha Fin: ${sesion.fin || 'En curso'}`, 14, 36);
            if (sesion.tienda) {
                doc.text(`Tienda: ${sesion.tienda}`, 14, 42);
            }

            // Tabla
            const tableBody = filas.map((f: any) => [
                f.item || '-',
                f.producto,
                f.codigo,
                f.cantidad || f.cantidad_conteo || '0',
                f.unidad_medida || 'UND'
            ]);

            autoTable(doc, {
                startY: sesion.tienda ? 50 : 45,
                head: [['Item', 'Producto', 'Código', 'Cantidad', 'U.M.']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [11, 59, 140] }, // #0B3B8C
            });

            doc.save(`Inventario_Malvinas_${sesion.numero}.pdf`);

        } catch (error) {
            console.error('Error generando PDF:', error);
            showAlert('Error', 'No se pudo generar el PDF', 'error');
        }
    };

    const handleGenerateReport = () => {
        try {
            const dataToExport = state.sesiones.malvinas?.filter((s: any) =>
                s.numero.toLowerCase().includes(filterText.toLowerCase()) ||
                s.registrado.toLowerCase().includes(filterText.toLowerCase()) ||
                (s.tienda || '').toLowerCase().includes(filterText.toLowerCase())
            ) || [];

            if (dataToExport.length === 0) {
                showAlert('Aviso', 'No hay datos para exportar.', 'warning');
                return;
            }

            const doc = new jsPDF();
            doc.text('Historial de Inventarios - Malvinas', 14, 20);
            doc.setFontSize(10);
            doc.text(`Fecha de reporte: ${new Date().toLocaleString()}`, 14, 30);

            const tableBody = dataToExport.map((s: any, idx: number) => [
                idx + 1,
                s.inicio,
                s.numero,
                s.tienda,
                s.tipo.toUpperCase(),
                s.registrado,
                s.fin || '-'
            ]);

            autoTable(doc, {
                startY: 40,
                head: [['#', 'Fecha', 'N° Inv', 'Tienda', 'Tipo', 'Registrado', 'Fin']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [11, 59, 140] },
            });

            doc.save(`Reporte_Historial_Malvinas_${Date.now()}.pdf`);
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
        <div id="view-malvinas" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 transition-all">
                    <header className="flex justify-between items-start flex-wrap gap-4 mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-[#002D5A] to-[#002D5A] rounded-xl flex items-center justify-center text-white shadow-sm transition-all duration-200">
                                <Store className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0" style={{ fontSize: '22px' }}>
                                    Almacén Malvinas
                                </h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    Gestiona el inventario del almacén Malvinas
                                </p>
                            </div>
                        </div>
                        <div className="header-actions flex gap-3">
                            <button
                                onClick={() => {
                                    if (!state.sesionActual.activo) { showAlert('Error', 'Asigne un N° de Inventario primero', 'error'); return; }
                                    setTipoConteo('cajas');
                                    setIsIniciarOpen(true);
                                }}
                                className={`flex items-center space-x-1.5 px-6 py-2 rounded-full btn-oval font-semibold transition-all duration-200 shadow-sm text-xs ${cajasCompletadoGlobal
                                    ? 'bg-green-100 text-green-700 border border-green-200 cursor-not-allowed opacity-80'
                                    : cajasEnProcesoHeader
                                        ? 'bg-amber-100 text-amber-700 border border-amber-200 hover:shadow-md'
                                        : 'bg-gradient-to-br from-[#E9F1FF] to-[#D9E6FF] hover:from-[#D9E6FF] hover:to-[#C9D6FF] text-[#0B3B8C] hover:shadow-md hover:scale-105 active:scale-[0.98]'
                                    }`}
                                disabled={cajasCompletadoGlobal}
                            >
                                {cajasCompletadoGlobal ? <ShieldCheck className="w-4 h-4" /> : cajasEnProcesoHeader ? <Loader2 className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />}
                                <span>{cajasCompletadoGlobal ? 'Cajas: Completado' : `Conteo por Cajas ${tiendasCajasHechas.length}/${TIENDAS.length}`}</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (!state.sesionActual.activo) { showAlert('Error', 'Asigne un N° de Inventario primero', 'error'); return; }
                                    setTipoConteo('stand');
                                    setIsIniciarOpen(true);
                                }}
                                className={`flex items-center space-x-1.5 px-6 py-2 rounded-full btn-oval font-semibold transition-all duration-200 shadow-sm text-xs ${standCompletadoGlobal
                                    ? 'bg-green-100 text-green-700 border border-green-200 cursor-not-allowed opacity-80'
                                    : standEnProcesoHeader
                                        ? 'bg-amber-100 text-amber-700 border border-amber-200 hover:shadow-md'
                                        : 'bg-gradient-to-br from-[#E9F1FF] to-[#D9E6FF] hover:from-[#D9E6FF] hover:to-[#C9D6FF] text-[#0B3B8C] hover:shadow-md hover:scale-105 active:scale-[0.98]'
                                    }`}
                                disabled={standCompletadoGlobal}
                            >
                                {standCompletadoGlobal ? <ShieldCheck className="w-4 h-4" /> : standEnProcesoHeader ? <Loader2 className="w-4 h-4 animate-spin" /> : <Columns className="w-4 h-4" />}
                                <span>{standCompletadoGlobal ? 'Stand: Completado' : `Conteo de Stand ${tiendasStandHechas.length}/${TIENDAS.length}`}</span>
                            </button>
                        </div>
                    </header>

                    <div className="mb-6 font-poppins">
                        <div className="font-bold mb-4 text-slate-700 text-sm tracking-wide uppercase">Estado de Tiendas</div>
                        <div id="status-tiendas" className="flex flex-wrap gap-6">
                            {TIENDAS.map(tienda => {
                                const status = getTiendaStatus(tienda);
                                const dotClass = status === 'listo' ? 'bg-[#198754]' : (status === 'en_proceso' ? 'bg-[#fd7e14]' : 'bg-[#dc3545]');
                                return (
                                    <div key={tienda} className="flex items-center gap-2.5 text-sm font-bold text-slate-600">
                                        <span className={`w-3.5 h-3.5 rounded-full ${dotClass} shadow-sm`}></span>
                                        {tienda}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Panel de Conteo Activo */}
                    {currentConteo && (
                        <div className="mb-6 p-4 rounded-2xl border-2 border-[#E9F1FF] bg-[#F8FAFF] animate-in zoom-in-95 duration-300">
                            {isLocked && (
                                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl flex items-center gap-3">
                                    <ShieldCheck className="w-6 h-6 text-amber-500" />
                                    <div>
                                        <p className="font-bold">
                                            {currentIsDone
                                                ? '¡Este conteo ya fue completado!'
                                                : '¡Atención! Este conteo está siendo registrado o ya existe.'}
                                        </p>
                                        <p className="text-sm">No es posible guardar nuevos cambios. La sesión se ha bloqueado.</p>
                                    </div>
                                </div>
                            )}
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
                                        <span className="mx-2">•</span>
                                        Tienda: <span className="text-amber-600 font-bold">{currentConteo.tienda}</span>
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white rounded-full btn-oval font-bold shadow-sm transition-all text-xs"
                                        disabled={!!isLocked}
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
                                        disabled={!!isLocked}
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
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
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
                                                                    onBlur={() => handleSaveIndividual(p.codigo)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveIndividual(p.codigo)}
                                                                    disabled={!!isLocked}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <select
                                                                    className="w-28 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:border-[#0B3B8C] outline-none transition-all p-1"
                                                                    value={p.unidad_medida || 'UNIDAD'}
                                                                    onChange={(e) => handleUpdateUnidad(p.codigo, e.target.value)}
                                                                    onBlur={() => handleSaveIndividual(p.codigo)}
                                                                    disabled={!!isLocked}
                                                                >
                                                                    <option value="UNIDAD">UNIDAD</option>
                                                                    <option value="DOCENAS">DOCENAS</option>
                                                                    <option value="DECENAS">DECENAS</option>
                                                                </select>
                                                            </td>
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
                                            disabled={isSubmitting || !!isLocked}
                                            className={`px-8 py-2.5 bg-[#0B3B8C] text-white rounded-full btn-oval font-bold shadow-md hover:bg-[#002D5A] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 ${isSubmitting || isLocked ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Registrando...</span>
                                                </>
                                            ) : isLocked ? (
                                                'Bloqueado'
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
                                    className="bg-white border-2 border-gray-200 text-sm rounded-xl block w-96 pl-10 p-2.5 focus:border-[#0B3B8C] outline-none transition-all shadow-sm"
                                    placeholder="Buscar..."
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                />
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                            </div>
                            <button
                                onClick={handleGenerateReport}
                                className="bg-[#002D5A] text-white font-bold px-6 py-2.5 rounded-full flex items-center gap-2 hover:bg-[#001F3D] transition-colors text-sm shadow-sm"
                            >
                                <FileText className="w-4 h-4" />
                                <span>Generar reporte</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
                        <div className="overflow-hidden">
                            <table className="w-full table-auto">
                                <thead>
                                    <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ID</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">FECHA REGISTRO</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">N° INVENTARIO</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">TIENDA</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">TIPO</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">REGISTRADO POR</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">ARCHIVO</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">HORA FINAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(state.sesiones.malvinas || []).length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-3 py-12 text-center text-sm text-gray-500 font-medium italic">
                                                No hay registros aún
                                            </td>
                                        </tr>
                                    ) : (
                                        state.sesiones.malvinas.map((s: any, idx: number) => {
                                            const esNuevo = nuevosConteosIds.has(s.id);

                                            return (
                                                <tr
                                                    key={s.id}
                                                    className={`border-b border-gray-100 hover:opacity-90 ${esNuevo ? 'animate-pulse-new' : ''
                                                        }`}
                                                    style={{
                                                        backgroundColor: esNuevo ? `rgba(11, 59, 140, 0.08)` : 'white'
                                                    }}
                                                >
                                                    <td className="px-4 py-3 whitespace-nowrap text-[10px] font-medium text-gray-700">{(pageMalvinas - 1) * 10 + idx + 1}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-700">{formatearFechaPeru(s.inicio)}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-700">{s.numero}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-700">{s.tienda}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[10px] font-bold uppercase text-gray-700">{s.tipo}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[10px] font-bold text-gray-700">{s.registrado}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[10px]">
                                                        <button
                                                            onClick={() => handleDownloadPDF(s)}
                                                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-red-600 text-white rounded-full text-[10px] font-bold hover:bg-red-700 transition-all duration-200 shadow-sm"
                                                        >
                                                            <FileText className="w-3 h-3" />
                                                            <span>PDF</span>
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-700">{s.fin ? formatearFechaPeru(s.fin) : '-'}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación */}
                        {paginationMalvinas && (
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                                <button
                                    onClick={() => setPageMalvinas(1)}
                                    disabled={pageMalvinas === 1 || loadingHistorial}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    «
                                </button>
                                <button
                                    onClick={() => setPageMalvinas(prev => Math.max(1, prev - 1))}
                                    disabled={!paginationMalvinas.has_prev || loadingHistorial}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    &lt;
                                </button>
                                <span className="text-xs text-gray-700 font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    Página {pageMalvinas} de {paginationMalvinas.total_pages}
                                </span>
                                <button
                                    onClick={() => setPageMalvinas(prev => prev + 1)}
                                    disabled={!paginationMalvinas.has_next || loadingHistorial}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    &gt;
                                </button>
                                <button
                                    onClick={() => setPageMalvinas(paginationMalvinas.total_pages)}
                                    disabled={pageMalvinas === paginationMalvinas.total_pages || loadingHistorial}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                    style={{ fontFamily: 'var(--font-poppins)' }}
                                >
                                    »
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <IniciarConteoModal
                isOpen={isIniciarOpen}
                onClose={() => setIsIniciarOpen(false)}
                almacen="Malvinas"
                tipo={tipoConteo}
                onConfirm={handleIniciarConfirm}
                activeCounts={activeSessionCounts}
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

            {/* Modal de Previsualización de Excel */}
            <Modal
                isOpen={showPreviewModal}
                onClose={() => {
                    setShowPreviewModal(false);
                    setExcelPreviewData([]);
                    setPendingExcelFile(null);
                }}
                title={<><FileText className="w-5 h-5" /> Previsualización de Excel</>}
                size="xl"
                footer={
                    <>
                        <button
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-bold transition-colors"
                            onClick={() => {
                                setShowPreviewModal(false);
                                setExcelPreviewData([]);
                                setPendingExcelFile(null);
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            className="px-4 py-2 bg-[#002D5A] text-white rounded-full font-bold hover:bg-[#001F3D] transition-colors"
                            onClick={handleConfirmExcelUpload}
                        >
                            Confirmar y Cargar
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <p className="text-xs text-blue-700 font-medium m-0">
                            Se encontraron <strong>{excelPreviewData.length}</strong> productos en el archivo Excel. Revise los datos antes de confirmar.
                        </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">#</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Producto</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Código</th>
                                        <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Cantidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {excelPreviewData.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                                            <td className="px-3 py-4 text-xs text-gray-500">{idx + 1}</td>
                                            <td className="px-3 py-4 text-xs font-semibold text-gray-900">{item.producto || '-'}</td>
                                            <td className="px-3 py-4 text-xs text-gray-600 font-medium">{item.codigo}</td>
                                            <td className="px-3 py-4 text-xs text-center font-bold text-gray-900">{item.cantidad}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
