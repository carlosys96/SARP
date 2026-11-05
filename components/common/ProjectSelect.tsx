import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Proyecto } from '../../types';
import { getProjectCode, matchesProject, normalizeSearchText } from './projectUtils';
import { SearchIcon, CloseIcon } from '../icons/Icons';

export interface ProjectSelectProps {
    value: string;
    onChange: (value: string) => void;
    projects: Proyecto[];
    nonBillableOptions?: Record<string, string>;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
    autoFocusSearch?: boolean;
}

export const ProjectSelect: React.FC<ProjectSelectProps> = ({
    value,
    onChange,
    projects,
    nonBillableOptions = {},
    placeholder = 'Buscar por código o nombre...',
    disabled = false,
    className = '',
    ariaLabel = 'Seleccionar proyecto o concepto'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Identificar la selección actual
    const isValueSelected = Boolean(value && value !== '0');
    const selectedProject = useMemo(() => {
        if (!isValueSelected) return undefined;
        return projects.find(p => String(p.proyecto_id) === String(value));
    }, [projects, value, isValueSelected]);

    const isNonBillable = Boolean(value && nonBillableOptions[value]);
    const selectedNonBillableLabel = isNonBillable ? nonBillableOptions[value] : undefined;

    // Filtrar proyectos según el término de búsqueda
    const filteredProjects = useMemo(() => {
        if (!searchTerm.trim()) return projects;
        return projects.filter(p => matchesProject(p, searchTerm));
    }, [projects, searchTerm]);

    // Filtrar conceptos no facturables según el término de búsqueda
    const filteredNonBillable = useMemo(() => {
        const entries = Object.entries(nonBillableOptions);
        if (!searchTerm.trim()) return entries;
        const norm = normalizeSearchText(searchTerm);
        return entries.filter(([key, label]) => {
            const normLabel = normalizeSearchText(label);
            const normKey = normalizeSearchText(key);
            return normLabel.includes(norm) || normKey.includes(norm);
        });
    }, [nonBillableOptions, searchTerm]);

    // Lista plana de opciones para navegación por teclado
    interface FlatOption {
        type: 'project' | 'concept';
        id: string;
        code?: string;
        label: string;
        project?: Proyecto;
    }

    const flatOptions: FlatOption[] = useMemo(() => {
        const list: FlatOption[] = [];
        filteredProjects.forEach(p => {
            list.push({
                type: 'project',
                id: String(p.proyecto_id),
                code: getProjectCode(p),
                label: p.nombre_proyecto,
                project: p
            });
        });
        filteredNonBillable.forEach(([key, label]) => {
            list.push({
                type: 'concept',
                id: key,
                label
            });
        });
        return list;
    }, [filteredProjects, filteredNonBillable]);

    // Cerrar al hacer click fuera
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
                setHighlightedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Enfocar input al abrir
    useEffect(() => {
        if (isOpen) {
            setHighlightedIndex(-1);
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Manejar selección
    const handleSelect = (optionId: string) => {
        onChange(optionId);
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
    };

    // Limpiar selección
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('0');
        setSearchTerm('');
    };

    // Navegación por teclado
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;

        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
            setSearchTerm('');
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < flatOptions.length - 1 ? prev + 1 : 0));
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : flatOptions.length - 1));
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < flatOptions.length) {
                handleSelect(flatOptions[highlightedIndex].id);
            } else if (flatOptions.length === 1) {
                handleSelect(flatOptions[0].id);
            }
        }
    };

    // Scroll automático para item resaltado
    useEffect(() => {
        if (highlightedIndex >= 0 && listRef.current) {
            const element = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
            if (element) {
                element.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightedIndex]);

    return (
        <div ref={containerRef} className={`relative inline-block w-full text-left ${className}`} onKeyDown={handleKeyDown}>
            {/* Botón Disparador */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                aria-label={ariaLabel}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className={`w-full flex items-center justify-between text-xs py-1.5 px-2.5 rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    disabled
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : isNonBillable
                        ? 'bg-slate-50 border-slate-300 text-slate-800 hover:border-slate-400'
                        : isValueSelected
                        ? 'bg-surface border-line text-ink hover:border-line2'
                        : 'bg-surface border-line text-ink3 hover:border-line2'
                }`}
            >
                <div className="flex items-center gap-1.5 min-w-0 pr-1 overflow-hidden">
                    {selectedProject ? (
                        <>
                            <span className="font-mono text-[10px] font-bold text-sarp-blue bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded shrink-0">
                                {getProjectCode(selectedProject)}
                            </span>
                            <span className="truncate font-medium text-ink text-left" title={selectedProject.nombre_proyecto}>
                                {selectedProject.nombre_proyecto}
                            </span>
                        </>
                    ) : selectedNonBillableLabel ? (
                        <>
                            <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-200/70 border border-slate-300 px-1.5 py-0.5 rounded shrink-0">
                                Concepto
                            </span>
                            <span className="truncate font-medium text-slate-700 text-left" title={selectedNonBillableLabel}>
                                {selectedNonBillableLabel}
                            </span>
                        </>
                    ) : (
                        <span className="truncate text-ink3 text-left">
                            {placeholder}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                    {isValueSelected && !disabled && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={handleClear}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleClear(e as any); }}
                            className="p-0.5 text-ink3 hover:text-red-500 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                            title="Quitar selección"
                            aria-label="Quitar selección"
                        >
                            <CloseIcon size={3} />
                        </span>
                    )}
                    <svg
                        className={`w-3.5 h-3.5 text-ink3 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
            </button>

            {/* Menú Desplegable con Filtro de Búsqueda */}
            {isOpen && (
                <div
                    className="absolute left-0 top-full mt-1 w-full min-w-[280px] sm:min-w-[340px] max-w-lg bg-surface border border-line rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn"
                    style={{ maxHeight: '360px' }}
                >
                    {/* Barra de Búsqueda Superior */}
                    <div className="p-2 bg-surface2 border-b border-line">
                        <div className="relative flex items-center">
                            <span className="absolute left-2.5 text-ink3 pointer-events-none">
                                <SearchIcon size={3.5} />
                            </span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={e => {
                                    setSearchTerm(e.target.value);
                                    setHighlightedIndex(0);
                                }}
                                placeholder="Buscar por código (ej. 25-058) o nombre..."
                                className="w-full text-xs pl-8 pr-7 py-1.5 bg-surface border border-line rounded text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        searchInputRef.current?.focus();
                                    }}
                                    className="absolute right-2 text-ink3 hover:text-ink p-0.5"
                                    title="Borrar búsqueda"
                                >
                                    <CloseIcon size={3} />
                                </button>
                            )}
                        </div>

                        {/* Indicador de resultados */}
                        <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-ink3">
                            <span>
                                {flatOptions.length} resultado{flatOptions.length !== 1 ? 's' : ''} disponible{flatOptions.length !== 1 ? 's' : ''}
                            </span>
                            {searchTerm && (
                                <span className="text-sarp-blue font-medium">
                                    Filtro activo
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Lista Scrolleable */}
                    <div ref={listRef} className="overflow-y-auto max-h-[260px] divide-y divide-line/40">
                        {flatOptions.length === 0 ? (
                            <div className="p-4 text-center text-xs text-ink3">
                                <p className="font-semibold text-ink mb-1">Sin coincidencias</p>
                                <p className="text-[11px]">No se encontró ningún proyecto con el código o nombre "{searchTerm}".</p>
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="mt-2 text-xs text-sarp-blue hover:underline font-medium"
                                >
                                    Mostrar todos los proyectos
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Sección de Proyectos Facturables */}
                                {filteredProjects.length > 0 && (
                                    <div>
                                        <div className="px-3 py-1.5 bg-gray-50/90 text-[10px] font-bold uppercase tracking-[0.08em] text-ink3 sticky top-0 border-b border-line/40 flex items-center justify-between">
                                            <span>Proyectos facturables</span>
                                            <span className="font-mono text-[9px] bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                                {filteredProjects.length}
                                            </span>
                                        </div>
                                        {filteredProjects.map(p => {
                                            const optionId = String(p.proyecto_id);
                                            const isSelected = String(value) === optionId;
                                            const code = getProjectCode(p);
                                            const flatIdx = flatOptions.findIndex(o => o.type === 'project' && o.id === optionId);
                                            const isHighlighted = highlightedIndex === flatIdx;

                                            return (
                                                <div
                                                    key={p.proyecto_id}
                                                    data-index={flatIdx}
                                                    onClick={() => handleSelect(optionId)}
                                                    onMouseEnter={() => setHighlightedIndex(flatIdx)}
                                                    className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between gap-2 text-xs ${
                                                        isSelected
                                                            ? 'bg-blue-50/70 border-l-2 border-sarp-blue'
                                                            : isHighlighted
                                                            ? 'bg-surface2'
                                                            : 'hover:bg-surface2/60'
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-mono text-[11px] font-bold text-sarp-blue bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded shrink-0">
                                                                {code}
                                                            </span>
                                                            <span className={`font-medium ${isSelected ? 'text-sarp-blue font-bold' : 'text-ink'}`}>
                                                                {p.nombre_proyecto}
                                                            </span>
                                                        </div>
                                                        {(p.estacion || p.odc_po || p.estatus) && (
                                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-ink3">
                                                                {p.estacion && <span>Estación: {p.estacion}</span>}
                                                                {p.odc_po && <span>ODC: {p.odc_po}</span>}
                                                                {p.estatus && (
                                                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                                                                        p.estatus === 'Proceso' ? 'bg-amber-100 text-amber-800' :
                                                                        p.estatus === 'Abierto' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                                                                    }`}>
                                                                        {p.estatus}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {isSelected && (
                                                        <span className="text-sarp-blue shrink-0 font-bold">
                                                            ✓
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Sección de Conceptos No Facturables */}
                                {filteredNonBillable.length > 0 && (
                                    <div>
                                        <div className="px-3 py-1.5 bg-gray-50/90 text-[10px] font-bold uppercase tracking-[0.08em] text-ink3 sticky top-0 border-b border-line/40 flex items-center justify-between">
                                            <span>Conceptos generales (no facturables)</span>
                                            <span className="font-mono text-[9px] bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                                {filteredNonBillable.length}
                                            </span>
                                        </div>
                                        {filteredNonBillable.map(([key, label]) => {
                                            const isSelected = String(value) === key;
                                            const flatIdx = flatOptions.findIndex(o => o.type === 'concept' && o.id === key);
                                            const isHighlighted = highlightedIndex === flatIdx;

                                            return (
                                                <div
                                                    key={key}
                                                    data-index={flatIdx}
                                                    onClick={() => handleSelect(key)}
                                                    onMouseEnter={() => setHighlightedIndex(flatIdx)}
                                                    className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between gap-2 text-xs ${
                                                        isSelected
                                                            ? 'bg-slate-100 border-l-2 border-slate-600'
                                                            : isHighlighted
                                                            ? 'bg-surface2'
                                                            : 'hover:bg-surface2/60'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-200/80 border border-slate-300 px-1.5 py-0.5 rounded shrink-0">
                                                            General
                                                        </span>
                                                        <span className={`font-medium ${isSelected ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                                                            {label}
                                                        </span>
                                                    </div>

                                                    {isSelected && (
                                                        <span className="text-slate-800 shrink-0 font-bold">
                                                            ✓
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
