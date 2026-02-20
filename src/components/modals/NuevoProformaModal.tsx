'use client';

import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { useInventory } from '@/context/InventoryContext';
import { apiCall } from '@/lib/api';
import { Receipt, Plus, Trash2, Save, Search, Loader2 } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface ProductoDisponible {
    item: number;
    producto: string;
    codigo: string;
    stock_fisico: number;
    unidad_medida: string;
}

interface ProductoSeleccionado {
    id: string;
    codigo: string;
    producto: string;
    cantidad: number;
    unidad_medida: string;
    stock_fisico: number;
}

export default function NuevoProformaModal({ isOpen, onClose }: Props) {
    const { state, loadProformas, showAlert } = useInventory();
    const [formData, setFormData] = useState({
        asesor: '',
        almacen: 'callao',
        registrado_por: '',
        numero_proforma: '',
    });
    const [productosSeleccionados, setProductosSeleccionados] = useState<ProductoSeleccionado[]>([]);
    const [productosDisponibles, setProductosDisponibles] = useState<ProductoDisponible[]>([]);
    const [busquedaProducto, setBusquedaProducto] = useState('');
    const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoDisponible | null>(null);
    const [cantidadProducto, setCantidadProducto] = useState('');
    const [loading, setLoading] = useState(false);
    const [cargandoProductos, setCargandoProductos] = useState(false);

    // Cargar productos disponibles cuando cambia el almacén
    useEffect(() => {
        if (isOpen && formData.almacen && state.sesionActual?.inventario_id) {
            cargarProductosDisponibles();
        }
    }, [formData.almacen, isOpen, state.sesionActual?.inventario_id]);

    // Resetear formulario al cerrar
    useEffect(() => {
        if (!isOpen) {
            setFormData({
                asesor: '',
                almacen: 'callao',
                registrado_por: '',
                numero_proforma: '',
            });
            setProductosSeleccionados([]);
            setBusquedaProducto('');
            setProductoSeleccionado(null);
            setCantidadProducto('');
        }
    }, [isOpen]);

    const cargarProductosDisponibles = async () => {
        if (!state.sesionActual?.inventario_id) {
            showAlert('Error', 'No hay inventario activo', 'error');
            return;
        }

        setCargandoProductos(true);
        try {
            // Usar Promise.race para timeout después de 10 segundos
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );
            
            const apiPromise = apiCall(`obtener_productos_proforma&inventario_id=${state.sesionActual.inventario_id}&almacen=${formData.almacen}`, 'GET');
            
            const response = await Promise.race([apiPromise, timeoutPromise]) as any;
            
            if (response.success && response.productos) {
                setProductosDisponibles(response.productos);
            } else {
                showAlert('Error', response.message || 'Error al cargar productos', 'error');
                setProductosDisponibles([]);
            }
        } catch (e: any) {
            console.error(e);
            if (e.message === 'Timeout') {
                showAlert('Error', 'La carga de productos está tardando demasiado. Por favor, intente nuevamente.', 'error');
            } else {
                showAlert('Error', 'Error de conexión con el servidor', 'error');
            }
            setProductosDisponibles([]);
        } finally {
            setCargandoProductos(false);
        }
    };

    const agregarProducto = () => {
        if (!productoSeleccionado || !cantidadProducto) {
            showAlert('Validación', 'Seleccione un producto e ingrese la cantidad', 'warning');
            return;
        }

        const cantidad = parseFloat(cantidadProducto);
        if (isNaN(cantidad) || cantidad <= 0) {
            showAlert('Validación', 'La cantidad debe ser mayor a 0', 'warning');
            return;
        }

        if (cantidad > productoSeleccionado.stock_fisico) {
            showAlert('Validación', `La cantidad no puede ser mayor al stock disponible (${productoSeleccionado.stock_fisico})`, 'warning');
            return;
        }

        // Verificar si el producto ya está agregado
        const yaExiste = productosSeleccionados.find(p => p.codigo === productoSeleccionado.codigo);
        if (yaExiste) {
            showAlert('Validación', 'Este producto ya está agregado a la proforma', 'warning');
            return;
        }

        const nuevoProducto: ProductoSeleccionado = {
            id: Date.now().toString(),
            codigo: productoSeleccionado.codigo,
            producto: productoSeleccionado.producto,
            cantidad: cantidad,
            unidad_medida: productoSeleccionado.unidad_medida,
            stock_fisico: productoSeleccionado.stock_fisico
        };

        setProductosSeleccionados([...productosSeleccionados, nuevoProducto]);
        setProductoSeleccionado(null);
        setCantidadProducto('');
        setBusquedaProducto('');
    };

    const eliminarProducto = (id: string) => {
        setProductosSeleccionados(productosSeleccionados.filter(p => p.id !== id));
    };

    const handleSave = async () => {
        // Validaciones
        if (!formData.numero_proforma.trim()) {
            showAlert('Validación', 'Ingrese el número de proforma', 'warning');
            return;
        }

        if (!formData.asesor.trim()) {
            showAlert('Validación', 'Ingrese el nombre del asesor', 'warning');
            return;
        }

        if (!formData.registrado_por.trim()) {
            showAlert('Validación', 'Ingrese quién registra la proforma', 'warning');
            return;
        }

        if (productosSeleccionados.length === 0) {
            showAlert('Validación', 'Agregue al menos un producto a la proforma', 'warning');
            return;
        }

        if (!state.sesionActual?.inventario_id) {
            showAlert('Error', 'No hay inventario activo', 'error');
            return;
        }

        setLoading(true);
        try {
            // Preparar productos en el formato que espera el backend
            const productos = productosSeleccionados.map(p => ({
                codigo: p.codigo,
                cantidad: p.cantidad,
                unidad_medida: p.unidad_medida
            }));

            const data = {
                inventario_id: state.sesionActual.inventario_id,
                numero_proforma: formData.numero_proforma.trim(),
                asesor: formData.asesor.trim(),
                almacen: formData.almacen,
                registrado_por: formData.registrado_por.trim(),
                productos: productos
            };

            const response = await apiCall('registrar_proforma', 'POST', data);

            if (response.success) {
                // Disparar evento inmediatamente para que otras páginas empiecen a recargar
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('proformaRegistrada', { 
                        detail: { almacen: data.almacen, inventario_id: data.inventario_id } 
                    }));
                }
                
                showAlert('¡Éxito!', response.message || 'Proforma registrada exitosamente.', 'success');
                
                // Cargar proformas en segundo plano sin bloquear
                loadProformas().catch(err => console.error('Error al cargar proformas:', err));
                
                // Cerrar modal después de un breve delay para que el usuario vea el mensaje
                setTimeout(() => {
                    onClose();
                }, 300);
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

    // Filtrar productos según búsqueda
    const productosFiltrados = productosDisponibles.filter(p =>
        p.producto.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={<><Receipt className="w-5 h-5" /> Nueva Proforma</>}
            size="2xl"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Guardar Proforma
                            </>
                        )}
                    </button>
                </>
            }
        >
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-floating">
                        <input
                            className="form-control"
                            placeholder="Asesor"
                            value={formData.asesor}
                            onChange={e => setFormData({ ...formData, asesor: e.target.value })}
                        />
                        <label>Asesor Comercial *</label>
                    </div>
                    <div className="form-floating">
                        <select
                            className="form-select"
                            value={formData.almacen}
                            onChange={e => {
                                setFormData({ ...formData, almacen: e.target.value });
                                setProductosSeleccionados([]);
                            }}
                        >
                            <option value="callao">Almacén Callao</option>
                            <option value="malvinas">Almacén Malvinas</option>
                        </select>
                        <label>Almacén de Salida *</label>
                    </div>
                    <div className="form-floating">
                        <input
                            className="form-control"
                            placeholder="Registrado por"
                            value={formData.registrado_por}
                            onChange={e => setFormData({ ...formData, registrado_por: e.target.value })}
                        />
                        <label>Registrado por *</label>
                    </div>
                    <div className="form-floating">
                        <input
                            className="form-control"
                            placeholder="N° Proforma"
                            value={formData.numero_proforma}
                            onChange={e => setFormData({ ...formData, numero_proforma: e.target.value })}
                        />
                        <label>Número de Proforma (Alfanumérico) *</label>
                    </div>
                </div>

                <div className="border rounded-xl p-4 bg-gray-50/50">
                    <h6 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Agregar Productos
                    </h6>

                    {cargandoProductos ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            <span className="ml-2 text-sm text-gray-600">Cargando productos disponibles...</span>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-4">
                                <div className="md:col-span-7 relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        className="form-control pl-10"
                                        placeholder="Buscar producto por nombre o código..."
                                        value={busquedaProducto}
                                        onChange={e => {
                                            const valor = e.target.value;
                                            setBusquedaProducto(valor);
                                            
                                            // Si el valor coincide exactamente con un producto, seleccionarlo
                                            const productoEncontrado = productosFiltrados.find(p => 
                                                `${p.producto} - ${p.codigo}` === valor ||
                                                p.producto === valor ||
                                                p.codigo === valor
                                            );
                                            
                                            if (productoEncontrado) {
                                                setProductoSeleccionado(productoEncontrado);
                                            } else {
                                                setProductoSeleccionado(null);
                                            }
                                        }}
                                        onBlur={() => {
                                            // Pequeño delay para permitir que el click en el dropdown funcione
                                            setTimeout(() => {
                                                if (!productoSeleccionado && busquedaProducto) {
                                                    const productoEncontrado = productosFiltrados.find(p => 
                                                        `${p.producto} - ${p.codigo}` === busquedaProducto ||
                                                        p.producto === busquedaProducto ||
                                                        p.codigo === busquedaProducto
                                                    );
                                                    if (productoEncontrado) {
                                                        setProductoSeleccionado(productoEncontrado);
                                                        setBusquedaProducto(`${productoEncontrado.producto} - ${productoEncontrado.codigo}`);
                                                    }
                                                }
                                            }, 200);
                                        }}
                                    />
                                    {busquedaProducto && productosFiltrados.length > 0 && !productoSeleccionado && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                            {productosFiltrados.slice(0, 10).map((p) => (
                                                <div
                                                    key={p.codigo}
                                                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                    onClick={() => {
                                                        setProductoSeleccionado(p);
                                                        setBusquedaProducto(`${p.producto} - ${p.codigo}`);
                                                    }}
                                                >
                                                    <div className="font-semibold text-sm">{p.producto}</div>
                                                    <div className="text-xs text-gray-600">
                                                        Código: {p.codigo} | Stock: {p.stock_fisico} {p.unidad_medida}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="md:col-span-3">
                                    <input
                                        type="number"
                                        className="form-control"
                                        placeholder="Cantidad"
                                        value={cantidadProducto}
                                        onChange={e => setCantidadProducto(e.target.value)}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <button
                                        className="btn btn-primary w-full h-full p-0 flex items-center justify-center"
                                        onClick={agregarProducto}
                                        disabled={!productoSeleccionado || !cantidadProducto}
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {productoSeleccionado && (
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-sm font-semibold text-blue-900">
                                        Producto seleccionado: {productoSeleccionado.producto}
                                    </p>
                                    <p className="text-xs text-blue-700">
                                        Código: {productoSeleccionado.codigo} | Stock disponible: {productoSeleccionado.stock_fisico} {productoSeleccionado.unidad_medida}
                                    </p>
                                </div>
                            )}

                            <div className="table-responsive rounded-lg border bg-white">
                                <table className="table table-sm mb-0">
                                    <thead className="bg-[#002D5A] text-white">
                                        <tr>
                                            <th className="px-3 py-2 text-[10px] uppercase">Producto</th>
                                            <th className="px-3 py-2 text-[10px] uppercase">Código</th>
                                            <th className="px-3 py-2 text-[10px] uppercase w-24 text-center">Cantidad</th>
                                            <th className="px-3 py-2 text-[10px] uppercase w-20 text-center">Unidad</th>
                                            <th className="px-3 py-2 text-[10px] uppercase w-16 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productosSeleccionados.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-4 text-xs text-gray-400 italic">
                                                    No hay productos agregados
                                                </td>
                                            </tr>
                                        ) : (
                                            productosSeleccionados.map((p) => (
                                                <tr key={p.id}>
                                                    <td className="px-3 py-2 text-xs font-semibold">{p.producto}</td>
                                                    <td className="px-3 py-2 text-xs">{p.codigo}</td>
                                                    <td className="px-3 py-2 text-xs text-center font-bold">{p.cantidad}</td>
                                                    <td className="px-3 py-2 text-xs text-center">{p.unidad_medida}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <button
                                                            className="text-red-500 hover:text-red-700 p-1"
                                                            onClick={() => eliminarProducto(p.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
}
