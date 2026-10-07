import React, { useState, useMemo } from 'react';
import type { Empleado, Proyecto } from '../../types';
import type { Activity, EmployeeData } from './dailyEntryTypes';
import { 
    NON_BILLABLE_OPTIONS, 
    timeToMinutes, 
    getInitials, 
    MAX_NORMAL_HOURS,
    calculateActivityDuration,
    getSuggestedCorrection,
    getEffectiveInterval,
    spansLunchTime,
    STANDARD_SHIFT_BLOCKS,
    LUNCH_START_MINUTES,
    LUNCH_END_MINUTES
} from './dailyEntryTypes';
import { PlusIcon, TrashIcon, MapPinIcon, AlertTriangleIcon, HistoryIcon } from '../icons/Icons';
import { Time24Input } from './Time24Input';

interface EmployeeRowProps {
    employee: Empleado;
    projects: Proyecto[];
    data: EmployeeData;
    errors: Set<string>;
    onUpdate: (employeeId: string, updateFn: (prev: EmployeeData) => EmployeeData) => void;
    isLocked: boolean;
    isIncomplete: boolean;
    onPreload?: (employeeId: string) => void;
}

export const EmployeeRow: React.FC<EmployeeRowProps> = ({
    employee,
    projects,
    data,
    errors,
    onUpdate,
    isLocked,
    isIncomplete,
    onPreload
}) => {
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const { activities, isAbsent, absenceReason } = data;

    const hasConflict = errors.size > 0;

    // Métodos de actualización de actividades
    const updateActivities = (updateFn: (prev: Activity[]) => Activity[]) => {
        if (isLocked) return;
        onUpdate(employee.empleado_id!, prev => ({
            ...prev,
            activities: updateFn(prev.activities)
        }));
    };

    const addActivity = () => {
        if (isLocked) return;
        const last = activities[activities.length - 1];
        let newStart = "08:00";
        let newEnd = "13:00";
        if (last) {
            // Si el periodo anterior concluye a las 13:00 (hora estándar de comida), el nuevo arranca a las 14:00
            if (last.endTime === "13:00") {
                newStart = "14:00";
                newEnd = "17:30";
            } else {
                newStart = last.endTime;
                newEnd = last.endTime;
            }
        }
        const newAct: Activity = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7),
            projectId: last?.projectId || "0",
            startTime: newStart,
            endTime: newEnd,
            isSite: last?.isSite || false,
        };
        updateActivities(prev => [...prev, newAct]);
    };

    // Aplicar jornada estándar: 08:00 a 13:00 y 14:00 a 17:30 (con comida de 1 a 2 pm = 8.5 h)
    const applyStandardShift = () => {
        if (isLocked) return;
        const baseProj = activities[0]?.projectId || "0";
        const baseSite = activities[0]?.isSite || false;
        updateActivities(() => [
            {
                id: `${Date.now()}-1`,
                projectId: baseProj,
                startTime: '08:00',
                endTime: '13:00',
                isSite: baseSite
            },
            {
                id: `${Date.now()}-2`,
                projectId: baseProj,
                startTime: '14:00',
                endTime: '17:30',
                isSite: baseSite
            }
        ]);
    };

    // Dividir un periodo que cruza la hora de comida (13:00 a 14:00)
    const splitForLunch = (actId: string) => {
        if (isLocked) return;
        const target = activities.find(a => a.id === actId);
        if (!target) return;
        updateActivities(prev => {
            const index = prev.findIndex(a => a.id === actId);
            if (index === -1) return prev;
            const part1: Activity = {
                ...target,
                endTime: '13:00'
            };
            const part2: Activity = {
                id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                projectId: target.projectId,
                startTime: '14:00',
                endTime: target.endTime,
                isSite: target.isSite
            };
            const next = [...prev];
            next.splice(index, 1, part1, part2);
            return next;
        });
    };

    const updateActivity = (id: string, field: keyof Activity, value: any) => {
        if (isLocked) return;
        updateActivities(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    };

    const removeActivity = (id: string) => {
        if (isLocked) return;
        updateActivities(prev => prev.filter(a => a.id !== id));
    };

    const toggleAbsence = (checked: boolean) => {
        if (isLocked) return;
        onUpdate(employee.empleado_id!, prev => ({
            ...prev,
            isAbsent: checked,
            absenceReason: prev.absenceReason || 'Vacaciones'
        }));
    };

    const setAbsenceReason = (reason: string) => {
        if (isLocked) return;
        onUpdate(employee.empleado_id!, prev => ({
            ...prev,
            absenceReason: reason
        }));
    };

    // Cálculos de horas (maneja 24h, PM implícito y turnos nocturnos sin omitir horas)
    const totalHours = useMemo(() => {
        if (isAbsent) return 8;
        return activities.reduce((sum, act) => {
            return sum + calculateActivityDuration(act.startTime, act.endTime);
        }, 0);
    }, [activities, isAbsent]);

    const normalHours = Math.min(totalHours, MAX_NORMAL_HOURS);
    const extraHours = Math.max(0, totalHours - MAX_NORMAL_HOURS);

    // Turno
    const shiftRange = useMemo(() => {
        if (activities.length === 0 || isAbsent) return null;
        let minStart = Infinity;
        let maxEnd = -Infinity;

        activities.forEach(act => {
            const interval = getEffectiveInterval(act.startTime, act.endTime);
            if (interval) {
                if (interval.start < minStart) minStart = interval.start;
                if (interval.end > maxEnd) maxEnd = interval.end;
            }
        });

        if (minStart === Infinity || maxEnd === -Infinity) return null;

        const fmt = (min: number) => {
            const h = (Math.floor(min / 60) % 24).toString().padStart(2, '0');
            const m = (min % 60).toString().padStart(2, '0');
            return `${h}:${m}`;
        };
        return `${fmt(minStart)} – ${fmt(maxEnd)}`;
    }, [activities, isAbsent]);

    // Determinar si el empleado tiene contemplada la hora estándar de comida (13:00 a 14:00)
    const hasLunchBreak = useMemo(() => {
        if (isAbsent || activities.length < 2) return false;
        const intervals = activities
            .map(a => getEffectiveInterval(a.startTime, a.endTime))
            .filter(Boolean) as { start: number; end: number }[];
        const hasBeforeLunch = intervals.some(iv => iv.end <= LUNCH_START_MINUTES);
        const hasAfterLunch = intervals.some(iv => iv.start >= LUNCH_END_MINUTES);
        const worksDuringLunch = intervals.some(iv => iv.start < LUNCH_END_MINUTES && iv.end > LUNCH_START_MINUTES);
        return hasBeforeLunch && hasAfterLunch && !worksDuringLunch;
    }, [activities, isAbsent]);

    // Estado y tinte de fila
    let statusChip: { label: string; className: string };
    let rowBg = 'bg-surface';

    if (isLocked) {
        statusChip = {
            label: 'REGISTRADO',
            className: 'border-steel/30 bg-steelSoft text-steel'
        };
        rowBg = 'bg-surface2 text-ink3';
    } else if (isAbsent) {
        statusChip = {
            label: (absenceReason || 'AUSENCIA').toUpperCase(),
            className: 'border-line bg-surface2 text-ink2'
        };
        rowBg = 'bg-surface';
    } else if (hasConflict) {
        statusChip = {
            label: 'CONFLICTO',
            className: 'border-brand/30 bg-brandSoft text-brand'
        };
        rowBg = 'bg-gradient-to-r from-brandSoft via-brandSoft/40 to-transparent';
    } else if (isIncomplete) {
        statusChip = {
            label: 'PENDIENTE',
            className: 'border-slate-200 bg-slate-100 text-slate-600 font-semibold'
        };
        rowBg = 'bg-surface hover:bg-surface2/40';
    } else {
        statusChip = {
            label: 'LISTO',
            className: 'border-green/30 bg-greenSoft text-green'
        };
        rowBg = 'bg-surface hover:bg-surface2/40';
    }

    // Porcentajes para la barra de 6px
    const maxBarHours = Math.max(12, totalHours);
    const normalWidth = totalHours > 0 ? (normalHours / maxBarHours) * 100 : 0;
    const extraWidth = totalHours > 0 ? (extraHours / maxBarHours) * 100 : 0;

    return (
        <div 
            id={`employee-row-${employee.empleado_id}`}
            className={`border-b border-line transition-colors duration-200 ${rowBg}`}
        >
            {/* Fila Colapsada - Vista de Escritorio (>= 900px) */}
            <div 
                className="hidden [@media(min-width:900px)]:grid grid-cols-[36px_minmax(150px,1.4fr)_108px_132px_104px_auto_30px] items-center gap-3 py-2.5 px-4 cursor-pointer select-none"
                onClick={() => !isLocked && setIsExpanded(!isExpanded)}
            >
                {/* Col 1: Avatar cuadrado 36px, rounded-lg */}
                <div className="w-9 h-9 rounded-lg bg-surface2 text-ink border border-line flex items-center justify-center font-bold text-xs">
                    {getInitials(employee.nombre_completo)}
                </div>

                {/* Col 2: Nombre + Meta en mono */}
                <div className="min-w-0 pr-2">
                    <div className="text-[0.9375rem] font-semibold text-ink truncate leading-snug">
                        {employee.nombre_completo}
                    </div>
                    <div className="text-[0.6875rem] font-mono text-ink2 tabular-nums truncate">
                        {employee.equipo || 'Sin Equipo'}
                    </div>
                </div>

                {/* Col 3: Chip de estado */}
                <div className="text-center">
                    <span className={`inline-block w-full text-[0.6875rem] font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded border text-center ${statusChip.className}`}>
                        {statusChip.label}
                    </span>
                </div>

                {/* Col 4: Turno HH:MM - HH:MM o sin turno */}
                <div className="text-xs font-mono tabular-nums text-center">
                    {shiftRange ? (
                        <div className="flex flex-col items-center">
                            <span className="text-ink font-medium">{shiftRange}</span>
                            {hasLunchBreak && (
                                <span className="text-[0.625rem] text-amber-800 font-medium flex items-center gap-0.5 mt-0.5" title="Hora estándar de comida de 1:00 PM a 2:00 PM">
                                    <span>🍽️</span> Comida 1–2 pm
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-ink3">{isAbsent ? 'Ausencia' : 'sin turno'}</span>
                    )}
                </div>

                {/* Col 5: Total horas alineado a la derecha */}
                <div className="text-right">
                    <div className="text-sm font-mono font-semibold tabular-nums text-ink">
                        {totalHours.toFixed(1)} h
                    </div>
                    {extraHours > 0 && (
                        <div className="text-[0.625rem] font-mono tabular-nums text-sarp-blue font-semibold leading-none mt-0.5">
                            {normalHours.toFixed(1)} N + {extraHours.toFixed(1)} E
                        </div>
                    )}
                </div>

                {/* Col 6: Toggle de ausencia (38x21px) + Precargar */}
                <div 
                    className="flex items-center gap-2 pl-2"
                    onClick={e => e.stopPropagation()}
                >
                    {!isLocked && onPreload && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPreload(employee.empleado_id!);
                            }}
                            className="p-1 text-ink3 hover:text-sarp-blue hover:bg-surface2 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sarp-blue shrink-0"
                            title={`Precargar último registro de ${employee.nombre_completo}`}
                            aria-label={`Precargar último registro de ${employee.nombre_completo}`}
                        >
                            <HistoryIcon size={4} />
                        </button>
                    )}
                    <span className="text-[0.6875rem] uppercase tracking-[0.06em] text-ink3 font-medium">
                        Ausente
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer min-w-[38px] min-h-[21px]">
                        <input
                            type="checkbox"
                            checked={isAbsent}
                            disabled={isLocked}
                            onChange={e => toggleAbsence(e.target.checked)}
                            className="sr-only peer"
                            aria-label={`Marcar ausencia para ${employee.nombre_completo}`}
                        />
                        <div className="w-[38px] h-[21px] bg-line rounded-full peer peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-checked:bg-ink transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-[17px] after:w-[17px] after:transition-all after:shadow-sm peer-checked:after:translate-x-[17px]"></div>
                    </label>
                </div>

                {/* Col 7: Chevron que rota 180° */}
                <div className="flex justify-center items-center">
                    {!isLocked && (
                        <button
                            type="button"
                            aria-label={isExpanded ? "Colapsar fila" : "Expandir fila"}
                            className="w-[30px] h-[30px] flex items-center justify-center text-ink3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                        >
                            <svg 
                                className={`w-4 h-4 transition-transform duration-200 ease-exponential ${isExpanded ? 'rotate-180' : ''}`} 
                                viewBox="0 0 20 20" 
                                fill="currentColor"
                            >
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Fila Colapsada - Vista Responsive (< 900px) */}
            <div 
                className="[@media(min-width:900px)]:hidden p-3 cursor-pointer select-none relative"
                onClick={() => !isLocked && setIsExpanded(!isExpanded)}
            >
                {/* Línea 1: avatar nombre chip */}
                <div className="flex items-center gap-3 pr-8">
                    <div className="w-9 h-9 rounded-lg bg-surface2 text-ink border border-line flex items-center justify-center font-bold text-xs shrink-0">
                        {getInitials(employee.nombre_completo)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[0.9375rem] font-semibold text-ink truncate leading-tight">
                            {employee.nombre_completo}
                        </div>
                        <div className="text-[0.6875rem] font-mono text-ink2 tabular-nums truncate">
                            {employee.equipo || 'Sin Equipo'}
                        </div>
                    </div>
                    <div className="shrink-0">
                        <span className={`inline-block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded border ${statusChip.className}`}>
                            {statusChip.label}
                        </span>
                    </div>
                </div>

                {/* Línea 2: turno, total horas y toggle ausencia */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-line/60 pl-12 pr-10">
                    <div className="text-xs font-mono tabular-nums">
                        {shiftRange ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-ink font-medium">{shiftRange}</span>
                                {hasLunchBreak && (
                                    <span className="text-[0.625rem] text-amber-800 font-medium flex items-center gap-0.5">
                                        <span>🍽️</span> 1–2 pm
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="text-ink3">{isAbsent ? 'Ausencia' : 'sin turno'}</span>
                        )}
                    </div>
                    <div className="text-right">
                        <span className="text-sm font-mono font-semibold tabular-nums text-ink">
                            {totalHours.toFixed(1)} h
                        </span>
                        {extraHours > 0 && (
                            <span className="ml-1 text-[0.625rem] font-mono text-sarp-blue font-semibold">
                                ({extraHours.toFixed(1)} extra)
                            </span>
                        )}
                    </div>
                    <div 
                        className="flex items-center gap-2"
                        onClick={e => e.stopPropagation()}
                    >
                        {!isLocked && onPreload && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPreload(employee.empleado_id!);
                                }}
                                className="p-1 text-ink3 hover:text-sarp-blue rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sarp-blue"
                                title={`Precargar último registro de ${employee.nombre_completo}`}
                                aria-label={`Precargar último registro de ${employee.nombre_completo}`}
                            >
                                <HistoryIcon size={4} />
                            </button>
                        )}
                        <label className="relative inline-flex items-center cursor-pointer min-w-[38px] min-h-[21px]">
                            <input
                                type="checkbox"
                                checked={isAbsent}
                                disabled={isLocked}
                                onChange={e => toggleAbsence(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-[38px] h-[21px] bg-line rounded-full peer-checked:bg-ink transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-[17px] after:w-[17px] after:transition-all peer-checked:after:translate-x-[17px]"></div>
                        </label>
                    </div>
                </div>

                {/* Chevron absoluto abajo a la derecha */}
                {!isLocked && (
                    <div className="absolute right-2 bottom-2.5">
                        <svg 
                            className={`w-5 h-5 text-ink3 transition-transform duration-200 ease-exponential ${isExpanded ? 'rotate-180' : ''}`} 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                        >
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Franja informativa para fila bloqueada (Elimina el overlay difuminado) */}
            {isLocked && (
                <div className="bg-steelSoft px-4 py-2 text-xs text-steel border-t border-line flex items-center justify-between">
                    <span className="font-medium">
                        Registrado previamente en esta fecha. Para modificar, acuda a Históricos.
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-ink">
                        {totalHours > 0 ? `${totalHours.toFixed(1)} h registradas` : 'Día cerrado'}
                    </span>
                </div>
            )}

            {/* Panel Expandido */}
            {isExpanded && !isLocked && (
                <div className="bg-surface2 border-t border-line pl-4 sm:pl-[68px] pr-4 py-4 space-y-4 animate-fadeIn">
                    {/* Modo Ausencia */}
                    {isAbsent ? (
                        <div className="bg-surface p-3.5 rounded-lg border border-line max-w-md">
                            <label className="block text-[0.625rem] uppercase tracking-[0.09em] font-semibold text-ink3 mb-1.5">
                                Motivo de la Ausencia
                            </label>
                            <select
                                value={absenceReason || 'Vacaciones'}
                                onChange={e => setAbsenceReason(e.target.value)}
                                className="w-full text-xs font-medium py-1.5 px-2.5 rounded border border-line bg-surface text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            >
                                <option value="Vacaciones">Vacaciones</option>
                                <option value="Incapacidad">Incapacidad</option>
                                <option value="Falta">Falta</option>
                                <option value="Permiso">Permiso</option>
                                <option value="Día festivo oficial">Día festivo oficial</option>
                            </select>
                            <p className="text-[0.6875rem] text-ink3 mt-2">
                                Se computan automáticamente 8.0 horas normales para este concepto contable.
                            </p>
                            {onPreload && (
                                <button
                                    type="button"
                                    onClick={() => onPreload(employee.empleado_id!)}
                                    className="mt-3 text-xs font-semibold text-sarp-blue hover:text-sarp-dark-blue flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sarp-blue rounded"
                                >
                                    <HistoryIcon size={3.5} />
                                    <span>Restaurar / precargar último registro previo</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Modo Actividades */
                        <div>
                            <div className="space-y-3">
                                {activities.length === 0 ? (
                                    <div className="py-3 px-3.5 bg-amber-50/70 border border-amber-200/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="text-xs text-amber-950">
                                            <span className="font-bold flex items-center gap-1.5 mb-0.5">
                                                <span>🍽️</span> Sin periodos registrados
                                            </span>
                                            <span className="text-[0.6875rem] text-amber-800">
                                                Jornada estándar: <strong>08:00 a 13:00</strong> y <strong>14:00 a 17:30</strong> con hora de comida de 1 a 2 pm (8.5 h).
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={applyStandardShift}
                                                className="px-3 py-1.5 bg-amber-800 text-white rounded font-semibold text-xs hover:bg-amber-900 transition-colors shadow-sm flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                                            >
                                                <span>🍽️</span>
                                                <span>Cargar jornada estándar (8.5 h)</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={addActivity}
                                                className="px-2.5 py-1.5 bg-surface text-ink border border-line rounded font-medium text-xs hover:bg-surface2 transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                                            >
                                                <PlusIcon size={3.5} />
                                                <span>Manual</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    activities.map((act, idx) => {
                                        const isNonBillable = Boolean(NON_BILLABLE_OPTIONS[act.projectId]);
                                        const duration = calculateActivityDuration(act.startTime, act.endTime);
                                        const suggestion = getSuggestedCorrection(act.startTime, act.endTime);
                                        const isIdentical = act.startTime && act.endTime && act.startTime === act.endTime;
                                        const sMin = timeToMinutes(act.startTime);
                                        const eMin = timeToMinutes(act.endTime);
                                        const isOvernight = sMin !== null && eMin !== null && sMin > eMin && !suggestion;
                                        const actHasError = errors.has(act.id);
                                        const isAfterLunch = idx > 0 && activities[idx - 1].endTime === '13:00' && act.startTime === '14:00';
                                        const crossesLunch = spansLunchTime(act.startTime, act.endTime);

                                        return (
                                            <React.Fragment key={act.id}>
                                                {/* Separador de comida 1:00 PM a 2:00 PM entre periodos */}
                                                {isAfterLunch && (
                                                    <div className="flex items-center justify-between px-3 py-1.5 bg-amber-100/70 border border-amber-300/80 rounded-md text-amber-950 text-xs my-2 font-medium">
                                                        <div className="flex items-center gap-1.5">
                                                            <span>🍽️</span>
                                                            <span className="font-bold">Hora de comida (1:00 PM a 2:00 PM):</span>
                                                            <span className="font-mono">13:00 – 14:00</span>
                                                        </div>
                                                        <span className="text-[0.6875rem] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded font-mono">
                                                            1.0 h comida no laborable
                                                        </span>
                                                    </div>
                                                )}

                                                <div 
                                                    className={`transition-all ${
                                                        actHasError 
                                                            ? 'bg-brandSoft rounded-lg p-2.5 border border-brand/20' 
                                                            : 'pb-3 border-b border-dashed border-line2'
                                                    }`}
                                                >
                                                    {/* Grid de 5 columnas para Periodo */}
                                                    <div className="grid grid-cols-1 md:grid-cols-[minmax(190px,1fr)_auto_66px_auto_30px] items-end gap-3">
                                                        {/* Col 1: Proyecto / Concepto */}
                                                        <div>
                                                            <label className="block text-[0.625rem] uppercase tracking-[0.09em] font-semibold text-ink3 mb-1">
                                                                Proyecto / Concepto
                                                            </label>
                                                            <select
                                                                value={act.projectId}
                                                                onChange={ev => updateActivity(act.id, 'projectId', ev.target.value)}
                                                                className={`w-full text-xs py-1.5 px-2.5 rounded border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                                                                    isNonBillable 
                                                                        ? 'bg-slate-50 border-slate-300 text-slate-700 font-medium' 
                                                                        : 'bg-surface border-line text-ink'
                                                                }`}
                                                            >
                                                                <option value="0" disabled>Seleccionar proyecto...</option>
                                                                <optgroup label="Proyectos facturables">
                                                                    {projects.map(p => (
                                                                        <option key={p.proyecto_id} value={String(p.proyecto_id)}>
                                                                            {p.nombre_proyecto}
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                                <optgroup label="Conceptos generales (no facturables)">
                                                                    {Object.entries(NON_BILLABLE_OPTIONS).map(([key, label]) => (
                                                                        <option key={key} value={key}>{label}</option>
                                                                    ))}
                                                                </optgroup>
                                                            </select>
                                                        </div>

                                                        {/* Col 2: Inicio - Fin (Formato 24h) */}
                                                        <div>
                                                            <label className="block text-[0.625rem] uppercase tracking-[0.09em] font-semibold text-ink3 mb-1">
                                                                Horario (24h)
                                                            </label>
                                                            <div className="flex items-center gap-1.5">
                                                                <Time24Input
                                                                    value={act.startTime}
                                                                    onChange={val => updateActivity(act.id, 'startTime', val)}
                                                                    disabled={isLocked}
                                                                    ariaLabel="Hora de inicio (24h)"
                                                                />
                                                                <span className="text-ink3 text-xs font-semibold">–</span>
                                                                <Time24Input
                                                                    value={act.endTime}
                                                                    onChange={val => updateActivity(act.id, 'endTime', val)}
                                                                    disabled={isLocked}
                                                                    ariaLabel="Hora de fin (24h)"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Col 3: Duración */}
                                                        <div className="w-full md:w-[66px] text-center">
                                                            <label className="block text-[0.625rem] uppercase tracking-[0.09em] font-semibold text-ink3 mb-1">
                                                                Duración
                                                            </label>
                                                            <div className="py-1 px-1 text-xs font-mono font-semibold tabular-nums text-ink bg-surface border border-line rounded min-h-[32px] flex items-center justify-center">
                                                                {duration.toFixed(1)} h
                                                            </div>
                                                        </div>

                                                        {/* Col 4: Botón Sitio */}
                                                        <div>
                                                            <label className="block text-[0.625rem] uppercase tracking-[0.09em] font-semibold text-ink3 mb-1">
                                                                Lugar
                                                            </label>
                                                            <label className="cursor-pointer inline-flex items-center select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={act.isSite}
                                                                    onChange={ev => updateActivity(act.id, 'isSite', ev.target.checked)}
                                                                    className="sr-only peer"
                                                                />
                                                                <div className={`px-2.5 py-1 rounded border text-xs font-medium flex items-center gap-1 transition-colors min-h-[32px] ${
                                                                    act.isSite 
                                                                        ? 'bg-greenSoft border-green text-green' 
                                                                        : 'bg-surface border-line text-ink3 hover:text-ink'
                                                                }`}>
                                                                    <MapPinIcon size={3.5} />
                                                                    <span>Sitio</span>
                                                                </div>
                                                            </label>
                                                        </div>

                                                        {/* Col 5: Eliminar */}
                                                        <div className="flex justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeActivity(act.id)}
                                                                className="w-[30px] h-[32px] flex items-center justify-center text-ink3 hover:text-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                                                                title="Eliminar periodo"
                                                                aria-label="Eliminar periodo"
                                                            >
                                                                <TrashIcon size={4} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Sugerencia de dividir periodo si abarca la hora de comida (13:00 a 14:00) */}
                                                    {crossesLunch && !isLocked && (
                                                        <div className="mt-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded px-2.5 py-1.5 flex items-center justify-between gap-2 flex-wrap animate-fadeIn">
                                                            <div className="flex items-center gap-1.5">
                                                                <span>🍽️</span>
                                                                <span>Este periodo abarca la <strong>hora estándar de comida (13:00 a 14:00)</strong>.</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => splitForLunch(act.id)}
                                                                className="px-2 py-0.5 bg-amber-700 text-white rounded font-semibold text-[0.6875rem] hover:bg-amber-800 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                                                            >
                                                                Dividir por comida (1–2 pm)
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Asistente 24h cuando una hora de la tarde se introdujo en formato 12h */}
                                                    {suggestion && !isLocked && (
                                                        <div className="mt-2 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded px-2.5 py-1.5 flex items-center justify-between gap-2 flex-wrap animate-fadeIn">
                                                            <div className="flex items-center gap-1.5">
                                                                <span>💡</span>
                                                                <span>¿Hora de fin es de la tarde ({suggestion.label})?</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateActivity(act.id, 'endTime', suggestion.suggestedTime)}
                                                                className="px-2 py-0.5 bg-sarp-blue text-white rounded font-semibold text-[0.6875rem] hover:bg-sarp-dark-blue transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sarp-blue"
                                                            >
                                                                Aplicar {suggestion.suggestedTime}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Aviso de turno nocturno que cruza medianoche */}
                                                    {isOvernight && (
                                                        <div className="mt-1.5 text-[0.6875rem] bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded flex items-center gap-1.5">
                                                            <span>🌙</span>
                                                            <span>Turno nocturno (cruza medianoche a la madrugada siguiente): {duration.toFixed(1)} h computadas.</span>
                                                        </div>
                                                    )}

                                                    {/* Aviso si inicio y fin son iguales */}
                                                    {isIdentical && !isLocked && (
                                                        <div className="mt-1 text-[0.6875rem] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                                            ⚠️ La hora de inicio y fin son idénticas ({act.startTime}). Ajuste la hora de fin para contabilizar las horas.
                                                        </div>
                                                    )}

                                                    {/* Mensaje de traslape con ícono de alerta */}
                                                    {actHasError && (
                                                        <div className="text-[0.75rem] text-brand flex items-center gap-1.5 mt-1.5 font-medium">
                                                            <AlertTriangleIcon size={3.5} />
                                                            <span>Se traslapa con otro periodo del mismo día.</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </div>

                            {/* Pie del Panel */}
                            <div className="mt-4 pt-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={addActivity}
                                            className="text-xs font-medium text-ink hover:text-brand flex items-center gap-1 transition-colors py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                                        >
                                            <PlusIcon size={3.5} />
                                            <span>Agregar periodo</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={applyStandardShift}
                                            className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                                            title="Cargar jornada estándar con comida de 1 a 2 pm: 08:00 a 13:00 y 14:00 a 17:30 (8.5 h)"
                                        >
                                            <span>🍽️</span>
                                            <span>Jornada estándar con comida (1–2 pm)</span>
                                        </button>

                                        {onPreload && (
                                            <button
                                                type="button"
                                                onClick={() => onPreload(employee.empleado_id!)}
                                                className="text-xs font-semibold text-sarp-blue hover:text-sarp-dark-blue flex items-center gap-1.5 transition-colors py-1 px-2 rounded hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sarp-blue"
                                                title={`Precargar el último registro guardado de ${employee.nombre_completo}`}
                                            >
                                                <HistoryIcon size={3.5} />
                                                <span>Precargar último registro</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="text-right">
                                        <span className="text-xs text-ink3 mr-2 font-medium uppercase tracking-[0.06em]">Total día:</span>
                                        <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                                            {totalHours.toFixed(1)} h
                                        </span>
                                    </div>
                                </div>

                                {/* Barra horizontal de 6px en dos segmentos */}
                                <div className="h-1.5 rounded-full overflow-hidden flex bg-line2 w-full mt-2">
                                    <div 
                                        className="bg-ink h-full transition-all duration-300"
                                        style={{ width: `${normalWidth}%` }}
                                        title={`Normales: ${normalHours.toFixed(1)} h`}
                                    />
                                    <div 
                                        className="bg-sarp-blue h-full transition-all duration-300"
                                        style={{ width: `${extraWidth}%` }}
                                        title={`Extra: ${extraHours.toFixed(1)} h`}
                                    />
                                </div>

                                {/* Leyenda en mono */}
                                <div className="text-[0.6875rem] font-mono text-ink2 tabular-nums mt-1.5 flex flex-wrap justify-between">
                                    <span>Normales {normalHours.toFixed(1)} h · Extra {extraHours.toFixed(1)} h · Corte a las 8.5 h</span>
                                    {extraHours > 0 && (
                                        <span className="text-sarp-blue font-semibold">Horas extra activas</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
