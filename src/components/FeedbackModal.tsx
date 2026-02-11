'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    message: string;
    type?: 'success' | 'warning' | 'error' | 'confirm';
}

export default function FeedbackModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'success'
}: FeedbackModalProps) {
    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle2 className="w-12 h-12 text-green-500" />;
            case 'warning':
                return <AlertTriangle className="w-12 h-12 text-amber-500" />;
            case 'error':
                return <XCircle className="w-12 h-12 text-red-500" />;
            case 'confirm':
                return <HelpCircle className="w-12 h-12 text-blue-500" />;
            default:
                return null;
        }
    };

    const getColors = () => {
        switch (type) {
            case 'success': return 'border-green-100 bg-green-50';
            case 'warning': return 'border-amber-100 bg-amber-50';
            case 'error': return 'border-red-100 bg-red-50';
            case 'confirm': return 'border-blue-100 bg-blue-50';
            default: return 'border-gray-100 bg-gray-50';
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100"
                        >
                            <div className={`p-8 flex flex-col items-center text-center ${getColors()} border-b`}>
                                <div className="mb-4 animate-in zoom-in-50 duration-500">
                                    {getIcon()}
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">
                                    {title}
                                </h3>
                                <p className="text-sm font-medium text-gray-600 leading-relaxed">
                                    {message}
                                </p>
                            </div>

                            <div className="p-4 bg-white flex gap-3">
                                {type === 'confirm' ? (
                                    <>
                                        <button
                                            onClick={onClose}
                                            className="flex-1 py-3 px-4 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-all uppercase text-xs tracking-wider"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={() => {
                                                onConfirm?.();
                                                onClose();
                                            }}
                                            className="flex-1 py-3 px-4 rounded-2xl bg-[#0B3B8C] text-white font-bold hover:bg-[#002D5A] transition-all shadow-lg shadow-blue-200 uppercase text-xs tracking-wider"
                                        >
                                            Confirmar
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 px-4 rounded-2xl bg-[#0B3B8C] text-white font-bold hover:bg-[#002D5A] transition-all shadow-lg shadow-blue-200 uppercase text-xs tracking-wider"
                                    >
                                        Entendido
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
