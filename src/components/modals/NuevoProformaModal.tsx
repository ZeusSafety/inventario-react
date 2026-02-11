'use client';

import React, { useState } from 'react';
import Modal from '../Modal';
import { useInventory, fmt12 } from '@/context/InventoryContext';
import { apiCall } from '@/lib/api';
import { Receipt, Plus, Trash2, Save } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function NuevoProformaModal({ isOpen, onClose }: Props) {
    const { state, loadProformas, showAlert } = useInventory();
    const [formData, setFormData] = useState({
        asesor: 'Hervin',
        almacen: 'Callao',
        registrado: 'Hervin App',
        num: '',
    });
    const [filas, setFilas] = useState<any[]>([]);
    const [nuevoItem, setNuevoItem] = useState({ producto: '', cantidad: '' });
    const [loading, setLoading] = useState(false);

    const handleAddFila = () => {
        if (!nuevoItem.producto || !nuevoItem.cantidad) return;
        setFilas([...filas, { ...nuevoItem, id: Date.now() }]);
        setNuevoItem({ producto: '', cantidad: '' });
    };

    const handleRemoveFila = (id: number) => {
        setFilas(filas.filter(f => f.id !== id));
    };

    const handleSave = async () => {
        if (!formData.num || filas.length === 0) {
            showAlert('Validación', 'Complete el número de proforma y agregue al menos un producto.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const data = {
                ...formData,
                fecha: fmt12(),
                filas: filas
            };

            const response = await apiCall('registrar_proforma', 'POST', data);

            if (response.success) {
                showAlert('¡Éxito!', 'Proforma registrada exitosamente.', 'success');
                await loadProformas();
                onClose();
            } else {
                showAlert('Error', response.message || 'Error al registrar proforma', 'error');
            }
        } catch (e) {
            console.error(e);
            showAlert('Error', 'Error de conexión con el servidor', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={<><Receipt className="w-5 h-5" /> Nueva Simulación de Proforma</>}
            size="lg"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                        <Save className="w-4 h-4 mr-2" />
                        {loading ? 'Guardando...' : 'Guardar Proforma'}
                    </button>
                </>
            }
        >
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-floating">
                        <select
                            className="form-select"
                            value={formData.asesor}
                            onChange={e => setFormData({ ...formData, asesor: e.target.value })}
                        >
                            <option value="Hervin">Hervin</option>
                            <option value="Kimberly">Kimberly</option>
                            <option value="Joseph">Joseph</option>
                        </select>
                        <label>Asesor Comercial</label>
                    </div>
                    <div className="form-floating">
                        <select
                            className="form-select"
                            value={formData.almacen}
                            onChange={e => setFormData({ ...formData, almacen: e.target.value })}
                        >
                            <option value="Callao">Callao</option>
                            <option value="Malvinas">Malvinas</option>
                        </select>
                        <label>Almacén de Salida</label>
                    </div>
                    <div className="form-floating">
                        <input
                            className="form-control"
                            placeholder="Nombre"
                            value={formData.registrado}
                            onChange={e => setFormData({ ...formData, registrado: e.target.value })}
                        />
                        <label>Registrado por</label>
                    </div>
                    <div className="form-floating">
                        <input
                            className="form-control"
                            placeholder="N° Proforma"
                            value={formData.num}
                            onChange={e => setFormData({ ...formData, num: e.target.value })}
                        />
                        <label>Número de Proforma</label>
                    </div>
                </div>

                <div className="border rounded-xl p-4 bg-gray-50/50">
                    <h6 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Agregar Productos
                    </h6>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-4">
                        <div className="md:col-span-8">
                            <input
                                list="productos-list"
                                className="form-control"
                                placeholder="Buscar producto..."
                                value={nuevoItem.producto}
                                onChange={e => setNuevoItem({ ...nuevoItem, producto: e.target.value })}
                            />
                            <datalist id="productos-list">
                                {state.productos.map((p, i) => (
                                    <option key={i} value={p.producto} />
                                ))}
                            </datalist>
                        </div>
                        <div className="md:col-span-3">
                            <input
                                type="number"
                                className="form-control"
                                placeholder="Cant."
                                value={nuevoItem.cantidad}
                                onChange={e => setNuevoItem({ ...nuevoItem, cantidad: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <button className="btn btn-primary w-full h-full p-0 flex items-center justify-center" onClick={handleAddFila}>
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="table-responsive rounded-lg border bg-white">
                        <table className="table table-sm mb-0">
                            <thead className="bg-[#002D5A] text-white">
                                <tr>
                                    <th className="px-3 py-2 text-[10px] uppercase">Producto</th>
                                    <th className="px-3 py-2 text-[10px] uppercase w-24">Cant.</th>
                                    <th className="px-3 py-2 text-[10px] uppercase w-16 text-center"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filas.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-4 text-xs text-gray-400 italic">No hay productos agregados</td>
                                    </tr>
                                ) : (
                                    filas.map((f) => (
                                        <tr key={f.id}>
                                            <td className="px-3 py-2 text-xs uppercase">{f.producto}</td>
                                            <td className="px-3 py-2 text-xs">{f.cantidad}</td>
                                            <td className="px-3 py-2 text-center">
                                                <button className="text-red-500 hover:text-red-700 p-1" onClick={() => handleRemoveFila(f.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
