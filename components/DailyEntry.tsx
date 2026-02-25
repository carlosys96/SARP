
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiService } from '../services/api';
import type { Empleado, Proyecto, HourTransaction } from '../types';
import { CalendarIcon, PlusIcon, TrashIcon, SaveIcon, AlertTriangleIcon, SearchIcon, MapPinIcon } from './icons/Icons';
import { useToast } from '../contexts/ToastContext';
import WeeklySummary from './WeeklySummary';

type Activity = {
    id: string;
    projectId: string;
    startTime: string; // "HH:mm"
    endTime: string; // "HH:mm"
    isSite: boolean;
};

type EmployeeData = {
    activities: Activity[];
    isAbsent: boolean;
    absenceReason: string;
};

const NON_BILLABLE_OPTIONS: Record<string, string> = {
    idle: "--- TIEMPO DISPONIBLE ---",
    varios: "--- TRABAJOS VARIOS ---",
    admin: "--- ADMINISTRACIÓN ---",
    traslados: "--- TRASLADOS ---",
};

const timeToMinutes = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
};

const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getConceptForActivity = (
    isProject: boolean,
    isSite: boolean,
    tipoHora: 'Normal' | 'Extra',
    projectNameOrConcept: string
): string => {
    if (!isProject) {
        // Para no facturables, el concepto es el nombre mismo, con formato.
        const cleaned = projectNameOrConcept.replace(/---/g, '').trim().toLowerCase();
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    // Para proyectos facturables, determinar el concepto según el tipo y la ubicación.
    if (tipoHora === 'Extra') {
        return isSite ? 'Hrs extras instalación' : 'Hrs extras';
    } 
    
    return isSite ? 'Hrs de instalación' : 'Hrs normales planta';
};


const ActivityRow: React.FC<{
    activity: Activity;
    projects: Proyecto[];
    onUpdate: (id: string, field: keyof Activity, value: any) => void;
    onRemove: (id: string) => void;
    duration: number;
    hasError: boolean;
}> = ({ activity, projects, onUpdate, onRemove, duration, hasError }) => {
    const isNonBillable = NON_BILLABLE_OPTIONS[activity.projectId];
    return (
        <div className={`flex flex-col p-4 rounded-lg border transition-all ${
            hasError ? 'border-red-500 bg-red-50' : 
            isNonBillable ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'
        }`} data-id={activity.id}>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="flex-grow w-full md:w-1/3">
                    <label className="block text-xs text-gray-500 mb-1 font-medium">Proyecto / Concepto</label>
                    <select 
                        value={activity.projectId} 
                        onChange={(e) => onUpdate(activity.id, 'projectId', e.target.value)} 
                        className={`project-select w-full border-gray-300 rounded-md text-sm focus:ring-sarp-blue focus:border-sarp-blue ${
                            isNonBillable ? 'bg-amber-100 font-semibold text-amber-900 border-amber-300' : 'bg-white'
                        }`}
                    >
                        <option value="0" disabled>Seleccione un proyecto</option>
                        {projects.map(p => <option key={p.proyecto_id} value={String(p.proyecto_id)}>{p.nombre_proyecto}</option>)}
                        <optgroup label="Conceptos Generales">
                            {Object.entries(NON_BILLABLE_OPTIONS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div><label className="block text-xs text-gray-500 mb-1 font-medium">Inicio</label><input type="time" value={activity.startTime} onChange={e => onUpdate(activity.id, 'startTime', e.target.value)} className="time-start w-full border-gray-300 rounded-md text-sm font-bold text-gray-700" /></div>
                    <div className="flex items-end pb-2 text-gray-400">-</div>
                    <div><label className="block text-xs text-gray-500 mb-1 font-medium">Fin</label><input type="time" value={activity.endTime} onChange={e => onUpdate(activity.id, 'endTime', e.target.value)} className="time-end w-full border-gray-300 rounded-md text-sm font-bold text-gray-700" /></div>
                </div>
                <div className="w-20 text-center"><label className="block text-xs text-gray-400 mb-1">Duración</label><span className="duration-text text-sm font-bold text-sarp-blue">{duration.toFixed(1)} Hrs</span></div>
                <div className="flex items-center pt-4 md:pt-0">
                    <label className="cursor-pointer select-none">
                        <input type="checkbox" className="site-checkbox sr-only" checked={activity.isSite} onChange={e => onUpdate(activity.id, 'isSite', e.target.checked)} />
                        <div className={`px-3 py-2 rounded-md border transition-colors flex items-center shadow-sm hover:bg-gray-50 ${activity.isSite ? 'bg-lime-100 border-lime-300 text-lime-800' : 'bg-white border-gray-200 text-gray-400'}`}><MapPinIcon size={4} className="mr-1.5" /><span className="text-xs font-bold">Sitio</span></div>
                    </label>
                </div>
                <button onClick={() => onRemove(activity.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors mt-4 md:mt-0 ml-auto btn-delete"><TrashIcon size={5} /></button>
            </div>
            {hasError && <div className="error-msg mt-2 text-xs text-red-600 font-bold flex items-center gap-1"><AlertTriangleIcon size={3} /> Hay un conflicto de horario con otra actividad.</div>}
        </div>
    );
};

const EmployeeCard: React.FC<{
    employee: Empleado;
    projects: Proyecto[];
    data: EmployeeData;
    errors: Set<string>;
    onUpdate: (employeeId: string, updateFn: (prev: EmployeeData) => EmployeeData) => void;
    isDisabled?: boolean;
    isComplete?: boolean;
}> = ({ employee, projects, data, errors, onUpdate, isDisabled, isComplete }) => {
    const { activities, isAbsent } = data;
    const NORMAL_WORKDAY_HOURS = 8.5;

    const updateActivities = (updateFn: (prev: Activity[]) => Activity[]) => {
        onUpdate(employee.empleado_id!, (prev: EmployeeData) => ({ ...prev, activities: updateFn(prev.activities) }));
    };

    const addActivity = () => {
        const lastActivity = activities[activities.length - 1];
        const newStartTime = lastActivity?.endTime || "08:00";
        const newActivity: Activity = { id: Date.now().toString(), projectId: "0", startTime: newStartTime, endTime: newStartTime, isSite: false };
        updateActivities(prev => [...prev, newActivity]);
    };
    
    const updateActivity = (id: string, field: keyof Activity, value: any) => {
        updateActivities(prev => prev.map(act => act.id === id ? { ...act, [field]: value } : act));
    };

    const removeActivity = (id: string) => {
        updateActivities(prev => prev.filter(act => act.id !== id));
    };

    const toggleAbsence = (checked: boolean) => {
        onUpdate(employee.empleado_id!, (prev: EmployeeData) => ({ ...prev, isAbsent: checked }));
    };

    const totalHours = useMemo(() => {
        return activities.reduce((sum, act) => {
            const start = timeToMinutes(act.startTime);
            const end = timeToMinutes(act.endTime);
            if (start !== null && end !== null && end > start) {
                return sum + (end - start);
            }
            return sum;
        }, 0) / 60;
    }, [activities]);

    const shiftRange = useMemo(() => {
        if (activities.length === 0 || isAbsent) return null;

        let minStart = Infinity;
        let maxEnd = -Infinity;

        activities.forEach(act => {
            const start = timeToMinutes(act.startTime);
            const end = timeToMinutes(act.endTime);

            if (start !== null && end !== null && end > start) {
                if (start < minStart) minStart = start;
                if (end > maxEnd) maxEnd = end;
            }
        });

        if (minStart === Infinity || maxEnd === -Infinity) return null;

        const formatMinutes = (minutes: number) => {
            const h = Math.floor(minutes / 60).toString().padStart(2, '0');
            const m = (minutes % 60).toString().padStart(2, '0');
            return `${h}:${m}`;
        };

        return `${formatMinutes(minStart)} - ${formatMinutes(maxEnd)}`;
    }, [activities, isAbsent]);

    const cardBorderClass = !isComplete && !isDisabled ? 'border-amber-400 border-2 shadow-amber-100 shadow-lg' : 'border-gray-200';

    return (
        <div className={`bg-white rounded-xl shadow-sm border overflow-hidden relative transition-all ${cardBorderClass}`}>
             {isDisabled && (
                <div className="absolute inset-0 bg-gray-100/80 flex items-center justify-center z-10 backdrop-blur-sm rounded-xl">
                    <div className="text-center p-4 bg-white/80 rounded-lg shadow-md border">
                        <p className="font-bold text-gray-700">Día Cerrado</p>
                        <p className="text-xs text-gray-500">Ya existen registros para esta fecha.</p>
                    </div>
                </div>
            )}
             <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-sarp-blue/10 flex items-center justify-center text-sarp-blue font-bold">{employee.nombre_completo.slice(0,2).toUpperCase()}</div>
                    <div><h3 className="text-lg font-bold text-gray-900">{employee.nombre_completo}</h3><span className="text-xs font-medium bg-sarp-blue/10 text-sarp-blue/80 px-2 py-0.5 rounded-full">{employee.equipo}</span></div>
                </div>
                <div className="flex items-center gap-3">
                    {!isComplete && !isDisabled && (
                        <div className="bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                            <AlertTriangleIcon size={3} />
                            <span>PENDIENTE</span>
                        </div>
                    )}
                    {shiftRange && (
                        <div className="bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold px-3 py-1.5 rounded-lg">
                            Turno: {shiftRange}
                        </div>
                    )}
                    <span className="text-sm font-medium text-gray-600">¿Ausencia?</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={isAbsent} onChange={e => toggleAbsence(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-sarp-blue peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sarp-blue"></div>
                    </label>
                </div>
            </div>

            <div className={`p-6 activities-container ${isAbsent ? 'hidden' : ''}`}>
                <div className="space-y-4 activities-list">
                    {activities.map(act => {
                         const start = timeToMinutes(act.startTime);
                         const end = timeToMinutes(act.endTime);
                         const duration = (start !== null && end !== null && end > start) ? (end - start) / 60 : 0;
                         return <ActivityRow key={act.id} activity={act} projects={projects} onUpdate={updateActivity} onRemove={removeActivity} duration={duration} hasError={errors.has(act.id)} />
                    })}
                </div>
                <button onClick={addActivity} className="btn-add-activity mt-4 text-sm text-sarp-blue font-medium hover:text-sarp-dark-blue flex items-center gap-1 px-2 py-1 rounded hover:bg-sarp-blue/10 transition-colors"><PlusIcon size={4} /> Agregar periodo</button>
                <div className="mt-2 text-right text-xs text-gray-500">Total: <span className={`total-hours-display font-bold text-lg ${totalHours > NORMAL_WORKDAY_HOURS ? 'text-orange-600 font-extrabold' : 'text-gray-800'}`}>{totalHours.toFixed(1)}</span> Hrs</div>
            </div>

            <div className={`p-6 bg-yellow-50 border-t border-yellow-100 absence-reason-container ${!isAbsent ? 'hidden' : ''}`}>
                <div className="flex items-center gap-4">
                    <div className="flex-grow">
                        <label className="block text-sm font-bold text-yellow-800 mb-1">Motivo de la Ausencia</label>
                        <select onChange={e => onUpdate(employee.empleado_id!, (prev) => ({...prev, absenceReason: e.target.value}))} className="w-full md:w-1/2 border-yellow-300 bg-white rounded-md text-sm"><option>Vacaciones</option><option>Incapacidad</option><option>Falta</option><option>Permiso</option></select>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DailyEntry: React.FC = () => {
    const [activeView, setActiveView] = useState<'capture' | 'summary'>('capture');
    const [employees, setEmployees] = useState<Empleado[]>([]);
    const [projects, setProjects] = useState<Proyecto[]>([]);
    const [entryData, setEntryData] = useState<Map<string, EmployeeData>>(new Map());
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Map<string, Set<string>>>(new Map());
    const [isDayLocked, setIsDayLocked] = useState(false);
    const [incompleteEmployeeIds, setIncompleteEmployeeIds] = useState<Set<string>>(new Set());
    const { addToast } = useToast();

    useEffect(() => {
        const fetchCatalogs = async () => {
            setIsLoading(true);
            try {
                const [empData, projData] = await Promise.all([
                    apiService.getEmployees(),
                    apiService.getProjects()
                ]);
                const activeEmployees = empData.filter(e => e.activo);
                const openProjects = projData.filter(p => p.estatus !== 'Terminado');
                setEmployees(activeEmployees);
                setProjects(openProjects);

                const initialData = new Map<string, EmployeeData>();
                activeEmployees.forEach(e => {
                    initialData.set(e.empleado_id!, { activities: [], isAbsent: false, absenceReason: 'Vacaciones' });
                });
                setEntryData(initialData);
            } catch (error) {
                addToast('Error al cargar catálogos.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchCatalogs();
    }, [addToast]);
    
    useEffect(() => {
        const checkForExistingRecords = async () => {
            if (!currentDate) return;
            setIsLoading(true);
            try {
                const transactions = await apiService.getHourTransactions({ startDate: currentDate, endDate: currentDate });
                if (transactions.length > 0) {
                    setIsDayLocked(true);
                } else {
                    setIsDayLocked(false);
                }
            } catch (error) {
                addToast('Error al verificar registros existentes.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        checkForExistingRecords();
    }, [currentDate, addToast]);

    // FIX: Refactored the update function to be more explicit for the TypeScript compiler, resolving a type inference issue.
    const updateEmployeeData = useCallback((employeeId: string, updateFn: (prev: EmployeeData) => EmployeeData) => {
        setEntryData(prevMap => {
            const current = prevMap.get(employeeId);
            if (!current) {
                return prevMap; // If employee not found, return the original map without changes.
            }
    
            const updatedData = updateFn(current);
            const newMap = new Map(prevMap);
            newMap.set(employeeId, updatedData);
            return newMap;
        });
    }, []);

    useEffect(() => {
        const newErrors = new Map<string, Set<string>>();
        const newIncompleteIds = new Set<string>();

        employees.forEach(emp => {
            const data = entryData.get(emp.empleado_id!);
            if (!data) return;

            // Check for incompleteness
            const hasNoValidActivities = data.activities.length === 0 || data.activities.every(act => {
                const start = timeToMinutes(act.startTime);
                const end = timeToMinutes(act.endTime);
                return !start || !end || end <= start;
            });
            if (!data.isAbsent && hasNoValidActivities) {
                newIncompleteIds.add(emp.empleado_id!);
            }

            // Check for time overlaps
            if (data.isAbsent) return;
            const employeeErrors = new Set<string>();
            const intervals = data.activities.map(act => ({
                id: act.id,
                start: timeToMinutes(act.startTime),
                end: timeToMinutes(act.endTime),
            })).filter(i => i.start !== null && i.end !== null && i.end > i.start);

            for (let i = 0; i < intervals.length; i++) {
                for (let j = i + 1; j < intervals.length; j++) {
                    const a = intervals[i];
                    const b = intervals[j];
                    if (a.start! < b.end! && a.end! > b.start!) {
                        employeeErrors.add(a.id);
                        employeeErrors.add(b.id);
                    }
                }
            }
            if (employeeErrors.size > 0) {
                newErrors.set(emp.empleado_id!, employeeErrors);
            }
        });
        setValidationErrors(newErrors);
        setIncompleteEmployeeIds(newIncompleteIds);
    }, [entryData, employees]);


    const filteredEmployees = useMemo(() => {
        if (!searchTerm) return employees;
        return employees.filter(e => e.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [employees, searchTerm]);

    const handleSave = async () => {
        if (isDayLocked) {
            addToast("No se puede guardar. Ya existen registros para esta fecha.", 'error');
            return;
        }
        if (incompleteEmployeeIds.size > 0) {
            addToast(`No se puede guardar. Faltan ${incompleteEmployeeIds.size} empleado(s) por registrar.`, 'error');
            return;
        }
        if (validationErrors.size > 0) {
            addToast("No se puede guardar. Hay conflictos de horario en uno o más empleados.", 'error');
            return;
        }

        setIsSaving(true);
        const transactions: Omit<HourTransaction, 'transaccion_id' | '_row'>[] = [];
        const date = new Date(currentDate);
        const weekNum = getWeekNumber(date);
        const MAX_NORMAL_HOURS = 8.5;

        entryData.forEach((data, employeeId) => {
            const employee = employees.find(e => e.empleado_id === employeeId);
            if (!employee) return;

            if (data.isAbsent) {
                transactions.push({
                    proyecto_id: 0,
                    nombre_proyecto: data.absenceReason,
                    empleado_id: employeeId,
                    nombre_completo_empleado: employee.nombre_completo,
                    fecha_registro: currentDate,
                    semana_del_anio: weekNum,
                    horas_registradas: 8,
                    costo_hora_real: employee.costo_hora,
                    costo_total_mo: 8 * employee.costo_hora,
                    tipo_hora: 'Normal',
                    is_site: false,
                    concept: data.absenceReason
                });
                return;
            }
            
            let accumulatedHours = 0;
            const sortedActivities = data.activities
                .filter(act => {
                    const start = timeToMinutes(act.startTime);
                    const end = timeToMinutes(act.endTime);
                    return start !== null && end !== null && end > start;
                })
                .sort((a, b) => timeToMinutes(a.startTime)! - timeToMinutes(b.startTime)!);

            sortedActivities.forEach(act => {
                const start = timeToMinutes(act.startTime);
                const end = timeToMinutes(act.endTime);
                const duration = (end! - start!) / 60;

                const isProject = !NON_BILLABLE_OPTIONS[act.projectId];
                const nombreProyecto = isProject ? (projects.find(p => p.proyecto_id === Number(act.projectId))?.nombre_proyecto || 'N/A') : NON_BILLABLE_OPTIONS[act.projectId];
                
                const baseTransaction = {
                    proyecto_id: isProject ? Number(act.projectId) : 0,
                    nombre_proyecto: nombreProyecto,
                    empleado_id: employeeId,
                    nombre_completo_empleado: employee.nombre_completo,
                    fecha_registro: currentDate,
                    semana_del_anio: weekNum,
                    is_site: act.isSite,
                };

                if (accumulatedHours >= MAX_NORMAL_HOURS) {
                    transactions.push({ ...baseTransaction, horas_registradas: duration, costo_hora_real: employee.costo_hora_extra || employee.costo_hora, costo_total_mo: duration * (employee.costo_hora_extra || employee.costo_hora), tipo_hora: 'Extra', concept: getConceptForActivity(isProject, act.isSite, 'Extra', nombreProyecto) });
                } else if (accumulatedHours + duration > MAX_NORMAL_HOURS) {
                    const normalHoursPart = MAX_NORMAL_HOURS - accumulatedHours;
                    const extraHoursPart = duration - normalHoursPart;
                    if (normalHoursPart > 0.01) transactions.push({ ...baseTransaction, horas_registradas: normalHoursPart, costo_hora_real: employee.costo_hora, costo_total_mo: normalHoursPart * employee.costo_hora, tipo_hora: 'Normal', concept: getConceptForActivity(isProject, act.isSite, 'Normal', nombreProyecto) });
                    if (extraHoursPart > 0.01) transactions.push({ ...baseTransaction, horas_registradas: extraHoursPart, costo_hora_real: employee.costo_hora_extra || employee.costo_hora, costo_total_mo: extraHoursPart * (employee.costo_hora_extra || employee.costo_hora), tipo_hora: 'Extra', concept: getConceptForActivity(isProject, act.isSite, 'Extra', nombreProyecto) });
                } else {
                    transactions.push({ ...baseTransaction, horas_registradas: duration, costo_hora_real: employee.costo_hora, costo_total_mo: duration * employee.costo_hora, tipo_hora: 'Normal', concept: getConceptForActivity(isProject, act.isSite, 'Normal', nombreProyecto) });
                }
                accumulatedHours += duration;
            });
        });

        if(transactions.length === 0){
            addToast("No hay horas registradas para guardar.", 'info');
            setIsSaving(false);
            return;
        }

        try {
            await apiService.batchAddHourTransactions(transactions);
            addToast(`${transactions.length} registros de tiempo guardados exitosamente.`, 'success');
            const initialData = new Map<string, EmployeeData>();
            employees.forEach(e => { initialData.set(e.empleado_id!, { activities: [], isAbsent: false, absenceReason: 'Vacaciones' }); });
            setEntryData(initialData);
            setIsDayLocked(true); // Lock the day after successful save
        } catch (error) {
            addToast("Error al guardar los registros.", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="text-center p-8">Cargando...</div>;
    }
    
    const renderCaptureView = () => {
        let saveButtonMessage = 'Todos los registros son válidos.';
        let messageColor = 'text-green-600';

        if (isDayLocked) {
            saveButtonMessage = 'Día cerrado. Ya existen registros para esta fecha.';
            messageColor = 'text-yellow-700 font-bold';
        } else if (incompleteEmployeeIds.size > 0) {
            saveButtonMessage = `${incompleteEmployeeIds.size} empleado(s) sin registrar. Complete todos para guardar.`;
            messageColor = 'text-amber-600 font-bold';
        } else if (validationErrors.size > 0) {
            saveButtonMessage = `${validationErrors.size} empleado(s) con conflictos de horario.`;
            messageColor = 'text-red-600 font-bold';
        }

        const isSaveDisabled = isSaving || validationErrors.size > 0 || isDayLocked || incompleteEmployeeIds.size > 0;

        return (
            <>
                {isDayLocked && (
                    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 mb-6 rounded-r-lg shadow" role="alert">
                        <p className="font-bold">Día Bloqueado</p>
                        <p>Ya se han guardado registros para esta fecha. Para realizar cambios, por favor diríjase a la sección de <strong>Históricos</strong>.</p>
                    </div>
                )}
                <div className={`relative w-full md:w-1/3 ${isDayLocked ? 'pointer-events-none opacity-50' : ''}`}>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon size={5} className="text-gray-400" /></div>
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sarp-blue" placeholder="Buscar empleado..." />
                </div>
                <main className="space-y-6 mt-6">
                    {filteredEmployees.map(emp => (
                        <EmployeeCard
                            key={emp.empleado_id}
                            employee={emp}
                            projects={projects}
                            data={entryData.get(emp.empleado_id!)!}
                            errors={validationErrors.get(emp.empleado_id!) || new Set()}
                            onUpdate={updateEmployeeData}
                            isDisabled={isDayLocked}
                            isComplete={!incompleteEmployeeIds.has(emp.empleado_id!)}
                        />
                    ))}
                </main>
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-30">
                    <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 lg:px-8">
                         <span className={`font-medium text-sm flex items-center gap-2 ${messageColor}`}>
                            {(isDayLocked || incompleteEmployeeIds.size > 0 || validationErrors.size > 0) && <AlertTriangleIcon size={4}/>}
                            {saveButtonMessage}
                        </span>
                        <button onClick={handleSave} disabled={isSaveDisabled} className="px-6 py-2 bg-sarp-blue text-white font-bold rounded-lg hover:bg-sarp-dark-blue shadow-md flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
                            {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <SaveIcon size={4} />}
                            Guardar Registros del Día
                        </button>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="pb-24">
            <header className="bg-white p-4 rounded-xl shadow-md border border-gray-200 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex bg-gray-100 p-1 rounded-lg shadow-inner">
                    <button onClick={() => setActiveView('capture')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeView === 'capture' ? 'bg-white text-sarp-blue shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Captura Diaria</button>
                    <button onClick={() => setActiveView('summary')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeView === 'summary' ? 'bg-white text-sarp-blue shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Resumen Semanal</button>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <CalendarIcon size={5} className="text-gray-500" />
                    <input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} className="border-gray-300 rounded-md text-sm focus:ring-sarp-blue focus:border-sarp-blue p-1 bg-transparent font-bold" />
                </div>
            </header>
            {activeView === 'capture' ? renderCaptureView() : <WeeklySummary currentDate={currentDate} allEmployees={employees} allProjects={projects} />}
        </div>
    );
};

export default DailyEntry;
