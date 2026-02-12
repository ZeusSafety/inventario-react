'use client';

import React, { useState } from 'react';
import Modal from '../Modal';
import { useInventory } from '@/context/InventoryContext';
import { Lock } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string) => void;
}

export default function CerrarSesionModal({ isOpen, onClose, onConfirm }: Props) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    const handleConfirm = () => {
        if (password === '0427') {
            onConfirm(password);
            setPassword('');
            setError(false);
        } else {
            setError(true);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={<><Lock className="w-5 h-5 text-red-500" /> Cerrar Inventario</>}
            size="sm"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-2 font-bold" onClick={handleConfirm}>
                        Cerrar Inventario
                    </button>
                </>
            }
        >
            <div className="space-y-6 pt-2">
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-4">
                    <p className="text-[12px] text-red-700 font-medium m-0 leading-tight">
                        Esta acción cerrará el inventario actual para todos los usuarios. Ingrese la contraseña de autorización.
                    </p>
                </div>

                <div className="relative">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 absolute -top-2 left-3 bg-white px-1 z-10">Contraseña de Cierre</label>
                    <input
                        type="password"
                        autoFocus
                        className={`w-full px-4 py-4 bg-gray-50 border ${error ? 'border-red-500' : 'border-gray-200'} rounded-2xl text-center text-2xl tracking-[1em] font-black focus:outline-none focus:border-red-600 transition-all`}
                        placeholder="****"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setError(false);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirm();
                        }}
                    />
                    {error && (
                        <p className="text-[10px] text-red-500 font-bold mt-2 text-center animate-bounce">
                            ¡Contraseña incorrecta!
                        </p>
                    )}
                </div>
            </div>
        </Modal>
    );
}
