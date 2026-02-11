'use client';

import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { useInventory, fmt12 } from '@/context/InventoryContext';
import { apiCall } from '@/lib/api';
import { Box, Columns, Save, Search, PlusCircle, Trash2 } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    tipo: 'cajas' | 'stand';
    almacen: 'Callao' | 'Malvinas';
}

export default function RegistroConteoModal({ isOpen, onClose, tipo, almacen }: Props) {
    const { state, setState, showAlert } = useInventory();
    const [loading, setLoading] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [productosFiltrados, setProductosFiltrados] = useState<any[]>([]);
    const [itemSeleccionado, setItemSeleccionado] = useState<any | null>(null);
    const [cantidad, setCantidad] = useState('');
    const [observacion, setObservacion] = useState('');

    useEffect(() => {
        if (busqueda.length > 1) {
            const filtered = state.productos.filter(p =>
                p.producto.toLowerCase().includes(busqueda.toLowerCase()) ||
                p.codigo.toLowerCase().includes(busqueda.toLowerCase())
            ).slice(0, 10);
            setProductosFiltrados(filtered);
        } else {
            setProductosFiltrados([]);
        }
    }, [busqueda, state.productos]);

    const handleSelectProduct = (p: any) => {
        setItemSeleccionado(p);
        setBusqueda(p.producto);
        setProductosFiltrados([]);
    };

    const handleSave = async () => {
        if (!state.sesionActual.activo) {
            showAlert('Inventario Inactivo', 'No hay un inventario abierto. Por favor, asigne un número de inventario primero.', 'warning');
            return;
        }
        if (!itemSeleccionado) {
            showAlert('Validación', 'Seleccione un producto para el conteo.', 'warning');
            return;
        }
        if (!cantidad || isNaN(Number(cantidad))) {
            showAlert('Validación', 'Ingrese una cantidad física válida.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const data = {
                inventario_id: state.sesionActual.inventario_id,
                detalle_id: itemSeleccionado.detalle_id,
                cantidad_fisica: Number(cantidad),
                observacion: observacion,
                fecha: fmt12(),
                tipo_conteo: tipo,
                almacen: almacen,
                registrado_por: state.sesionActual.creadoPor
            };

            const response = await apiCall('registrar_conteo', 'POST', data);

            if (response.success) {
                showAlert('¡Registrado!', 'Conteo registrado correctamente', 'success');
                // Refresh list
                const histResponse = await apiCall('obtener_historial', 'GET');
                if (histResponse.success && histResponse.inventarios) {
                    const filtered = histResponse.inventarios
                        .filter((inv: any) => inv.almacen === almacen || (almacen === 'Callao' && !inv.almacen))
                        .map((inv: any) => ({
                            id: inv.id,
                            numero: inv.numero_inventario,
                            registrado: inv.autorizado_por,
                            inicio: inv.fecha_inicio,
                            fin: inv.fecha_fin,
                            pdfUrl: inv.archivo_pdf,
                            tipo: 'cajas',
                            filas: []
                        }));
                    setState(prev => ({
                        ...prev,
                        sesiones: {
                            ...prev.sesiones,
                            [almacen.toLowerCase()]: filtered
                        }
                    }));
                }
                onClose();
                setBusqueda('');
                setItemSeleccionado(null);
                setCantidad('');
                setObservacion('');
            } else {
                showAlert('Error', response.message || 'Error al registrar conteo', 'error');
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
            title={
                <div className="flex items-center gap-2">
                    {tipo === 'cajas' ? <Box className="w-5 h-5" /> : <Columns className="w-5 h-5" />}
                    <span>Registro de Conteo - {tipo === 'cajas' ? 'Cajas' : 'Stand'} ({almacen})</span>
                </div>
            }
            size="md"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                        <Save className="w-4 h-4 mr-2" />
                        {loading ? 'Guardando...' : 'Guardar Conteo'}
                    </button>
                </>
            }
        >
            <div className="space-y-5">
                <div className="bg-[#0B3B8C]/5 p-3 rounded-xl border border-[#0B3B8C]/10 mb-4 flex items-center justify-between">
                    <p className="text-[11px] text-[#0B3B8C] font-semibold m-0">
                        INVENTARIO ACTIVO: <span className="bg-[#0B3B8C] text-white px-2 py-0.5 rounded ml-1">{state.sesionActual.numero || 'N/A'}</span>
                    </p>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{almacen}</span>
                </div>

                <div className="relative">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10">Buscar Producto</label>
                    <div className="relative">
                        <input
                            type="text"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-bold focus:outline-none focus:border-[#0B3B8C] transition-all pl-10"
                            placeholder="Nombre o código..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    </div>
                    {productosFiltrados.length > 0 && (
                        <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-200">
                            {productosFiltrados.map((p) => (
                                <button
                                    key={p.detalle_id}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 group"
                                    onClick={() => handleSelectProduct(p)}
                                >
                                    <div className="text-sm font-bold text-gray-900 group-hover:text-[#0B3B8C] transition-colors">{p.producto}</div>
                                    <div className="text-[10px] text-gray-400 flex justify-between mt-1">
                                        <span className="font-medium">CÓDIGO: <span className="text-gray-600">{p.codigo}</span></span>
                                        <span className="font-medium bg-gray-100 px-1.5 rounded">{p.unidad_medida}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {itemSeleccionado && (
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <h6 className="text-[11px] font-black text-[#0B3B8C] uppercase m-0 tracking-tight">{itemSeleccionado.producto}</h6>
                                <div className="flex gap-3">
                                    <p className="text-[10px] text-indigo-600 font-bold m-0 flex items-center gap-1">
                                        <Box className="w-3 h-3" /> SISTEMA: {itemSeleccionado.cantidad_sistema} {itemSeleccionado.unidad_medida}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-bold m-0 italic">Cód: {itemSeleccionado.codigo}</p>
                                </div>
                            </div>
                            <button className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-xl transition-all" onClick={() => setItemSeleccionado(null)}>
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10">Cantidad Física</label>
                        <input
                            type="number"
                            className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-[#0B3B8C] text-center text-xl font-black focus:outline-none focus:border-[#0B3B8C] transition-all"
                            placeholder="0"
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10">Observación</label>
                        <textarea
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 font-medium focus:outline-none focus:border-[#0B3B8C] transition-all min-h-[60px] resize-none"
                            placeholder="Notas opcionales..."
                            value={observacion}
                            onChange={(e) => setObservacion(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
