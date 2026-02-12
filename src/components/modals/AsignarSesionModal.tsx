'use client';

import React, { useState } from 'react';
import Modal from '../Modal';
import { useInventory, fmt12 } from '@/context/InventoryContext';
import { apiCall } from '@/lib/api';
import { ClipboardCheck } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function AsignarSesionModal({ isOpen, onClose }: Props) {
    const { state, updateSesionActual, showAlert } = useInventory();
    const [formData, setFormData] = useState({
        pwd: '',
        num: state.sesionActual.numero || '',
        area: 'Administración',
        persona: 'Hervin',
        otro: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (formData.pwd !== '0427') {
            showAlert('Acceso Denegado', 'Contraseña incorrecta para asignar inventario.', 'error');
            return;
        }
        if (!formData.num.trim()) {
            showAlert('Validación', 'El número de inventario es obligatorio.', 'warning');
            return;
        }

        let persona = formData.persona;
        if (persona === 'Otro') {
            persona = formData.otro.trim();
            if (!persona) {
                showAlert('Validación', 'Especifique el nombre de la persona que autoriza.', 'warning');
                return;
            }
        }

        setLoading(true);
        try {
            const data = {
                numero_inventario: formData.num,
                contrasena: formData.pwd,
                area: formData.area,
                autorizado_por: persona
            };

            const response = await apiCall('asignar_inventario', 'POST', data);

            if (response.success) {
                updateSesionActual({
                    numero: formData.num,
                    creadoPor: `${formData.area} • ${persona}`,
                    inicio: fmt12(),
                    activo: true,
                    inventario_id: response.inventario_id,
                    metodo: 'asignado'
                });
                onClose();
                showAlert('¡Éxito!', 'Número de inventario asignado correctamente.', 'success');
            } else {
                showAlert('Error', response.message || 'Error al asignar inventario', 'error');
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
            title={<><ClipboardCheck className="w-5 h-5" /> Asignar N° Inventario</>}
            size="sm"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                </>
            }
        >
            <div className="space-y-6 pt-2">
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 mb-4">
                    <p className="text-[11px] text-amber-700 font-medium m-0 leading-tight">
                        Ingrese la contraseña del jefe, el N° de inventario y quién autoriza la sesión.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-5">
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10">Contraseña Jefe</label>
                        <input
                            type="password"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-bold focus:outline-none focus:border-[#0B3B8C] transition-all"
                            placeholder="****"
                            value={formData.pwd}
                            onChange={(e) => setFormData({ ...formData, pwd: e.target.value })}
                        />
                    </div>

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
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10">Área Solicitante</label>
                        <select
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-bold focus:outline-none focus:border-[#0B3B8C] transition-all appearance-none"
                            value={formData.area}
                            onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                        >
                            <option value="Administración">Administración</option>
                            <option value="Logística">Logística</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>

                    <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10">Autorizado por</label>
                        <select
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-bold focus:outline-none focus:border-[#0B3B8C] transition-all appearance-none"
                            value={formData.persona}
                            onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                        >
                            <option value="Hervin">Hervin</option>
                            <option value="Kimberly">Kimberly</option>
                            <option value="Joseph">Joseph</option>
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
