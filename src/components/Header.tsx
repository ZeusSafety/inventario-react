'use client';

import React, { useState, useEffect } from 'react';
import { useInventory, fmt12 } from '@/context/InventoryContext';
import { apiCall } from '@/lib/api';
import {
    ClipboardCheck,
    Link2,
    Menu
} from 'lucide-react';
import AsignarSesionModal from './modals/AsignarSesionModal';
import UnirseSesionModal from './modals/UnirseSesionModal';
import CerrarSesionModal from './modals/CerrarSesionModal';

interface HeaderProps {
    onToggleSidebar?: () => void;
    sidebarOpen?: boolean;
}

export default function Header({ onToggleSidebar, sidebarOpen = true }: HeaderProps) {
    const { state, updateSesionActual, showAlert, showConfirm } = useInventory();
    const [showAsignar, setShowAsignar] = useState(false);
    const [showUnirse, setShowUnirse] = useState(false);
    const [showCerrar, setShowCerrar] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const s = state.sesionActual;

    const handleCerrarConfirm = async (pwd: string) => {
        if (!s.numero) {
            showAlert('Error', 'No hay un número de inventario activo.', 'error');
            return;
        }

        try {
            console.log('🔒 Intentando cerrar inventario:', s.numero);
            setShowCerrar(false);

            const response = await apiCall('cerrar_inventario', 'POST', {
                numero_inventario: s.numero
            });

            console.log('📡 Respuesta del servidor:', response);

            const yaCerrado = !response.success && response.message?.includes('No hay inventario activo');

            if (response.success || yaCerrado) {
                updateSesionActual({
                    activo: false,
                    numero: null,
                    inventario_id: undefined,
                    inicio: null,
                    creadoPor: null
                });

                const msg = yaCerrado
                    ? 'El inventario ya estaba cerrado en el servidor. Sincronizando...'
                    : 'Inventario cerrado correctamente.';

                showAlert('¡Completado!', msg, 'success');

                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                console.error('❌ Error en respuesta:', response.message);
                showAlert('Error', response.message || 'Error al cerrar inventario en el servidor', 'error');
            }
        } catch (e) {
            console.error('❌ Error de conexión:', e);
            showAlert('Error de conexión', 'No se pudo conectar con el servidor para cerrar el inventario.', 'error');
        }
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
                                <div className={`sesion-banner-top flex items-center px-4 py-2 rounded-[12px] border shadow-md transition-all duration-300 ${s.metodo === 'asignado'
                                    ? 'bg-blue-50 border-blue-200'
                                    : 'bg-orange-50 border-orange-200'
                                    }`}>
                                    <span className={`text-[13px] font-semibold flex items-center gap-2 ${s.metodo === 'asignado' ? 'text-blue-900' : 'text-orange-900'
                                        }`}>
                                        <div className="flex flex-col md:flex-row md:items-center gap-x-3">
                                            <div className="flex items-center gap-2">
                                                <span className="opacity-70">Inventario:</span>
                                                <strong className={`font-black uppercase tracking-tight text-[15px] ${s.metodo === 'asignado' ? 'text-blue-700' : 'text-orange-700'
                                                    }`}>{s.numero}</strong>

                                                {/* ETIQUETA DISTINTIVA */}
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${s.metodo === 'asignado'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-orange-600 text-white'
                                                    }`}>
                                                    {s.metodo === 'asignado' ? 'ADMIN' : 'UNIDO'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[11px] opacity-80">
                                                <span className={s.metodo === 'asignado' ? 'text-blue-300' : 'text-orange-300'}>|</span>
                                                <span>Autoriza: {s.creadoPor?.split('•')[1] || s.creadoPor || '-'}</span>
                                                <span className={s.metodo === 'asignado' ? 'text-blue-300' : 'text-orange-300'}>|</span>
                                                <span>Inicio: {fmt12(currentTime)}</span>
                                            </div>
                                        </div>

                                        {s.activo ? (
                                            <button
                                                onClick={() => setShowCerrar(true)}
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
            <CerrarSesionModal
                isOpen={showCerrar}
                onClose={() => setShowCerrar(false)}
                onConfirm={handleCerrarConfirm}
            />
        </>
    );
}
