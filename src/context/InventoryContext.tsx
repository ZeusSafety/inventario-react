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
    sesionActual: {
        numero: string | null;
        creadoPor: string | null;
        inicio: string | null;
        activo: boolean;
        inventario_id?: number | string;
    };
}

interface InventoryContextType {
    state: AppState;
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    updateSesionActual: (data: Partial<AppState['sesionActual']>) => void;
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
    sesionActual: { numero: null, creadoPor: null, inicio: null, activo: false }
};

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>(initialState);
    const [notification, setNotification] = useState<FeedbackState | null>(null);

    const showAlert = (title: string, message: string, type: 'success' | 'warning' | 'error' = 'success') => {
        setNotification({ title, message, type });
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setNotification({ title, message, type: 'confirm', onConfirm });
    };

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

    // FETCH ACTIVE INVENTORY ON START
    const syncServerSession = useCallback(async () => {
        try {
            const response = await apiCall('obtener_historial', 'GET');
            if (response.success && response.inventarios) {
                // Detection for active inventory: no fecha_fin, or zero-date strings often used in SQL
                const active = response.inventarios.find((inv: any) =>
                    !inv.fecha_fin ||
                    inv.fecha_fin === '' ||
                    (typeof inv.fecha_fin === 'string' && inv.fecha_fin.startsWith('0000-00-00'))
                );

                if (active) {
                    console.log("Inventario activo detectado en servidor:", active.numero_inventario);
                    setState((prev: AppState) => ({
                        ...prev,
                        sesionActual: {
                            numero: active.numero_inventario,
                            creadoPor: active.autorizado_por || 'Administración • Hervin',
                            inicio: active.fecha_inicio,
                            activo: true,
                            inventario_id: active.id
                        }
                    }));
                }
            }
        } catch (e) {
            console.error("Error syncing session:", e);
        }
    }, []);

    useEffect(() => {
        syncServerSession();
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
            const response = await apiCall('obtener_proformas', 'GET');
            if (response.success && response.proformas) {
                setState((prev: AppState) => ({
                    ...prev,
                    proformas: response.proformas
                }));
            }
        } catch (e) {
            console.error("Error loading proformas:", e);
        }
    }, []);

    return (
        <InventoryContext.Provider value={{
            state,
            setState,
            updateSesionActual,
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
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const h = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    return `${day}/${month}/${year} ${h}:${m}:${s}`;
};

export const uid = () => Math.random().toString(36).slice(2, 10);
