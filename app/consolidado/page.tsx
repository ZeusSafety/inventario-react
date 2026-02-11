'use client';

import React from 'react';
import { useInventory } from '@/context/InventoryContext';
import { BarChart3 } from 'lucide-react';

export default function ConsolidadoPage() {
    useInventory();

    return (
        <div id="view-consolidado" className="animate-in fade-in duration-500 font-poppins">
            <div className="container mx-auto">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 transition-all">
                    <header className="flex justify-between items-start flex-wrap gap-4 mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-[#002D5A] to-[#002D5A] rounded-xl flex items-center justify-center text-white shadow-sm transition-all duration-200">
                                <BarChart3 className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 m-0" style={{ fontFamily: 'var(--font-poppins)', fontSize: '22px' }}>
                                    Consolidado de Inventarios
                                </h1>
                                <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    Resumen técnico y consolidado de productos en todos los almacenes registrados
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                        {/* Almacén Callao */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                            <div className="bg-[#002D5A] text-white p-4 text-center font-bold tracking-wide uppercase text-sm">
                                Inventario Callao
                            </div>
                            <div className="p-0 flex-grow">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-[4px]" style={{ backgroundColor: '#002D5A', borderColor: '#F4B400' }}>
                                            <th className="px-3 py-2 text-left font-bold text-white text-[10px] uppercase">Item</th>
                                            <th className="px-3 py-2 text-left font-bold text-white text-[10px] uppercase">Producto</th>
                                            <th className="px-3 py-2 text-left font-bold text-white text-[10px] uppercase">Sistema</th>
                                            <th className="px-3 py-2 text-left font-bold text-white text-[10px] uppercase">Físico</th>
                                            <th className="px-3 py-2 text-left font-bold text-white text-[10px] uppercase">Diferencia</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr>
                                            <td colSpan={5} className="px-3 py-8 text-center text-gray-400 font-medium">Sin datos</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Almacén Malvinas */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                            <div className="bg-[#F4B400] text-[#001F3D] p-4 text-center font-bold tracking-wide uppercase text-sm">
                                Inventario Malvinas
                            </div>
                            <div className="p-0 flex-grow">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-[4px]" style={{ backgroundColor: '#F4B400', borderColor: '#002D5A' }}>
                                            <th className="px-3 py-2 text-left font-bold text-[#002D5A] text-[10px] uppercase">Producto</th>
                                            <th className="px-3 py-2 text-left font-bold text-[#002D5A] text-[10px] uppercase">Sistema</th>
                                            <th className="px-3 py-2 text-left font-bold text-[#002D5A] text-[10px] uppercase">Físico</th>
                                            <th className="px-3 py-2 text-left font-bold text-[#002D5A] text-[10px] uppercase">Diferencia</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr>
                                            <td colSpan={4} className="px-3 py-8 text-center text-gray-400 font-medium">Sin datos</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Conteo General */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                            <div className="bg-[#198754] text-white p-4 text-center font-bold tracking-wide uppercase text-sm">
                                Conteo General
                            </div>
                            <div className="p-0 flex-grow">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-[4px]" style={{ backgroundColor: '#198754', borderColor: '#F4B400' }}>
                                            <th className="px-3 py-2 text-center font-bold text-white text-[10px] uppercase">Total Sistema</th>
                                            <th className="px-3 py-2 text-center font-bold text-white text-[10px] uppercase">Total Físico</th>
                                            <th className="px-3 py-2 text-center font-bold text-white text-[10px] uppercase">Diferencia</th>
                                            <th className="px-3 py-2 text-center font-bold text-white text-[10px] uppercase">Resultado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr>
                                            <td colSpan={4} className="px-3 py-12 text-center text-gray-400 font-medium">Sin datos</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
