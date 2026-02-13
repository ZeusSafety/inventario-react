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
    const [formData, setFormData] = useState({
        num: state.sesionActual.numero || '',
        area: 'Administración',
        persona: 'Hervin',
        otro: ''
    });
    const [loading, setLoading] = useState(false);

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
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                        {loading ? 'Unirse' : 'Unirse'}
                    </button>
                </>
            }
        >
            <div className="space-y-6 pt-2">
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-4">
                    <p className="text-[11px] text-blue-700 font-medium m-0 leading-tight">
                        Ingrese el número de inventario que ya fue asignado por un jefe o colega.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-5">
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10">Número de Inventario</label>
                        <input
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-bold focus:outline-none focus:border-[#0B3B8C] transition-all"
                            placeholder="Ej: INV-2025-214"
                            value={formData.num}
                            onChange={(e) => setFormData({ ...formData, num: e.target.value })}
                        />
                    </div>

                    <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10">Tu Área</label>
                        <select
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-bold focus:outline-none focus:border-[#0B3B8C] transition-all appearance-none"
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
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10">Tu Nombre</label>
                        <select
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-bold focus:outline-none focus:border-[#0B3B8C] transition-all appearance-none"
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
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10">Especifique Nombre</label>
                            <input
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-bold focus:outline-none focus:border-[#0B3B8C] transition-all"
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
