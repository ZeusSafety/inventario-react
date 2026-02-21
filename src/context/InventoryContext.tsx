'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiCall } from '@/lib/api';

export interface Product {
    item: number;
    producto: string;
    codigo: string;
    unidad_medida: string;
    cantidad_sistema: number;
    detalle_id?: number;
}

export interface InventoryRow {
    item: number | string;
    producto: string;
    codigo: string;
    sis: number;
    fis: number;
    res: number;
    estado: string;
    unidad_medida?: string;
}

export interface Accion {
    id: string | number;
    item?: number | string;
    producto?: string;
    fecha: string;
    registrado: string;
    almacen: string;
    motivo: string;
    cantidad?: number | string;
    errorDe?: string;
    obs?: string;
}

export interface InventorySession {
    id: string | number;
    numero: string;
    registrado: string;
    inicio: string;
    fin: string | null;
    tipo: 'cajas' | 'stand';
    tienda?: string;
    filas: InventoryRow[];
    pdfUrl: string | null;
    conteo_id?: number | string;
}

export interface Proforma {
    id: string | number;
    fecha: string;
    asesor: string;
    registrado: string;
    almacen: string;
    num: string;
    estado?: string;
    archivo_pdf?: string | null;
    total_productos?: number;
    filas?: any[];
}

export interface AppState {
    productos: Product[];
    filtro: { ocultarCero: boolean; excluirCodigos: string[] };
    sesiones: { callao: InventorySession[]; malvinas: InventorySession[] };
    sistema: { callao: unknown[]; malvinas: unknown[] };
    comparacion: { almacen: string | null; filas: InventoryRow[] };
    acciones: Accion[];
    proformas: Proforma[];
    verificacion: unknown;
    conteosEnProceso: any[];
    showUnirseModal: boolean;
    lastNotifiedInventory: string | null;
    detectedInventory: {
        numero: string;
        id: number | string;
        autorizado: string;
    } | null;
    sesionActual: {
        numero: string | null;
        creadoPor: string | null;
        inicio: string | null;
        activo: boolean;
        inventario_id?: number | string;
        metodo?: 'asignado' | 'unido';
    };
}

interface InventoryContextType {
    state: AppState;
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    updateSesionActual: (data: Partial<AppState['sesionActual']>) => void;
    setShowUnirseModal: (val: boolean) => void;
    addAccion: (accion: Accion) => void;
    loadProformas: () => Promise<void>;
    notification: FeedbackState | null;
    showAlert: (title: string, message: string, type?: 'success' | 'warning' | 'error') => void;
    showConfirm: (title: string, message: string, onConfirm: () => void) => void;
    hideFeedback: () => void;
}

export interface FeedbackState {
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'confirm';
    onConfirm?: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const initialState: AppState = {
    productos: [],
    filtro: { ocultarCero: false, excluirCodigos: [] },
    sesiones: { callao: [], malvinas: [] },
    sistema: { callao: [], malvinas: [] },
    comparacion: { almacen: null, filas: [] },
    acciones: [],
    proformas: [],
    verificacion: {},
    conteosEnProceso: [],
    showUnirseModal: false,
    lastNotifiedInventory: null,
    detectedInventory: null,
    sesionActual: { numero: null, creadoPor: null, inicio: null, activo: false }
};

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>(initialState);
    const [notification, setNotification] = useState<FeedbackState | null>(null);

    const showAlert = useCallback((title: string, message: string, type: 'success' | 'warning' | 'error' = 'success') => {
        setNotification({ title, message, type });
    }, []);

    const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
        setNotification({ title, message, type: 'confirm', onConfirm });
    }, []);

    const hideFeedback = () => setNotification(null);

    // Initial load from localStorage
    useEffect(() => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('zs_app') : null;
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setState(prev => ({ ...prev, ...parsed })); // eslint-disable-line react-hooks/set-state-in-effect
            } catch (e) {
                console.error("Error parsing localStorage state", e);
            }
        }
    }, []);

    // Save to localStorage on change
    useEffect(() => {
        localStorage.setItem('zs_app', JSON.stringify(state));
    }, [state]);

    // FETCH PRODUCTS ON START (Using conteo_id=1 as master list)
    const fetchProducts = useCallback(async () => {
        try {
            console.log("📦 Cargando lista maestra de productos...");
            const response = await apiCall('obtener_detalle_conteo&conteo_id=1', 'GET');
            console.log('📡 Respuesta de productos:', response);

            // Intentar encontrar el array de productos en varias propiedades posibles
            const productosList = response.productos || response.datos || response.data || response.detalle;

            if (response.success && Array.isArray(productosList)) {
                console.log(`✅ ${productosList.length} productos cargados.`);
                const mappedProducts = (productosList as any[]).map((p, i) => ({
                    item: p.item_producto || (i + 1),
                    producto: p.producto || '',
                    codigo: String(p.codigo || ''),
                    unidad_medida: p.unidad_medida || 'UNIDAD',
                    cantidad_sistema: Number(p.cantidad || 0),
                    detalle_id: p.id
                }));
                setState((prev: AppState) => ({
                    ...prev,
                    productos: mappedProducts
                }));
            } else {
                console.warn("⚠️ No se pudo cargar la lista maestra de productos. Respuesta:", response);
                // Solo mostrar alerta si estamos seguros de que debería haber funcionado
                if (!response.success) {
                    // Opcional: showAlert('Error de Carga', 'No se pudo cargar la lista de productos del servidor.', 'warning');
                }
            }
        } catch (e) {
            console.error("❌ Error fetching products:", e);
            // showAlert('Error', 'Fallo de conexión al cargar productos.', 'error');
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const clearSesionLocal = useCallback(() => {
        console.log("🧹 Limpiando sesión local (sesionActual -> null)");
        setState((prev: AppState) => ({
            ...prev,
            sesionActual: {
                numero: null,
                creadoPor: null,
                inicio: null,
                activo: false,
                inventario_id: undefined
            }
        }));
    }, []);

    // FETCH ACTIVE INVENTORY ON START
    const syncServerSession = useCallback(async () => {
        try {
            const response = await apiCall('listar_conteos_iniciados', 'GET');
            if (response.success && response.inventario) {
                const active = response.inventario;

                setState((prev: AppState) => {
                    const isSameInv = prev.sesionActual.numero === active.numero_inventario;
                    const newCEnP = response.conteos_en_proceso || [];
                    const isSameCEnP = JSON.stringify(prev.conteosEnProceso) === JSON.stringify(newCEnP);

                    // Determine stable start time: PRIORITIZE existing one to avoid flickering
                    let stableInicio = prev.sesionActual.inicio;

                    // IF the server explicitly gives us a valid date, we use it
                    if (active.fecha_inicio && !active.fecha_inicio.startsWith('0000')) {
                        const dateObj = new Date(active.fecha_inicio);
                        if (!isNaN(dateObj.getTime())) {
                            stableInicio = fmt12(dateObj);
                        }
                    } else if (active.fecha_hora_inicio && !active.fecha_hora_inicio.startsWith('0000')) {
                        // Sometimes the field is named differently in some endpoints
                        const dateObj = new Date(active.fecha_hora_inicio);
                        if (!isNaN(dateObj.getTime())) {
                            stableInicio = fmt12(dateObj);
                        }
                    }

                    // Fallback to currently earliest count if still missing
                    if (!stableInicio && newCEnP.length > 0) {
                        const firstDate = newCEnP.reduce((earliest: string, c: any) => {
                            const d = c.fecha_hora_inicio || c.fecha_inicio;
                            if (!d || d.startsWith('0000')) return earliest;
                            return (!earliest || d < earliest) ? d : earliest;
                        }, '');
                        if (firstDate) {
                            stableInicio = fmt12(new Date(firstDate));
                        }
                    }

                    // If we still don't have one (neither from state nor server), fallback once to now
                    if (!stableInicio) {
                        stableInicio = fmt12(new Date());
                    }

                    // Only update if something meaningful changed
                    const needsUpdate = !isSameInv || !isSameCEnP || prev.sesionActual.inicio !== stableInicio || !prev.sesionActual.activo;

                    if (!needsUpdate) return prev;

                    // CHECK LOCAL STORAGE TO SEE IF WE ARE ALREADY JOINED
                    let savedSessionNumber = null;
                    if (typeof window !== 'undefined') {
                        try {
                            const saved = localStorage.getItem('zs_app');
                            if (saved) {
                                const parsed = JSON.parse(saved);
                                savedSessionNumber = parsed.sesionActual?.numero;
                            }
                        } catch (e) { }
                    }

                    if (savedSessionNumber === active.numero_inventario) {
                        return {
                            ...prev,
                            conteosEnProceso: newCEnP,
                            sesionActual: {
                                ...prev.sesionActual,
                                numero: active.numero_inventario,
                                creadoPor: active.autorizado_por || 'Administración • Hervin',
                                inicio: stableInicio,
                                activo: true,
                                inventario_id: active.id,
                                metodo: prev.sesionActual.metodo || 'unido'
                            }
                        };
                    } else {
                        return {
                            ...prev,
                            conteosEnProceso: newCEnP
                        };
                    }
                });

                // Trigger prompt separately with safety check
                const currentLocal = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('zs_app') || '{}') : {};
                const currentNumber = currentLocal.sesionActual?.numero;
                const lastNotified = currentLocal.lastNotifiedInventory;
                const modalUnirseAbierto = currentLocal.showUnirseModal;
                const isPrompting = notification?.type === 'confirm' && notification?.title === 'Inventario Activo Detectado';

                // Si no estamos en ese inventario, no hemos avisado antes de ESTE número, no hay modal de unirse abierto y no estamos preguntando ya...
                if (currentNumber !== active.numero_inventario && lastNotified !== active.numero_inventario && !modalUnirseAbierto && !isPrompting) {
                    console.log("🆕 Nuevo inventario detectado. Solicitando confirmación...");
                    showConfirm(
                        'Inventario Activo Detectado',
                        `Se ha detectado el inventario activo ${active.numero_inventario}. ¿Deseas unirte a la sesión?`,
                        () => {
                            // Al confirmar, marcamos como notificado y abrimos el modal detallado
                            setState(prev => ({
                                ...prev,
                                lastNotifiedInventory: active.numero_inventario,
                                detectedInventory: {
                                    numero: active.numero_inventario,
                                    id: active.id,
                                    autorizado: active.autorizado_por || 'Administración • Hervin'
                                },
                                showUnirseModal: true
                            }));
                        }
                    );

                    // También marcamos como notificado inmediatamente para evitar que el siguiente ciclo de polling (3s) lo vuelva a disparar 
                    // antes de que el usuario responda al Confirm
                    setState(prev => ({ ...prev, lastNotifiedInventory: active.numero_inventario }));
                }
            } else if (response.message?.includes('No hay inventario activo')) {
                // Keep UI stable, only clear if explicitly told so and current session is active
                setState(prev => {
                    if (!prev.sesionActual.activo) return prev;
                    return {
                        ...prev,
                        sesionActual: { numero: null, creadoPor: null, inicio: null, activo: false }
                    };
                });
            }
        } catch (e) {
            console.error("❌ Error syncing session:", e);
        }
    }, [showConfirm, showAlert]);

    useEffect(() => {
        syncServerSession();
        const interval = setInterval(syncServerSession, 3000); // Polling cada 3 segundos
        return () => clearInterval(interval);
    }, [syncServerSession]);

    const updateSesionActual = (data: Partial<AppState['sesionActual']>) => {
        setState((prev: AppState) => ({
            ...prev,
            sesionActual: { ...prev.sesionActual, ...data }
        }));
    };

    const addAccion = (accion: Accion) => {
        setState((prev: AppState) => ({
            ...prev,
            acciones: [accion, ...prev.acciones]
        }));
    };

    const loadProformas = useCallback(async () => {
        try {
            const response = await apiCall('listar_proformas', 'GET');
            console.log('Respuesta de listar_proformas:', response);
            
            // Si la respuesta es exitosa o si simplemente no hay proformas (lista vacía es válida)
            if (response.success || (response.proformas && Array.isArray(response.proformas))) {
                // Mapear los datos del backend al formato esperado
                const proformas = response.proformas || [];
                const proformasMapeadas = proformas.map((pf: any) => ({
                    id: pf.id,
                    fecha: pf.fecha_formateada || pf.fecha_hora_registro || '',
                    asesor: pf.asesor || '',
                    registrado: pf.registrado_por || '',
                    almacen: pf.almacen || '',
                    num: pf.numero_proforma || '',
                    estado: pf.estado || '',
                    archivo_pdf: pf.archivo_pdf || null,
                    total_productos: pf.total_productos || 0
                }));
                
                if (proformasMapeadas.length > 0) {
                    console.log('Proformas mapeadas:', proformasMapeadas);
                } else {
                    console.log('No hay proformas registradas para este inventario');
                }
                
                setState((prev: AppState) => ({
                    ...prev,
                    proformas: proformasMapeadas
                }));
            } else {
                // Solo mostrar error si es un error real, no cuando simplemente no hay datos
                const message: string = (response.message as string) || 'Error desconocido';
                const messageLower = message.toLowerCase();
                const isNormalCase = messageLower.includes('no se especificó inventario') || 
                                    messageLower.includes('no hay inventario activo') ||
                                    messageLower.includes('inventario activo');
                
                if (!isNormalCase) {
                    console.error('Error en listar_proformas:', message);
                } else {
                    // Es normal que no haya inventario activo, solo loguear sin error
                    console.log('No hay inventario activo, lista de proformas vacía');
                }
                
                // Limpiar proformas si hay error o no hay inventario
                setState((prev: AppState) => ({
                    ...prev,
                    proformas: []
                }));
            }
        } catch (e) {
            console.error("Error loading proformas:", e);
            // Limpiar proformas si hay error
            setState((prev: AppState) => ({
                ...prev,
                proformas: []
            }));
        }
    }, []);

    const setShowUnirseModal = (val: boolean) => {
        setState((prev: AppState) => ({ ...prev, showUnirseModal: val }));
    };

    return (
        <InventoryContext.Provider value={{
            state,
            setState,
            updateSesionActual,
            setShowUnirseModal,
            addAccion,
            loadProformas,
            notification,
            showAlert,
            showConfirm,
            hideFeedback
        }}>
            {children}
        </InventoryContext.Provider>
    );
};

export const useInventory = () => {
    const context = useContext(InventoryContext);
    if (context === undefined) {
        throw new Error('useInventory must be used within an InventoryProvider');
    }
    return context;
};

// Helpers
export const fmt12 = (d: Date = new Date()) => {
    // Obtener fecha/hora en zona horaria de Perú (America/Lima)
    const peruTime = d.toLocaleString('en-US', { 
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    // Formato: MM/DD/YYYY, HH:MM:SS -> convertir a DD/MM/YYYY HH:MM:SS
    const [datePart, timePart] = peruTime.split(', ');
    const [month, day, year] = datePart.split('/');
    return `${day}/${month}/${year} ${timePart}`;
};

export const uid = () => Math.random().toString(36).slice(2, 10);
