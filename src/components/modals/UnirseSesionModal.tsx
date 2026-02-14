'use client';

import React, { useState } from 'react';
import Modal from '../Modal';
import { useInventory } from '@/context/InventoryContext';
import { apiCall } from '@/lib/api';
import { Link2 } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function UnirseSesionModal({ isOpen, onClose }: Props) {
    const { state, setState, updateSesionActual, showAlert } = useInventory();
    const [formData, setFormData] = React.useState({
        num: '',
        area: 'Administración',
        persona: 'Hervin',
        otro: ''
    });
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (isOpen && state.detectedInventory) {
            setFormData(prev => ({
                ...prev,
                num: state.detectedInventory!.numero,
                area: 'Administración',
                persona: 'Hervin'
            }));
        } else if (isOpen && state.sesionActual.numero) {
            setFormData(prev => ({
                ...prev,
                num: state.sesionActual.numero || '',
            }));
        }
    }, [isOpen, state.detectedInventory, state.sesionActual.numero]);

    const handleSave = async () => {
        if (!formData.num.trim()) {
            showAlert('Validación', 'El número de inventario es obligatorio.', 'warning');
            return;
        }

        let persona = formData.persona;
        if (persona === 'Otro') {
            persona = formData.otro.trim();
            if (!persona) {
                showAlert('Validación', 'Especifique su nombre.', 'warning');
                return;
            }
        }

        setLoading(true);
        try {
            const response = await apiCall(`obtener_inventario_activo&numero=${formData.num}`, 'GET');

            if (response.success && response.inventario) {
                const inv = response.inventario;

                // Formatear la fecha de inicio
                let inicioVal = inv.fecha_inicio || '';
                if (inicioVal.startsWith('0000-00-00') || !inicioVal) {
                    inicioVal = new Date().toLocaleString(); // Fallback rápido
                } else {
                    try {
                        const dateObj = new Date(inv.fecha_inicio);
                        if (!isNaN(dateObj.getTime())) {
                            // Usar el mismo formato que el Header
                            const pad = (n: number) => n.toString().padStart(2, '0');
                            inicioVal = `${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${dateObj.getFullYear()} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
                        }
                    } catch (e) {
                        console.warn("No se pudo formatear la fecha:", inv.fecha_inicio);
                    }
                }

                setState(prev => ({
                    ...prev,
                    conteosEnProceso: response.conteos_en_proceso || [],
                    sesionActual: {
                        numero: inv.numero_inventario,
                        creadoPor: inv.autorizado_por,
                        inicio: inicioVal,
                        activo: true,
                        inventario_id: inv.id,
                        metodo: 'unido'
                    }
                }));
                onClose();
                showAlert('¡Conectado!', `Te has unido al inventario ${formData.num}`, 'success');
            } else {
                showAlert('Error', response.message || 'No se encontró un inventario activo con ese número', 'error');
            }
        } catch (e) {
            console.error(e);
            showAlert('Error', 'Error de conexión al servidor', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={<><Link2 className="w-5 h-5" /> Unirse a Inventario Existente</>}
            size="sm"
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <button
                        className="px-6 py-2.5 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-bold transition-all shadow-sm active:scale-95"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button
                        className="px-6 py-2.5 bg-[#007bff] hover:bg-blue-600 text-white rounded-lg font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        onClick={handleSave}
                        disabled={loading}
                    >
                        {loading ? 'Uniéndose...' : 'Unirse'}
                    </button>
                </div>
            }
        >
            <div className="space-y-6 pt-2 pb-2">
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-2">
                    <p className="text-[11px] text-blue-700 font-medium m-0 leading-tight">
                        Ingrese o verifique los datos para unirse a la sesión activa.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="relative">
                        <label className="block text-[10px] font-black text-blue-500 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10 tracking-tighter">Número de Inventario</label>
                        <input
                            className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-700 font-bold focus:outline-none focus:border-blue-400 transition-all shadow-sm text-lg"
                            placeholder="Ej: INV-2025-214"
                            value={formData.num}
                            onChange={(e) => setFormData({ ...formData, num: e.target.value })}
                        />
                    </div>

                    <div className="relative">
                        <label className="block text-[10px] font-black text-blue-500 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10 tracking-tighter">Tu Área</label>
                        <select
                            className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-700 font-bold focus:outline-none focus:border-blue-400 transition-all appearance-none shadow-sm text-lg"
                            value={formData.area}
                            onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                        >
                            <option value="Administración">Administración</option>
                            <option value="Logística">Logística</option>
                            <option value="Ventas">Ventas</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>

                    <div className="relative">
                        <label className="block text-[10px] font-black text-blue-500 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10 tracking-tighter">Tu Nombre</label>
                        <select
                            className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-700 font-bold focus:outline-none focus:border-blue-400 transition-all appearance-none shadow-sm text-lg"
                            value={formData.persona}
                            onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                        >
                            <option value="Joseph">Joseph</option>
                            <option value="Kimberly">Kimberly</option>
                            <option value="Hervin">Hervin</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>

                    {formData.persona === 'Otro' && (
                        <div className="relative animate-in zoom-in-95 duration-200">
                            <label className="block text-[10px] font-black text-blue-500 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10 tracking-tighter">Especifique Nombre</label>
                            <input
                                className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-700 font-bold focus:outline-none focus:border-blue-400 transition-all shadow-sm"
                                placeholder="..."
                                value={formData.otro}
                                onChange={(e) => setFormData({ ...formData, otro: e.target.value })}
                            />
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
