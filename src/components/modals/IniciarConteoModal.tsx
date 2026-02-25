'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../Modal';
import { useInventory, fmt12 } from '@/context/InventoryContext';
import { ClipboardCheck, Save, Store, Loader2 } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    almacen: 'Callao' | 'Malvinas';
    tipo: 'cajas' | 'stand';
    onConfirm: (data: any) => void;
    activeCounts?: any; // Datos de conteos de la sesión activa
}

const TIENDAS_MAP = [
    { id: 1, t: 'TIENDA 3006' },
    { id: 2, t: 'TIENDA 3006 B' },
    { id: 3, t: 'TIENDA 3131' },
    { id: 4, t: 'TIENDA 3133' },
    { id: 5, t: 'TIENDA 412-A' },
];

export default function IniciarConteoModal({ isOpen, onClose, almacen, tipo, onConfirm, activeCounts }: Props) {
    const { state, showAlert } = useInventory();
    const [loading, setLoading] = useState(false);
    const [tiendasProcesando, setTiendasProcesando] = useState<Set<string>>(new Set());

    const separarFechaHora = (fechaCompleta: string) => {
        // Formato: "DD/MM/YYYY HH:MM:SS"
        const [fecha, hora] = fechaCompleta.split(' ');
        return { fecha: fecha || '', hora: hora || '' };
    };

    const [formData, setFormData] = useState({
        numero: state.sesionActual.numero || '',
        registrado: 'Joseph',
        otro: '',
        fecha: '',
        hora: '',
        tienda: '',
        tienda_id: null as number | null
    });

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isOpen) {
            const fechaCompleta = fmt12();
            const { fecha, hora } = separarFechaHora(fechaCompleta);
            setFormData(prev => ({
                ...prev,
                numero: state.sesionActual.numero || '',
                fecha,
                hora
            }));

            // Reloj en tiempo real mientras el modal esté abierto
            timer = setInterval(() => {
                const fechaCompleta = fmt12();
                const { fecha, hora } = separarFechaHora(fechaCompleta);
                setFormData(prev => ({ ...prev, fecha, hora }));
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isOpen, state.sesionActual.numero]);

    const handleSave = async () => {
        if (!formData.numero.trim()) {
            showAlert('Validación', 'El número de inventario es obligatorio.', 'warning');
            return;
        }

        let registradoFinal = formData.registrado;
        if (formData.registrado === 'Otro') {
            registradoFinal = formData.otro.trim();
            if (!registradoFinal) {
                showAlert('Validación', 'Especifique el nombre del registrador.', 'warning');
                return;
            }
        }

        if (almacen === 'Malvinas' && !formData.tienda) {
            showAlert('Validación', 'Seleccione una tienda para continuar.', 'warning');
            return;
        }

        // Prevenir múltiples clicks por tienda
        const tiendaKey = almacen === 'Malvinas' ? formData.tienda : 'Callao';
        if (tiendasProcesando.has(tiendaKey)) {
            return;
        }

        setLoading(true);
        setTiendasProcesando(prev => new Set(prev).add(tiendaKey));

        try {
            const inicio = `${formData.fecha} ${formData.hora}`;
            await onConfirm({
                ...formData,
                inicio,
                registrado: registradoFinal,
                tipo,
                almacen
            });
        } finally {
            setLoading(false);
            // No removemos de tiendasProcesando para mantener el estado de "ya procesado"
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={<div className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-[#0B3B8C]" /> <span>Datos de Inventario</span></div>}
            size="lg"
            footer={
                <div className="flex justify-end gap-3">
                    <button
                        className="px-6 py-2 bg-gray-500 text-white rounded-full font-bold hover:bg-gray-600 transition-all"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        className="px-6 py-2 bg-[#0B3B8C] text-white rounded-full font-bold flex items-center gap-2 hover:bg-[#002D5A] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleSave}
                        disabled={loading || (almacen === 'Malvinas' && tiendasProcesando.has(formData.tienda))}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                <span>Guardar</span>
                            </>
                        )}
                    </button>
                </div>
            }
        >
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    {/* Fila 1 - Columna 1: Número de Inventario */}
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Número de Inventario</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 text-xs font-medium focus:outline-none focus:border-[#0B3B8C] transition-all"
                            value={formData.numero}
                            disabled
                        />
                    </div>

                    {/* Fila 1 - Columna 2: Registrado por */}
                    <div className="space-y-1 relative">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Registrado por</label>
                        <select
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 text-xs font-medium focus:outline-none focus:border-[#0B3B8C] appearance-none transition-all cursor-pointer"
                            value={formData.registrado}
                            onChange={(e) => setFormData({ ...formData, registrado: e.target.value })}
                        >
                            <option value="Joseph">Joseph</option>
                            <option value="Joselyn">Joselyn</option>
                            <option value="Manuel">Manuel</option>
                            <option value="Otro">Otro</option>
                        </select>
                        <div className="absolute right-3 top-8 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    {/* Fila 2 - Columna 1: Fecha inicio */}
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Fecha inicio</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 text-xs font-medium focus:outline-none transition-all"
                            value={formData.fecha}
                            disabled
                        />
                    </div>

                    {/* Fila 2 - Columna 2: Hora inicio */}
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Hora inicio</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 text-xs font-medium focus:outline-none transition-all"
                            value={formData.hora}
                            disabled
                        />
                    </div>
                </div>

                {formData.registrado === 'Otro' && (
                    <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Especifique Nombre</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 text-xs font-medium focus:outline-none focus:border-[#0B3B8C] transition-all"
                            placeholder="Nombre del registrador"
                            value={formData.otro}
                            onChange={(e) => setFormData({ ...formData, otro: e.target.value })}
                        />
                    </div>
                )}

                {almacen === 'Malvinas' && (() => {
                    // OPTIMIZACIÓN: Pre-calcular estados de todas las tiendas una sola vez
                    const tiendasEstados = useMemo(() => {
                        const estados: Record<string, { isCompleted: boolean; isInProgress: boolean; isDisabled: boolean }> = {};

                        TIENDAS_MAP.forEach(({ t }) => {
                            // 1. Verificar si la tienda ya fue registrada (En historial o en sesión activa) PARA ESTE TIPO
                            const isCompletedHistorial = state.sesiones.malvinas?.some((s: any) =>
                                s.numero === state.sesionActual.numero &&
                                s.tienda === t &&
                                s.tipo === tipo
                            );

                            const isCompletedActivo = tipo === 'cajas'
                                ? activeCounts?.[t]?.conteos_por_cajas?.some((c: any) => c.estado === 'finalizado')
                                : activeCounts?.[t]?.conteos_por_stand?.some((c: any) => c.estado === 'finalizado');

                            // Ahora el estado es independiente: Si contaste cajas, stand sigue disponible.
                            const isCompleted = isCompletedHistorial || isCompletedActivo;

                            // 2. Verificar si está en proceso por alguien más (Polling)
                            const isInProgress = state.conteosEnProceso?.some((c: any) =>
                                c.tienda_nombre === t &&
                                c.almacen_nombre === 'Malvinas' &&
                                c.tipo_conteo === (tipo === 'cajas' ? 'por_cajas' : 'por_stand') &&
                                c.estado === 'en_proceso'
                            );

                            estados[t] = {
                                isCompleted,
                                isInProgress,
                                isDisabled: isCompleted || isInProgress
                            };
                        });

                        return estados;
                    }, [state.sesiones.malvinas, state.sesionActual.numero, tipo, activeCounts, state.conteosEnProceso]);

                    const tiendasFiltradas = useMemo(() => {
                        return TIENDAS_MAP.filter(({ t }) => {
                            if (tipo === 'cajas') return t !== 'TIENDA 3006 B';
                            if (tipo === 'stand') return t !== 'TIENDA 3006';
                            return true;
                        });
                    }, [tipo]);

                    return (
                        <div className="pt-4 border-t border-gray-100 animate-in slide-in-from-bottom-2 duration-500">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-4 tracking-wider">
                                Seleccionar Tienda:
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {tiendasFiltradas.map(({ id, t }) => {
                                    const isSelected = formData.tienda === t;
                                    const { isCompleted, isInProgress, isDisabled } = tiendasEstados[t] || { isCompleted: false, isInProgress: false, isDisabled: false };

                                    // Definir estilos por tienda
                                    const styles: any = {
                                        'TIENDA 3006': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-600', selBorder: 'border-blue-600', selBg: 'bg-blue-100' },
                                        'TIENDA 3006 B': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: 'text-indigo-600', selBorder: 'border-indigo-600', selBg: 'bg-indigo-100' },
                                        'TIENDA 3131': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-600', selBorder: 'border-emerald-600', selBg: 'bg-emerald-100' },
                                        'TIENDA 3133': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-600', selBorder: 'border-amber-600', selBg: 'bg-amber-100' },
                                        'TIENDA 412-A': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: 'text-rose-600', selBorder: 'border-rose-600', selBg: 'bg-rose-100' },
                                    };

                                    const s = styles[t] || styles['TIENDA 3006'];

                                    return (
                                        <div
                                            key={t}
                                            onClick={() => {
                                                if (!isDisabled) {
                                                    setFormData(prev => ({ ...prev, tienda: t, tienda_id: id }));
                                                }
                                            }}
                                            className={`
                                            relative overflow-hidden group
                                            flex flex-col items-center justify-center p-4 text-center
                                            border-2 rounded-xl transition-all duration-300 transform
                                            ${isDisabled
                                                    ? 'opacity-60 grayscale cursor-not-allowed border-gray-200 bg-gray-50'
                                                    : 'cursor-pointer'
                                                }
                                            ${!isDisabled && isSelected
                                                    ? `${s.selBorder} ${s.selBg} shadow-md scale-[1.02]`
                                                    : !isDisabled && `${s.border} bg-white hover:bg-gray-50 hover:shadow-sm hover:scale-[1.01]`
                                                }
                                        `}
                                        >
                                            {/* Indicador de selección (Check) */}
                                            <div className={`
                                            absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300
                                            ${isSelected && !isDisabled ? `${s.text} bg-white scale-100 shadow-sm` : 'scale-0'}
                                        `}>
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>

                                            {/* Icono de Tienda */}
                                            <div className={`
                                            p-3 rounded-full mb-3 transition-colors duration-300
                                            ${isSelected && !isDisabled ? 'bg-white shadow-sm' : `${s.bg}`}
                                            ${isDisabled ? 'bg-gray-200' : ''}
                                        `}>
                                                <Store className={`w-6 h-6 ${isDisabled ? 'text-gray-400' : s.icon}`} />
                                            </div>

                                            <span className={`text-xs font-bold uppercase tracking-tight ${isSelected && !isDisabled ? s.text : 'text-gray-600'} ${isDisabled ? 'text-gray-400' : ''}`}>
                                                {t}
                                                {isCompleted && <span className="block text-[8px] text-green-600 mt-1 font-extrabold uppercase">Completado</span>}
                                                {isInProgress && <span className="block text-[8px] text-amber-600 mt-1 font-extrabold uppercase">En Proceso</span>}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </div>
        </Modal>
    );
}
