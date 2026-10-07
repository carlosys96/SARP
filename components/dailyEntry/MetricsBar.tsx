import React, { useMemo } from 'react';
import type { Empleado } from '../../types';
import { type EmployeeData, NON_BILLABLE_OPTIONS, timeToMinutes, calculateActivityDuration, getEffectiveInterval, MAX_NORMAL_HOURS } from './dailyEntryTypes';

interface MetricsBarProps {
    employees: Empleado[];
    entryData: Map<string, EmployeeData>;
    lockedEmployeeIds: Set<string>;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
    employees,
    entryData,
    lockedEmployeeIds
}) => {
    const metrics = useMemo(() => {
        // Filtrar solo empleados activos no bloqueados
        const activeEmployees = employees.filter(
            emp => emp.activo && emp.empleado_id && !lockedEmployeeIds.has(emp.empleado_id)
        );

        const totalActive = activeEmployees.length;
        let capturedCount = 0;
        let totalDayHours = 0;
        let totalExtraHours = 0;
        let billableHours = 0;

        activeEmployees.forEach(emp => {
            const data = entryData.get(emp.empleado_id!);
            if (!data) return;

            if (data.isAbsent) {
                capturedCount++;
                const absentHours = 8;
                totalDayHours += absentHours;
                return;
            }

            // Calcular horas de actividades
            let empHours = 0;
            let empBillableHours = 0;
            const validActivities: { duration: number; isBillable: boolean; startMin: number }[] = [];

            data.activities.forEach(act => {
                const duration = calculateActivityDuration(act.startTime, act.endTime);
                if (duration > 0) {
                    const isBillable = !NON_BILLABLE_OPTIONS[act.projectId] && act.projectId !== "0";
                    const interval = getEffectiveInterval(act.startTime, act.endTime);
                    validActivities.push({ duration, isBillable, startMin: interval?.start || 0 });
                }
            });

            if (validActivities.length > 0) {
                capturedCount++;
                validActivities.forEach(item => {
                    empHours += item.duration;
                    if (item.isBillable) {
                        empBillableHours += item.duration;
                    }
                });

                totalDayHours += empHours;
                billableHours += empBillableHours;
                if (empHours > MAX_NORMAL_HOURS) {
                    totalExtraHours += (empHours - MAX_NORMAL_HOURS);
                }
            }
        });

        const billablePercent = totalDayHours > 0 
            ? ((billableHours / totalDayHours) * 100).toFixed(1) 
            : '0.0';

        return {
            totalActive,
            capturedCount,
            totalDayHours: totalDayHours.toFixed(1),
            totalExtraHours: totalExtraHours.toFixed(1),
            extraHoursRaw: totalExtraHours,
            billablePercent
        };
    }, [employees, entryData, lockedEmployeeIds]);

    return (
        <div 
            id="daily-entry-metrics-bar"
            className="w-full bg-surface border border-line rounded-lg divide-x divide-line shadow-sm overflow-x-auto flex items-stretch mb-5"
        >
            <div className="flex-1 min-w-[130px] py-2.5 px-4 flex flex-col justify-center">
                <span className="text-[0.6875rem] uppercase tracking-[0.09em] font-medium text-ink3 mb-1 truncate">
                    Cuadrilla activa
                </span>
                <span className="text-[1.0625rem] font-mono font-semibold tabular-nums text-ink">
                    {metrics.totalActive}
                </span>
            </div>

            <div className="flex-1 min-w-[130px] py-2.5 px-4 flex flex-col justify-center">
                <span className="text-[0.6875rem] uppercase tracking-[0.09em] font-medium text-ink3 mb-1 truncate">
                    Capturados
                </span>
                <span className="text-[1.0625rem] font-mono font-semibold tabular-nums text-ink">
                    {metrics.capturedCount} <span className="text-xs text-ink3 font-normal">/ {metrics.totalActive}</span>
                </span>
            </div>

            <div className="flex-1 min-w-[130px] py-2.5 px-4 flex flex-col justify-center">
                <span className="text-[0.6875rem] uppercase tracking-[0.09em] font-medium text-ink3 mb-1 truncate">
                    Horas del día
                </span>
                <span className="text-[1.0625rem] font-mono font-semibold tabular-nums text-ink">
                    {metrics.totalDayHours} <span className="text-xs text-ink3 font-normal">h</span>
                </span>
            </div>

            <div className="flex-1 min-w-[130px] py-2.5 px-4 flex flex-col justify-center">
                <span className="text-[0.6875rem] uppercase tracking-[0.09em] font-medium text-ink3 mb-1 truncate">
                    Horas extra
                </span>
                <span className={`text-[1.0625rem] font-mono font-semibold tabular-nums ${metrics.extraHoursRaw > 0 ? 'text-sarp-blue font-bold' : 'text-ink'}`}>
                    {metrics.totalExtraHours} <span className="text-xs font-normal opacity-80">h</span>
                </span>
            </div>

            <div className="flex-1 min-w-[130px] py-2.5 px-4 flex flex-col justify-center">
                <span className="text-[0.6875rem] uppercase tracking-[0.09em] font-medium text-ink3 mb-1 truncate">
                    % Facturable
                </span>
                <span className="text-[1.0625rem] font-mono font-semibold tabular-nums text-ink">
                    {metrics.billablePercent}%
                </span>
            </div>
        </div>
    );
};
