'use client';

import React, { useState } from 'react';
import { useInventory } from '@/context/InventoryContext';
import { apiCall } from '@/lib/api';
import {
    ClipboardCheck,
    Link2,
    Menu
} from 'lucide-react';
import AsignarSesionModal from './modals/AsignarSesionModal';
import UnirseSesionModal from './modals/UnirseSesionModal';

interface HeaderProps {
    onToggleSidebar?: () => void;
    sidebarOpen?: boolean;
}

export default function Header({ onToggleSidebar, sidebarOpen = true }: HeaderProps) {
    const { state, updateSesionActual, showAlert, showConfirm } = useInventory();
    const [showAsignar, setShowAsignar] = useState(false);
    const [showUnirse, setShowUnirse] = useState(false);

    const s = state.sesionActual;

    const cerrarSesionNumero = async () => {
        const pwd = prompt('Contraseña para cerrar inventario');
        if (pwd !== '0427') {
            showAlert('Acceso Denegado', 'Contraseña incorrecta para cerrar el inventario.', 'error');
            return;
        }

        if (!s.inventario_id) {
            showAlert('Error', 'No se encontró el ID del inventario actual.', 'error');
            return;
        }

        showConfirm(
            '¿Cerrar Inventario?',
            '¿Cerrar el inventario actual? No se podrán iniciar nuevos conteos con este número.',
            async () => {
                try {
                    const response = await apiCall(`finalizar_inventario&id=${s.inventario_id}`, 'POST');
                    if (response.success) {
                        updateSesionActual({ activo: false });
                        showAlert('¡Completado!', 'Inventario cerrado en el servidor.', 'success');
                    } else {
                        showAlert('Error', response.message || 'Error al cerrar inventario en el servidor', 'error');
                    }
                } catch (e) {
                    console.error(e);
                    showAlert('Error de conexión', 'No se pudo conectar con el servidor para cerrar el inventario.', 'error');
                }
            }
        );
    };

    const resetApp = () => {
        showConfirm(
            'Reiniciar Aplicación',
            'Esto borrará todos los datos locales y la sesión actual. ¿Deseas continuar?',
            () => {
                localStorage.clear();
                window.location.reload();
            }
        );
    };

    return (
        <>
            <header className="main-header sticky top-0 z-[1020] bg-white border-b border-gray-200 py-2.5 px-8 shadow-sm">
                <div className="flex items-center justify-between h-14">
                    {/* LEFT PART: Hamburger Menu + Session Banner */}
                    <div className="header-left flex items-center gap-3">
                        {/* Hamburger Menu Button */}
                        <button
                            onClick={onToggleSidebar}
                            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="Toggle sidebar"
                        >
                            <Menu className="w-5 h-5 text-gray-700" />
                        </button>
                        <button
                            onClick={onToggleSidebar}
                            className="hidden lg:flex p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="Toggle sidebar"
                        >
                            <Menu className="w-5 h-5 text-gray-700" />
                        </button>
                        <div id="sesion-banner-global" className="flex-shrink-0">
                            {s.numero ? (
                                <div className="sesion-banner-top flex items-center bg-[#e6eefb] px-4 py-2 rounded-[10px] border border-[#cfdbf5] shadow-sm animate-in fade-in slide-in-from-left-4 duration-300">
                                    <span className="text-[14px] text-[#072a63] font-medium flex items-center gap-2">
                                        <span>Inventario: <strong className="font-extrabold uppercase tracking-tight text-[#0B3B8C]">{s.numero}</strong></span>
                                        <span className="text-gray-400">|</span>
                                        <span className="hidden md:inline text-xs">Creado por: {s.creadoPor || '-'}</span>
                                        <span className="hidden lg:inline text-gray-400">|</span>
                                        <span className="hidden lg:inline text-xs">Inicio: {s.inicio || '-'}</span>

                                        {s.activo ? (
                                            <button
                                                onClick={cerrarSesionNumero}
                                                className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-1.5 px-3 flex items-center justify-center transition-all shadow-sm active:scale-95 ms-2"
                                                title="Inventario abierto (clic para cerrar)"
                                            >
                                                <i className="bi bi-unlock-fill"></i>
                                            </button>
                                        ) : (
                                            <button
                                                className="bg-red-600 text-white rounded-lg p-1.5 px-3 flex items-center justify-center opacity-75 ms-2"
                                                disabled
                                                title="Inventario cerrado"
                                            >
                                                <i className="bi bi-lock-fill"></i>
                                            </button>
                                        )}
                                    </span>
                                </div>
                            ) : (
                                <div className="hidden md:flex items-center text-xs text-gray-400 italic bg-gray-50 px-4 py-2 rounded-[10px] border border-dashed border-gray-200">
                                    Sin inventario activo
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PART: Actions */}
                    <div className="flex items-center gap-2">
                        {/* Productos Badge */}
                        <div className="bg-[#198754] px-4 py-1.5 rounded-full flex items-center shadow-sm">
                            <span className="text-xs font-bold text-white font-poppins">
                                Productos: {state.productos.length}
                            </span>
                        </div>

                        {/* Asignar N° Button */}
                        <button
                            onClick={() => setShowAsignar(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#0B3B8C] text-[#0B3B8C] rounded-full btn-oval hover:bg-blue-50 transition-all text-xs font-bold shadow-sm"
                        >
                            <ClipboardCheck className="w-4 h-4" />
                            <span>Asignar N°</span>
                        </button>

                        {/* Unirse N° Button */}
                        <button
                            onClick={() => setShowUnirse(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#198754] text-[#198754] rounded-full btn-oval hover:bg-green-50 transition-all text-xs font-bold shadow-sm"
                        >
                            <Link2 className="w-4 h-4" />
                            <span>Unirse N°</span>
                        </button>
                    </div>
                </div>
            </header>

            <AsignarSesionModal
                isOpen={showAsignar}
                onClose={() => setShowAsignar(false)}
            />
            <UnirseSesionModal
                isOpen={showUnirse}
                onClose={() => setShowUnirse(false)}
            />
        </>
    );
}
