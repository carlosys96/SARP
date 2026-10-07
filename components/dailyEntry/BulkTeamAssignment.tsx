import React, { useState } from 'react';
import type { Proyecto } from '../../types';
import type { Activity } from './dailyEntryTypes';
import { 
    NON_BILLABLE_OPTIONS, 
    timeToMinutes, 
    calculateActivityDuration, 
    getSuggestedCorrection,
    LUNCH_START,
    LUNCH_END,
    STANDARD_SHIFT_BLOCKS 
} from './dailyEntryTypes';
import { PlusIcon, TrashIcon, MapPinIcon, HistoryIcon } from '../icons/Icons';
import { Time24Input } from './Time24Input';

interface BulkTeamAssignmentProps {
    teamName: string;
    projects: Proyecto[];
    isOpen: boolean;
    onClose: () => void;
    onApply: (activities: Omit<Activity, 'id'>[]) => void;
    onPreloadTeam?: () => void;
}

export const BulkTeamAssignment: React.FC<BulkTeamAssignmentProps> = ({
    teamName,
    projects,
    isOpen,
    onClose,
    onApply,
    onPreloadTeam,
}) => {
    // Por defecto: Jornada estándar mexicana de 8.5h con 1 hora de comida de 1 a 2 pm (13:00 a 14:00)
    const [activities, setActivities] = useState<Omit<Activity, 'id'>[]>([
        { projectId: "0", startTime: "08:00", endTime: "13:00", isSite: false },
        { projectId: "0", startTime: "14:00", endTime: "17:30", isSite: false }
    ]);

    const handleResetStandardShift = () => {
        const baseProj = activities[0]?.projectId || "0";
        const baseSite = activities[0]?.isSite || false;
        setActivities([
            { projectId: baseProj, startTime: "08:00", endTime: "13:00", isSite: baseSite },
            { projectId: baseProj, startTime: "14:00", endTime: "17:30", isSite: baseSite }
        ]);
    };

    const handleCopyProjectToAll = () => {
        const firstProj = activities[0]?.projectId || "0";
        const firstSite = activities[0]?.isSite || false;
        setActivities(prev => prev.map(a => ({ ...a, projectId: firstProj, isSite: firstSite })));
    };

    const handleAddActivity = () => {
        const last = activities[activities.length - 1];
        let newStart = "08:00";
        let newEnd = "13:00";
        if (last) {
            // Si el bloque anterior termina a las 13:00 (hora de comida), el siguiente arranca a las 14:00
            if (last.endTime === "13:00") {
                newStart = "14:00";
                newEnd = "17:30";
            } else {
                newStart = last.endTime;
                newEnd = last.endTime;
            }
        }
        setActivities(prev => [
            ...prev,
            { projectId: last?.projectId || "0", startTime: newStart, endTime: newEnd, isSite: last?.isSite || false }
        ]);
    };

    const handleUpdateActivity = (index: number, field: keyof Omit<Activity, 'id'>, value: any) => {
        setActivities(prev => prev.map((act, i) => i === index ? { ...act, [field]: value } : act));
    };

    const handleRemoveActivity = (index: number) => {
        if (activities.length <= 1) return;
        setActivities(prev => prev.filter((_, i) => i !== index));
    };

    const hasInvalidProject = activities.some(act => act.projectId === "0");

    const handleApply = () => {
        if (hasInvalidProject) return;
        onApply(activities);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div 
            id={`bulk-assignment-panel-${teamName.replace(/\s+/g, '-').toLowerCase()}`}
            className="w-full bg-surface2 border-b border-line p-4 transition-all duration-[280ms] ease-exponential animate-fadeIn"
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line2 mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-[0.6875rem] uppercase tracking-[0.09em] font-extrabold text-ink">
                        Carga Masiva para {teamName}
                    </span>
                    <span className="text-xs font-mono text-ink3 tabular-nums">
                        ({activities.length} bloque{activities.length > 1 ? 's' : ''})
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {onPreloadTeam && (
                        <button
                            type="button"
                            onClick={onPreloadTeam}
                            className="px-2.5 py-1 text-xs font-medium text-sarp-blue bg-white border border-gray-200 rounded hover:bg-blue-50 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sarp-blue"
                            title={`Precargar el último registro de cada miembro de ${teamName}`}
                        >
                            <HistoryIcon size={3.5} />
                            <span>Precargar último del equipo</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleResetStandardShift}
                        className="px-2.5 py-1 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors flex items-center gap-1"
                        title="Restablecer jornada estándar: 08:00 a 13:00 y 14:00 a 17:30 (Comida 1 a 2 pm)"
                    >
                        <span>🍽️</span>
                        <span>Jornada estándar con comida</span>
                    </button>
                    {activities.length > 1 && activities[0].projectId !== "0" && (
                        <button
                            type="button"
                            onClick={handleCopyProjectToAll}
                            className="px-2 py-1 text-xs font-medium text-slate-700 bg-surface border border-line rounded hover:bg-surface2 transition-colors"
                            title="Copiar el proyecto del primer bloque a los demás bloques"
                        >
                            Copiar proyecto a todos
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleAddActivity}
                        className="px-2.5 py-1 text-xs font-medium text-ink bg-surface border border-line rounded hover:bg-surface2 transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                        <PlusIcon size={3.5} /> Añadir bloque
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={hasInvalidProject}
                        className="px-3.5 py-1 text-xs font-semibold text-surface bg-ink rounded hover:bg-ink2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                        Aplicar al equipo
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs text-ink3 hover:text-ink px-2 py-1 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>

            {/* Aviso explicativo de la hora de comida estándar */}
            <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200/70 flex items-center justify-between text-xs text-amber-900 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm">🍽️</span>
                    <span><strong>Hora estándar de comida:</strong> 13:00 a 14:00 (1:00 PM a 2:00 PM). Jornada normal de 8.5 h laborales (08:00–13:00 y 14:00–17:30).</span>
                </div>
                <div className="font-mono text-xs font-bold text-amber-950">
                    Total turno: {activities.reduce((s, a) => s + calculateActivityDuration(a.startTime, a.endTime), 0).toFixed(1)} h
                </div>
            </div>

            <div className="space-y-3">
                {activities.map((act, index) => {
                    const isNonBillable = Boolean(NON_BILLABLE_OPTIONS[act.projectId]);
                    const duration = calculateActivityDuration(act.startTime, act.endTime);
                    const suggestion = getSuggestedCorrection(act.startTime, act.endTime);
                    const isAfterLunch = index > 0 && activities[index - 1].endTime === '13:00' && act.startTime === '14:00';

                    return (
                        <React.Fragment key={index}>
                            {/* Separador de descanso para comida 1:00 PM a 2:00 PM */}
                            {isAfterLunch && (
                                <div className="flex items-center justify-between px-3 py-1.5 bg-amber-100/70 border border-amber-300/80 rounded-md text-amber-950 text-xs my-1 font-medium">
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
                                className="grid grid-cols-1 md:grid-cols-[minmax(190px,1fr)_auto_66px_auto_30px] items-end gap-3 pb-3 border-b border-dashed border-line2"
                            >
                            {/* Col 1: Proyecto / Concepto */}
                            <div>
                                <label className="block text-[0.625rem] uppercase tracking-[0.09em] font-semibold text-ink3 mb-1">
                                    Proyecto / Concepto
                                </label>
                                <select
                                    value={act.projectId}
                                    onChange={e => handleUpdateActivity(index, 'projectId', e.target.value)}
                                    className={`w-full text-xs py-1.5 px-2.5 rounded border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                                        isNonBillable 
                                            ? 'bg-slate-50 border-slate-300 text-slate-700 font-medium' 
                                            : 'bg-surface border-line text-ink'
                                    }`}
                                >
                                    <option value="0" disabled>Seleccionar...</option>
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

                            {/* Col 2: Horarios Inicio-Fin (Formato 24h) */}
                            <div>
                                <label className="block text-[0.625rem] uppercase tracking-[0.09em] font-semibold text-ink3 mb-1">
                                    Horario (24h)
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <Time24Input
                                        value={act.startTime}
                                        onChange={val => handleUpdateActivity(index, 'startTime', val)}
                                        ariaLabel={`Hora inicio bloque ${index + 1} (24h)`}
                                    />
                                    <span className="text-ink3 text-xs font-semibold">–</span>
                                    <Time24Input
                                        value={act.endTime}
                                        onChange={val => handleUpdateActivity(index, 'endTime', val)}
                                        ariaLabel={`Hora fin bloque ${index + 1} (24h)`}
                                    />
                                </div>
                            </div>

                            {/* Col 3: Duración */}
                            <div className="w-[66px] text-center">
                                <label className="block text-[0.625rem] uppercase tracking-[0.09em] font-semibold text-ink3 mb-1">
                                    Duración
                                </label>
                                <div className="py-1 px-1 text-xs font-mono font-semibold tabular-nums text-ink bg-surface border border-line rounded">
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
                                        onChange={e => handleUpdateActivity(index, 'isSite', e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className={`px-2.5 py-1 rounded border text-xs font-medium flex items-center gap-1 transition-colors min-h-[30px] ${
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
                                    onClick={() => handleRemoveActivity(index)}
                                    disabled={activities.length <= 1}
                                    className="w-[30px] h-[30px] flex items-center justify-center text-ink3 hover:text-brand disabled:opacity-20 transition-colors"
                                    title="Eliminar bloque"
                                    aria-label="Eliminar bloque"
                                >
                                    <TrashIcon size={4} />
                                </button>
                            </div>

                            {/* Sugerencia de hora de la tarde si se digitó formato 12h */}
                            {suggestion && (
                                <div className="col-span-1 md:col-span-5 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded px-2.5 py-1 flex items-center justify-between gap-2 flex-wrap">
                                    <span>💡 ¿Hora de fin es de la tarde ({suggestion.label})?</span>
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateActivity(index, 'endTime', suggestion.suggestedTime)}
                                        className="px-2 py-0.5 bg-sarp-blue text-white rounded font-semibold text-[0.6875rem] hover:bg-sarp-dark-blue transition-colors"
                                    >
                                        Aplicar {suggestion.suggestedTime}
                                    </button>
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                );
                })}
            </div>

            <p className="mt-3 text-[0.75rem] text-ink3 italic">
                Se aplica solo a miembros sin ausencia y sin registros previos.
            </p>
        </div>
    );
};
