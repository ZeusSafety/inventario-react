'use client';

import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { useInventory } from '@/context/InventoryContext';
import { apiCall, apiCallFormData } from '@/lib/api';
import { Receipt, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
                const proforma_id = response.proforma_id;
                
                // Generar PDF de la proforma
                try {
                    console.log('📄 Generando PDF para proforma:', proforma_id);
                    const doc = new jsPDF();
                    
                    // Encabezado
                    doc.setFontSize(16);
                    doc.text('PROFORMA', 14, 20);
                    
                    doc.setFontSize(10);
                    doc.text(`N° Proforma: ${data.numero_proforma}`, 14, 30);
                    doc.text(`Asesor: ${data.asesor}`, 14, 36);
                    doc.text(`Almacén: ${data.almacen.toUpperCase()}`, 14, 42);
                    doc.text(`Registrado por: ${data.registrado_por}`, 14, 48);
                    doc.text(`Fecha: ${new Date().toLocaleString('es-PE')}`, 14, 54);
                    
                    // Tabla de productos
                    const tableBody = productosSeleccionados.map((p, idx) => [
                        idx + 1,
                        p.producto,
                        p.codigo,
                        p.cantidad.toString(),
                        p.unidad_medida
                    ]);
                    
                    autoTable(doc, {
                        startY: 60,
                        head: [['#', 'Producto', 'Código', 'Cantidad', 'Unidad']],
                        body: tableBody,
                        theme: 'grid',
                        headStyles: { fillColor: [0, 45, 90] },
                    });
                    
                    // Convertir PDF a blob
                    const pdfBlob = doc.output('blob');
                    const pdfFile = new File([pdfBlob], `proforma_${data.numero_proforma}_${proforma_id}.pdf`, { type: 'application/pdf' });
                    
                    console.log('📤 Subiendo PDF al servidor...');
                    
                    // Subir PDF al servidor
                    const formData = new FormData();
                    formData.append('proforma_id', proforma_id.toString());
                    formData.append('pdf_file', pdfFile);
                    
                    const uploadResult = await apiCallFormData('subir_pdf_proforma', formData);
                    console.log('📥 Respuesta de subida de PDF:', uploadResult);
                    
                    if (uploadResult.success) {
                        console.log('✅ PDF subido correctamente:', uploadResult.archivo_pdf);
                    } else {
                        console.warn('⚠️ No se pudo subir el PDF:', uploadResult.message);
                    }
                } catch (pdfError) {
                    console.error('❌ Error generando/subiendo PDF:', pdfError);
                    // No bloquear el flujo si falla la generación del PDF
                }
                
                // Disparar evento inmediatamente para que otras páginas empiecen a recargar
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('proformaRegistrada', { 
                        detail: { almacen: data.almacen, inventario_id: data.inventario_id } 
                    }));
                }
                
                showAlert('¡Éxito!', response.message || 'Proforma registrada exitosamente.', 'success');
                
                // Esperar a que el PDF se haya guardado en la BD antes de recargar
                // Aumentamos el tiempo para dar más margen a la base de datos
                setTimeout(async () => {
                    console.log('🔄 Recargando proformas después de subir PDF...');
                    await loadProformas();
                    
                    // Cerrar modal después de recargar las proformas
                    setTimeout(() => {
                        onClose();
                    }, 200);
                }, 1500); // Aumentado a 1.5 segundos para dar tiempo a la BD
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
                    <button 
                        className="px-4 py-2 bg-[#002D5A] text-white rounded-full text-xs font-bold hover:bg-[#001F3D] transition-colors flex items-center gap-2 whitespace-nowrap" 
                        onClick={handleSave} 
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                <span>Guardar Proforma</span>
                            </>
                        )}
                    </button>
                </>
            }
        >
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Asesor Comercial</label>
                        <input
                            className="form-control"
                            placeholder="Ingrese asesor"
                            value={formData.asesor}
                            onChange={e => setFormData({ ...formData, asesor: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Almacén de Salida</label>
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
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Registrado por</label>
                        <input
                            className="form-control"
                            placeholder="Ingrese usuario"
                            value={formData.registrado_por}
                            onChange={e => setFormData({ ...formData, registrado_por: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Número de Proforma (Alfanumérico)</label>
                        <input
                            className="form-control"
                            placeholder="Ingrese N° de Proforma"
                            value={formData.numero_proforma}
                            onChange={e => setFormData({ ...formData, numero_proforma: e.target.value })}
                        />
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
                                    <input
                                        className="form-control"
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
                                        className="w-full h-full px-3 py-2 bg-[#002D5A] text-white rounded-full font-bold hover:bg-[#001F3D] transition-colors flex items-center justify-center disabled:bg-gray-400 disabled:cursor-not-allowed"
                                        onClick={agregarProducto}
                                        disabled={!productoSeleccionado || !cantidadProducto}
                                    >
                                        <Plus className="w-4 h-4" />
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

                            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Producto</th>
                                                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Código</th>
                                                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Cantidad</th>
                                                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Unidad</th>
                                                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {productosSeleccionados.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-4 text-xs text-gray-400 italic">
                                                        No hay productos agregados
                                                    </td>
                                                </tr>
                                            ) : (
                                                productosSeleccionados.map((p) => (
                                                    <tr key={p.id} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                                                        <td className="px-3 py-4 text-xs font-semibold">{p.producto}</td>
                                                        <td className="px-3 py-4 text-xs text-gray-600">{p.codigo}</td>
                                                        <td className="px-3 py-4 text-xs text-center font-bold">{p.cantidad}</td>
                                                        <td className="px-3 py-4 text-xs text-center">{p.unidad_medida}</td>
                                                        <td className="px-3 py-4 text-center">
                                                            <button
                                                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
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
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
}
