'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
    Building2,
    Store,
    ArrowLeftRight,
    LayoutGrid,
    Archive,
    FileText
} from 'lucide-react';

export default function Sidebar({ isOpen = true, onClose }: { isOpen?: boolean; onClose?: () => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const navItems = [
        { id: 'callao', label: 'Almacén Callao', href: '/callao', icon: 'building' },
        { id: 'malvinas', label: 'Almacén Malvinas', href: '/malvinas', icon: 'store' },
        { id: 'comparar', label: 'Comparar', href: '/comparar', icon: 'arrow' },
        { id: 'consolidado', label: 'Consolidado', href: '/consolidado', icon: 'grid' },
        { id: 'proformas', label: 'Proformas', href: '/proformas', icon: 'file' },
        { id: 'registro', label: 'Registro', href: '/registro', icon: 'archive' },
    ];

    const getIcon = (iconName: string) => {
        const icons: { [key: string]: React.ReactNode } = {
            building: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
            store: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
            ),
            arrow: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
            ),
            grid: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
            ),
            archive: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
            ),
            file: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        };
        return icons[iconName] || icons.building;
    };

    const handleItemClick = (itemId: string, href: string) => {
        setSelectedItem(itemId);
        router.push(href);
        // No cerrar el sidebar al hacer clic en un item
    };

    return (
        <>
            {/* Overlay para móvil */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed inset-y-0 left-0 z-[1030]
          w-60 bg-white
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
                style={{ boxShadow: '2px 0 8px 0 rgba(0, 0, 0, 0.08), 1px 0 2px 0 rgba(0, 0, 0, 0.04)' }}
            >
                {/* Logo - Clickable to menu */}
                <button
                    onClick={() => router.push("/")}
                    className="pt-2 pb-2 px-4 border-b border-gray-200 flex justify-center w-full bg-white hover:bg-white active:bg-white transition-colors duration-200"
                    aria-label="Ir al menú"
                >
                    <div className="relative w-32 h-32">
                        <img
                            src="/imagenes/zeus.logooo.png"
                            alt="Zeus Safety Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                </button>

                {/* Navigation */}
                <nav className={`flex-1 flex flex-col overflow-hidden`}>
                    <div className="px-4 pt-3 pb-1 flex-shrink-0 bg-white">
                        <h3 className="font-bold text-gray-800 uppercase tracking-widest" style={{ fontFamily: 'var(--font-poppins)', fontSize: '12px' }}>
                            INVENTARIO
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
                        <ul className="space-y-1 px-2">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href || selectedItem === item.id;
                                return (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => handleItemClick(item.id, item.href)}
                                            className={`w-full flex items-center justify-between px-2.5 py-2 transition-all duration-200 group hover:shadow-md active:scale-[0.98] ${isActive
                                                ? "bg-[#E9F1FF] text-[#001F3D] border-l-4 border-[#002D5A] shadow-sm"
                                                : "text-gray-700 hover:bg-[#E9F1FF] hover:text-[#001F3D] border-l-4 border-transparent"
                                                }`}
                                            style={{ borderRadius: '10px' }}
                                        >
                                            <div className="flex items-center space-x-2">
                                                <span className={`transition-colors flex-shrink-0 ${isActive
                                                    ? "text-[#002D5A]"
                                                    : "text-gray-600 group-hover:text-[#002D5A]"
                                                    }`}>
                                                    {getIcon(item.icon)}
                                                </span>
                                                <span className={`text-xs text-left leading-tight ${isActive
                                                    ? "text-[#001F3D] font-medium"
                                                    : "text-gray-800 group-hover:text-[#001F3D] font-medium"
                                                    }`} style={{ fontFamily: 'var(--font-poppins)' }}>
                                                    {item.label}
                                                </span>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </nav>
            </aside>
        </>
    );
}
