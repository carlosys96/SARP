import React, { useState, useEffect, useRef, useId } from 'react';
import { ClockIcon } from '../icons/Icons';

interface Time24InputProps {
    value: string; // Esperado en formato "HH:mm" (24h)
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
    id?: string;
}

// Horarios frecuentes de turnos en planta / cuadrillas industriales (24h con referencia)
const QUICK_PRESETS = [
    { time: '07:00', label: '07:00' },
    { time: '07:30', label: '07:30' },
    { time: '08:00', label: '08:00' },
    { time: '08:30', label: '08:30' },
    { time: '12:00', label: '12:00' },
    { time: '13:00', label: '13:00' },
    { time: '14:00', label: '14:00 (2p)' },
    { time: '15:00', label: '15:00 (3p)' },
    { time: '16:30', label: '16:30' },
    { time: '17:00', label: '17:00 (5p)' },
    { time: '17:30', label: '17:30' },
    { time: '18:00', label: '18:00 (6p)' },
    { time: '19:00', label: '19:00' },
    { time: '20:00', label: '20:00 (8p)' },
    { time: '21:00', label: '21:00' },
    { time: '22:00', label: '22:00' }
];

// Opciones de horas 00 a 23
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

// Opciones de minutos (intervalos comunes de 5 y 15 min)
const MINUTES_STEPS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

/**
 * Normaliza y valida una cadena a formato estricto "HH:mm" en 24 horas (00:00 a 23:59)
 */
export const normalizeTime24 = (raw: string, fallback: string = '08:00'): string => {
    if (!raw) return fallback;
    const cleaned = raw.trim().replace(/[^0-9:]/g, '');

    // Si tiene dos puntos (ej: "8:00", "14:30", "07:5")
    if (cleaned.includes(':')) {
        const parts = cleaned.split(':');
        let h = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        if (isNaN(h)) h = 0;
        if (isNaN(m)) m = 0;
        h = Math.max(0, Math.min(23, h));
        m = Math.max(0, Math.min(59, m));
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // Si es solo dígitos (ej: "8" -> "08:00", "14" -> "14:00", "730" -> "07:30", "1730" -> "17:30")
    if (/^\d{1,4}$/.test(cleaned)) {
        if (cleaned.length <= 2) {
            let h = parseInt(cleaned, 10);
            if (isNaN(h)) h = 0;
            h = Math.max(0, Math.min(23, h));
            return `${String(h).padStart(2, '0')}:00`;
        }
        if (cleaned.length === 3) {
            let h = parseInt(cleaned.slice(0, 1), 10);
            let m = parseInt(cleaned.slice(1), 10);
            h = Math.max(0, Math.min(23, h));
            m = Math.max(0, Math.min(59, m));
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
        if (cleaned.length === 4) {
            let h = parseInt(cleaned.slice(0, 2), 10);
            let m = parseInt(cleaned.slice(2), 10);
            h = Math.max(0, Math.min(23, h));
            m = Math.max(0, Math.min(59, m));
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
    }

    return fallback;
};

export const Time24Input: React.FC<Time24InputProps> = ({
    value,
    onChange,
    disabled = false,
    className = '',
    ariaLabel = 'Hora (formato 24h)',
    id
}) => {
    const internalId = useId();
    const inputId = id || internalId;
    const [displayVal, setDisplayVal] = useState<string>(value || '08:00');
    const [isFocused, setIsFocused] = useState<boolean>(false);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sincronizar cuando cambia el prop value externo
    useEffect(() => {
        if (!isFocused) {
            setDisplayVal(value || '08:00');
        }
    }, [value, isFocused]);

    // Cerrar popover al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const commitValue = (valToCommit: string) => {
        const formatted = normalizeTime24(valToCommit, value || '08:00');
        setDisplayVal(formatted);
        if (formatted !== value) {
            onChange(formatted);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value;
        // Solo permitir números y dos puntos
        const sanitized = text.replace(/[^0-9:]/g, '');
        if (sanitized.length > 5) return;
        
        setDisplayVal(sanitized);

        // Si el usuario escribió 4 dígitos continuos como "0830", autoformatear al vuelo a "08:30"
        if (/^\d{4}$/.test(sanitized)) {
            const formatted = `${sanitized.slice(0, 2)}:${sanitized.slice(2)}`;
            const normalized = normalizeTime24(formatted, value);
            setDisplayVal(normalized);
            onChange(normalized);
        } else if (/^\d{2}:\d{2}$/.test(sanitized)) {
            const normalized = normalizeTime24(sanitized, value);
            onChange(normalized);
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        commitValue(displayVal);
    };

    const handleFocus = () => {
        if (disabled) return;
        setIsFocused(true);
    };

    const adjustMinutes = (deltaMinutes: number) => {
        const current = normalizeTime24(displayVal, value || '08:00');
        const [hStr, mStr] = current.split(':');
        let total = (parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + deltaMinutes) % 1440;
        if (total < 0) total += 1440;
        const newH = Math.floor(total / 60);
        const newM = total % 60;
        const formatted = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
        setDisplayVal(formatted);
        onChange(formatted);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitValue(displayVal);
            setIsOpen(false);
            inputRef.current?.blur();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            adjustMinutes(15);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            adjustMinutes(-15);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleSelectPreset = (preset: string) => {
        setDisplayVal(preset);
        onChange(preset);
        setIsOpen(false);
    };

    const handleSelectHour = (hour: string) => {
        const currentM = (value && value.includes(':')) ? value.split(':')[1] : '00';
        const formatted = `${hour}:${currentM}`;
        setDisplayVal(formatted);
        onChange(formatted);
    };

    const handleSelectMinute = (minute: string) => {
        const currentH = (value && value.includes(':')) ? value.split(':')[0] : '08';
        const formatted = `${currentH}:${minute}`;
        setDisplayVal(formatted);
        onChange(formatted);
        setIsOpen(false);
    };

    const currentParts = (value || '08:00').split(':');
    const selectedHour = currentParts[0] || '08';
    const selectedMinute = currentParts[1] || '00';

    return (
        <div ref={containerRef} className="relative inline-flex items-center">
            {/* Contenedor del Input */}
            <div 
                className={`flex items-center border rounded bg-surface transition-all ${
                    disabled 
                        ? 'opacity-60 cursor-not-allowed bg-surface2 border-line text-ink3' 
                        : isFocused 
                            ? 'border-brand ring-2 ring-brand/20 text-ink' 
                            : 'border-line hover:border-slate-400 text-ink'
                } ${className}`}
            >
                <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    value={displayVal}
                    disabled={disabled}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder="00:00"
                    maxLength={5}
                    aria-label={ariaLabel}
                    title="Hora en formato 24h (HH:mm, ej. 08:00, 14:30, 17:30)"
                    className="w-[52px] sm:w-[58px] text-xs font-mono font-semibold py-1 pl-2 pr-0.5 bg-transparent border-0 text-center tabular-nums focus:outline-none disabled:cursor-not-allowed"
                />

                {/* Botón selector con reloj (24h) */}
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        if (disabled) return;
                        setIsOpen(prev => !prev);
                    }}
                    title="Abrir selector de hora 24h"
                    aria-label="Abrir selector de hora 24h"
                    className="p-1 text-ink3 hover:text-ink disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand rounded-r"
                >
                    <ClockIcon size={3.5} />
                </button>
            </div>

            {/* Popover / Desplegable de selección 24 Horas */}
            {isOpen && !disabled && (
                <div 
                    role="dialog"
                    aria-label="Selector de horas 24h"
                    className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-[260px] animate-fadeIn text-ink"
                    style={{ minWidth: '240px' }}
                >
                    {/* Encabezado del Popover */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                        <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-sarp-dark-blue flex items-center gap-1">
                            <ClockIcon size={3} />
                            <span>Formato 24 Horas</span>
                        </span>
                        <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-sarp-blue tabular-nums">
                            {selectedHour}:{selectedMinute}
                        </span>
                    </div>

                    {/* Atajos de horas frecuentes de turnos */}
                    <div className="mb-3">
                        <span className="block text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            Turnos comunes (24h):
                        </span>
                        <div className="grid grid-cols-4 gap-1">
                            {QUICK_PRESETS.slice(0, 8).map(preset => (
                                <button
                                    key={preset.time}
                                    type="button"
                                    onClick={() => handleSelectPreset(preset.time)}
                                    className={`py-1 text-[0.6875rem] font-mono rounded font-medium border text-center transition-colors ${
                                        value === preset.time
                                            ? 'bg-sarp-dark-blue text-white border-sarp-dark-blue'
                                            : 'bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border-gray-200 text-gray-700'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-4 gap-1 mt-1">
                            {QUICK_PRESETS.slice(8).map(preset => (
                                <button
                                    key={preset.time}
                                    type="button"
                                    onClick={() => handleSelectPreset(preset.time)}
                                    className={`py-1 text-[0.6875rem] font-mono rounded font-medium border text-center transition-colors ${
                                        value === preset.time
                                            ? 'bg-sarp-dark-blue text-white border-sarp-dark-blue'
                                            : 'bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border-gray-200 text-gray-700'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Columnas de selección individual: Hora (00-23) y Minutos (00-55) */}
                    <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-2">
                        {/* Columna Horas 24h */}
                        <div>
                            <span className="block text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider mb-1 text-center">
                                Hora (00-23)
                            </span>
                            <div className="max-h-36 overflow-y-auto pr-1 space-y-0.5 border border-gray-100 rounded p-1 bg-gray-50/50">
                                {HOURS_24.map(h => {
                                    const hNum = parseInt(h, 10);
                                    const pmHint = hNum >= 13 ? ` (${hNum - 12}p)` : hNum === 12 ? ' (12p)' : '';
                                    return (
                                        <button
                                            key={h}
                                            type="button"
                                            onClick={() => handleSelectHour(h)}
                                            className={`w-full py-0.5 text-xs font-mono rounded text-center transition-colors ${
                                                selectedHour === h
                                                    ? 'bg-sarp-dark-blue text-white font-bold'
                                                    : 'hover:bg-blue-50 text-gray-700'
                                            }`}
                                        >
                                            {h}:00{pmHint}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Columna Minutos */}
                        <div>
                            <span className="block text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider mb-1 text-center">
                                Minutos
                            </span>
                            <div className="max-h-36 overflow-y-auto pr-1 space-y-0.5 border border-gray-100 rounded p-1 bg-gray-50/50">
                                {MINUTES_STEPS.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => handleSelectMinute(m)}
                                        className={`w-full py-0.5 text-xs font-mono rounded text-center transition-colors ${
                                            selectedMinute === m
                                                ? 'bg-sarp-blue text-white font-bold'
                                                : 'hover:bg-blue-50 text-gray-700'
                                        }`}
                                    >
                                        :{m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Pie explicativo */}
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[0.625rem] text-gray-400">
                        <span>Use ↑ / ↓ para sumar 15m</span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-xs font-semibold text-sarp-blue hover:underline"
                        >
                            Listo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
