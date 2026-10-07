import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiService } from '../services/api';
import type { Empleado, Proyecto, HourTransaction } from '../types';
import { 
    CalendarIcon, 
    SearchIcon, 
    SaveIcon, 
    AlertTriangleIcon, 
    CheckCircleIcon,
    AlertCircleIcon,
    HistoryIcon
} from './icons/Icons';
import { useToast } from '../contexts/ToastContext';
import WeeklySummary from './WeeklySummary';

import { 
    type Activity, 
    type EmployeeData, 
    NON_BILLABLE_OPTIONS, 
    TEAM_ORDER, 
    timeToMinutes,
    calculateActivityDuration,
    getEffectiveInterval,
    
    getWeekNumber, 
    getConceptForActivity, 
    MAX_NORMAL_HOURS 
} from './dailyEntry/dailyEntryTypes';
import { MetricsBar } from './dailyEntry/MetricsBar';
import { EmployeeRow } from './dailyEntry/EmployeeRow';
import { BulkTeamAssignment } from './dailyEntry/BulkTeamAssignment';
import { SavedTransactionsTable } from './dailyEntry/SavedTransactionsTable';
import { 
    getLastRecordForEmployee, 
    saveLastEntriesToStorage 
} from './dailyEntry/preloadService';

// Formateo de fecha larga en español para días cerrados
const formatLongDate = (dateStr: string): string => {
    try {
        const [year, month, day] = dateStr.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        const formatted = d.toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
        return dateStr;
    }
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
    const [lockedEmployeeIds, setLockedEmployeeIds] = useState<Set<string>>(new Set());
    const [incompleteEmployeeIds, setIncompleteEmployeeIds] = useState<Set<string>>(new Set());
    const [openBulkTeam, setOpenBulkTeam] = useState<string | null>(null);
    const [savedTransactions, setSavedTransactions] = useState<Omit<HourTransaction, 'transaccion_id' | '_row'>[] | null>(null);
    const [historyTransactions, setHistoryTransactions] = useState<HourTransaction[]>([]);
    const [isPreloading, setIsPreloading] = useState<boolean>(false);

    const { addToast } = useToast();

    // Carga de historial de transacciones para precarga rápida
    useEffect(() => {
        let isMounted = true;
        const fetchHistory = async () => {
            try {
                const tx = await apiService.getHourTransactions();
                if (isMounted) {
                    setHistoryTransactions(tx);
                }
            } catch (err) {
                console.warn('Error al cargar historial de transacciones:', err);
            }
        };
        fetchHistory();
        return () => { isMounted = false; };
    }, []);

    // 1. Carga inicial de catálogos
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
                addToast('Error al cargar catálogos de empleados y proyectos.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchCatalogs();
    }, [addToast]);

    // 2. Verificación de registros existentes para la fecha
    useEffect(() => {
        const checkForExistingRecords = async () => {
            if (!currentDate) return;
            setIsLoading(true);
            try {
                const transactions = await apiService.getHourTransactions({ startDate: currentDate, endDate: currentDate });
                const locked = new Set(transactions.map(t => String(t.empleado_id)));
                setLockedEmployeeIds(locked);
                setSavedTransactions(null); // Limpiar resultado post guardado si cambia la fecha
            } catch (error) {
                addToast('Error al verificar registros existentes para la fecha seleccionada.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        checkForExistingRecords();
    }, [currentDate, addToast]);

    // 3. Actualización de datos de empleado
    const updateEmployeeData = useCallback((employeeId: string, updateFn: (prev: EmployeeData) => EmployeeData) => {
        setEntryData(prevMap => {
            const current = prevMap.get(employeeId);
            if (!current) return prevMap;

            const updatedData = updateFn(current);
            const newMap = new Map(prevMap);
            newMap.set(employeeId, updatedData);
            return newMap;
        });
    }, []);

    // Precarga individual por empleado
    const handlePreloadEmployee = useCallback(async (employeeId: string) => {
        if (lockedEmployeeIds.has(employeeId)) {
            addToast('Este empleado ya cuenta con registros guardados para hoy.', 'info');
            return;
        }

        const emp = employees.find(e => e.empleado_id === employeeId);
        let allTx = historyTransactions;
        if (allTx.length === 0) {
            try {
                allTx = await apiService.getHourTransactions();
                setHistoryTransactions(allTx);
            } catch {
                // Continuar con lo que exista en localStorage
            }
        }

        const result = getLastRecordForEmployee(employeeId, currentDate, allTx);
        if (result) {
            setEntryData(prev => {
                const next = new Map(prev);
                next.set(employeeId, result.data);
                return next;
            });
            const formattedDate = formatLongDate(result.sourceDate);
            addToast(`Se precargó el último registro de ${emp?.nombre_completo || 'empleado'} (${formattedDate}).`, 'success');
        } else {
            addToast(`No se encontró ningún registro previo para ${emp?.nombre_completo || 'este empleado'}.`, 'info');
        }
    }, [lockedEmployeeIds, employees, historyTransactions, currentDate, addToast]);

    // Precarga por equipo
    const handlePreloadTeam = useCallback(async (teamName: string, teamEmployees: Empleado[]) => {
        const candidates = teamEmployees.filter(emp => !lockedEmployeeIds.has(emp.empleado_id!));
        if (candidates.length === 0) {
            addToast(`Todos los miembros de ${teamName} ya cuentan con registros guardados para hoy.`, 'info');
            return;
        }

        setIsPreloading(true);
        try {
            let allTx = historyTransactions;
            if (allTx.length === 0) {
                try {
                    allTx = await apiService.getHourTransactions();
                    setHistoryTransactions(allTx);
                } catch (err) {
                    console.warn('Error al obtener transacciones:', err);
                }
            }

            let preloadedCount = 0;
            setEntryData(prev => {
                const next = new Map(prev);
                candidates.forEach(emp => {
                    const res = getLastRecordForEmployee(emp.empleado_id!, currentDate, allTx);
                    if (res) {
                        next.set(emp.empleado_id!, res.data);
                        preloadedCount++;
                    }
                });
                return next;
            });

            if (preloadedCount > 0) {
                addToast(`Se precargó el último registro para ${preloadedCount} de ${candidates.length} integrante(s) de ${teamName}.`, 'success');
            } else {
                addToast(`No se encontraron registros previos para los miembros de ${teamName}.`, 'info');
            }
        } finally {
            setIsPreloading(false);
        }
    }, [lockedEmployeeIds, historyTransactions, currentDate, addToast]);

    // Precarga global de todo el día
    const handlePreloadAll = useCallback(async () => {
        const candidates = employees.filter(emp => !lockedEmployeeIds.has(emp.empleado_id!));
        if (candidates.length === 0) {
            addToast('Todos los empleados ya cuentan con registros guardados para hoy.', 'info');
            return;
        }

        setIsPreloading(true);
        try {
            let allTx = historyTransactions;
            if (allTx.length === 0) {
                try {
                    allTx = await apiService.getHourTransactions();
                    setHistoryTransactions(allTx);
                } catch (err) {
                    console.warn('Error al obtener transacciones:', err);
                }
            }

            let preloadedCount = 0;
            setEntryData(prev => {
                const next = new Map(prev);
                candidates.forEach(emp => {
                    const res = getLastRecordForEmployee(emp.empleado_id!, currentDate, allTx);
                    if (res) {
                        next.set(emp.empleado_id!, res.data);
                        preloadedCount++;
                    }
                });
                return next;
            });

            if (preloadedCount > 0) {
                addToast(`Se precargó el último registro para ${preloadedCount} de ${candidates.length} empleado(s).`, 'success');
            } else {
                addToast('No se encontraron registros previos para los empleados.', 'info');
            }
        } finally {
            setIsPreloading(false);
        }
    }, [employees, lockedEmployeeIds, historyTransactions, currentDate, addToast]);

    // Asignar jornada estándar (8.5 h con hora de comida de 1 a 2 pm) a empleados pendientes sin periodos
    const handleApplyStandardShiftAll = useCallback(() => {
        const candidates = employees.filter(emp => !lockedEmployeeIds.has(emp.empleado_id!));
        if (candidates.length === 0) {
            addToast('Todos los empleados ya cuentan con registros guardados para hoy.', 'info');
            return;
        }

        let assignedCount = 0;
        setEntryData(prev => {
            const next = new Map(prev);
            candidates.forEach(emp => {
                const currentData = next.get(emp.empleado_id!);
                if (currentData && !currentData.isAbsent && currentData.activities.length === 0) {
                    assignedCount++;
                    next.set(emp.empleado_id!, {
                        ...currentData,
                        activities: [
                            {
                                id: `${Date.now()}-1-${emp.empleado_id}`,
                                projectId: "0",
                                startTime: '08:00',
                                endTime: '13:00',
                                isSite: false
                            },
                            {
                                id: `${Date.now()}-2-${emp.empleado_id}`,
                                projectId: "0",
                                startTime: '14:00',
                                endTime: '17:30',
                                isSite: false
                            }
                        ]
                    });
                }
            });
            return next;
        });

        if (assignedCount > 0) {
            addToast(`Se cargó la jornada estándar con comida (1–2 pm) a ${assignedCount} empleado(s). Asigne los proyectos correspondientes.`, 'success');
        } else {
            addToast('Los empleados pendientes ya cuentan con periodos registrados o están marcados ausentes.', 'info');
        }
    }, [employees, lockedEmployeeIds, addToast]);

    // 4. Validación continua de traslapes e incompletos
    useEffect(() => {
        const newErrors = new Map<string, Set<string>>();
        const newIncompleteIds = new Set<string>();

        employees.forEach(emp => {
            if (lockedEmployeeIds.has(emp.empleado_id!)) return;

            const data = entryData.get(emp.empleado_id!);
            if (!data) return;

            // Verificar incompletitud (debe tener al menos una actividad válida con duración > 0)
            const hasNoValidActivities = data.activities.length === 0 || data.activities.every(act => {
                return calculateActivityDuration(act.startTime, act.endTime) <= 0;
            });

            if (!data.isAbsent && hasNoValidActivities) {
                newIncompleteIds.add(emp.empleado_id!);
            }

            // Verificar traslapes de horarios usando intervalos efectivos
            if (data.isAbsent) return;
            const employeeErrors = new Set<string>();
            const intervals = data.activities.map(act => {
                const interval = getEffectiveInterval(act.startTime, act.endTime);
                return interval ? { id: act.id, start: interval.start, end: interval.end } : null;
            }).filter((i): i is { id: string; start: number; end: number } => i !== null);

            for (let i = 0; i < intervals.length; i++) {
                for (let j = i + 1; j < intervals.length; j++) {
                    const a = intervals[i];
                    const b = intervals[j];
                    if (a.start < b.end && a.end > b.start) {
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
    }, [entryData, employees, lockedEmployeeIds]);

    // 5. Empleados filtrados por búsqueda
    const filteredEmployees = useMemo(() => {
        if (!searchTerm) return employees;
        const term = searchTerm.toLowerCase().trim();
        return employees.filter(e => 
            e.nombre_completo.toLowerCase().includes(term) ||
            (e.equipo && e.equipo.toLowerCase().includes(term))
        );
    }, [employees, searchTerm]);

    // 6. Agrupación por cuadrilla ordenada por TEAM_ORDER explícito
    const employeesByTeam = useMemo(() => {
        const map = new Map<string, Empleado[]>();
        filteredEmployees.forEach(e => {
            const team = e.equipo || 'Sin Equipo';
            if (!map.has(team)) map.set(team, []);
            map.get(team)!.push(e);
        });

        return Array.from(map.entries()).sort((a, b) => {
            const indexA = TEAM_ORDER.indexOf(a[0]);
            const indexB = TEAM_ORDER.indexOf(b[0]);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a[0].localeCompare(b[0]);
        });
    }, [filteredEmployees]);

    // 7. Carga masiva por cuadrilla
    const handleBulkTeamAssign = useCallback((teamName: string, templateActivities: Omit<Activity, 'id'>[]) => {
        let assignedCount = 0;

        setEntryData(prevMap => {
            const nextMap = new Map(prevMap);
            employees.forEach(emp => {
                const empTeam = emp.equipo || 'Sin Equipo';
                const empId = emp.empleado_id!;
                
                // Se aplica solo a miembros sin ausencia y sin registros previos
                if (empTeam === teamName && !lockedEmployeeIds.has(empId)) {
                    const currentData = nextMap.get(empId);
                    if (currentData && !currentData.isAbsent) {
                        assignedCount++;
                        nextMap.set(empId, {
                            ...currentData,
                            activities: templateActivities.map(act => ({
                                ...act,
                                id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                            }))
                        });
                    }
                }
            });
            return nextMap;
        });

        addToast(
            `${assignedCount} integrantes de ${teamName.toUpperCase()} cargados con ${templateActivities.length} bloque(s).`, 
            'success'
        );
    }, [employees, lockedEmployeeIds, addToast]);

    // 8. Resumen global para la barra de acción fija
    const globalSummary = useMemo(() => {
        let totalHours = 0;

        employees.forEach(emp => {
            if (lockedEmployeeIds.has(emp.empleado_id!)) return;
            const data = entryData.get(emp.empleado_id!);
            if (!data) return;

            if (data.isAbsent) {
                totalHours += 8;
                return;
            }

            data.activities.forEach(act => {
                totalHours += calculateActivityDuration(act.startTime, act.endTime);
            });
        });

        return {
            hours: totalHours.toFixed(1)
        };
    }, [employees, entryData, lockedEmployeeIds]);

    // 9. Guardar registros del día (Lógica intacta con corte a 8.5 h)
    const handleSave = async () => {
        if (validationErrors.size > 0) {
            addToast("No se puede guardar. Hay conflictos de horario en uno o más empleados.", 'error');
            return;
        }

        if (incompleteEmployeeIds.size > 0) {
            addToast(`No se puede guardar. Faltan ${incompleteEmployeeIds.size} empleado(s) por registrar.`, 'error');
            return;
        }

        setIsSaving(true);
        const transactions: Omit<HourTransaction, 'transaccion_id' | '_row'>[] = [];
        const date = new Date(currentDate);
        const weekNum = getWeekNumber(date);

        entryData.forEach((data, employeeId) => {
            if (lockedEmployeeIds.has(employeeId)) return;

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
                .filter(act => calculateActivityDuration(act.startTime, act.endTime) > 0)
                .sort((a, b) => {
                    const intA = getEffectiveInterval(a.startTime, a.endTime)?.start || 0;
                    const intB = getEffectiveInterval(b.startTime, b.endTime)?.start || 0;
                    return intA - intB;
                });

            sortedActivities.forEach(act => {
                const duration = calculateActivityDuration(act.startTime, act.endTime);

                const isProject = !NON_BILLABLE_OPTIONS[act.projectId];
                const nombreProyecto = isProject 
                    ? (projects.find(p => p.proyecto_id === Number(act.projectId))?.nombre_proyecto || 'N/A') 
                    : NON_BILLABLE_OPTIONS[act.projectId];
                
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
                    transactions.push({ 
                        ...baseTransaction, 
                        horas_registradas: duration, 
                        costo_hora_real: employee.costo_hora_extra || employee.costo_hora, 
                        costo_total_mo: duration * (employee.costo_hora_extra || employee.costo_hora), 
                        tipo_hora: 'Extra', 
                        concept: getConceptForActivity(isProject, act.isSite, 'Extra', nombreProyecto) 
                    });
                } else if (accumulatedHours + duration > MAX_NORMAL_HOURS) {
                    const normalHoursPart = MAX_NORMAL_HOURS - accumulatedHours;
                    const extraHoursPart = duration - normalHoursPart;
                    if (normalHoursPart > 0.01) {
                        transactions.push({ 
                            ...baseTransaction, 
                            horas_registradas: normalHoursPart, 
                            costo_hora_real: employee.costo_hora, 
                            costo_total_mo: normalHoursPart * employee.costo_hora, 
                            tipo_hora: 'Normal', 
                            concept: getConceptForActivity(isProject, act.isSite, 'Normal', nombreProyecto) 
                        });
                    }
                    if (extraHoursPart > 0.01) {
                        transactions.push({ 
                            ...baseTransaction, 
                            horas_registradas: extraHoursPart, 
                            costo_hora_real: employee.costo_hora_extra || employee.costo_hora, 
                            costo_total_mo: extraHoursPart * (employee.costo_hora_extra || employee.costo_hora), 
                            tipo_hora: 'Extra', 
                            concept: getConceptForActivity(isProject, act.isSite, 'Extra', nombreProyecto) 
                        });
                    }
                } else {
                    transactions.push({ 
                        ...baseTransaction, 
                        horas_registradas: duration, 
                        costo_hora_real: employee.costo_hora, 
                        costo_total_mo: duration * employee.costo_hora, 
                        tipo_hora: 'Normal', 
                        concept: getConceptForActivity(isProject, act.isSite, 'Normal', nombreProyecto) 
                    });
                }
                accumulatedHours += duration;
            });
        });

        if (transactions.length === 0) {
            addToast("No hay horas nuevas para guardar.", 'info');
            setIsSaving(false);
            return;
        }

        try {
            await apiService.batchAddHourTransactions(transactions);
            addToast(`${transactions.length} registros de tiempo guardados exitosamente.`, 'success');
            
            // Guardar instantánea para precarga inmediata
            saveLastEntriesToStorage(entryData, currentDate);
            apiService.getHourTransactions().then(tx => setHistoryTransactions(tx)).catch(() => {});

            // Actualizar IDs bloqueados
            const newLocked = new Set(lockedEmployeeIds);
            transactions.forEach(t => newLocked.add(String(t.empleado_id)));
            setLockedEmployeeIds(newLocked);
            
            // Mostrar tabla de resultados post guardado
            setSavedTransactions(transactions);
        } catch (error) {
            addToast("Error al guardar los registros en el sistema.", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Verificar si el día está completamente cerrado (todos los activos están bloqueados)
    const isDayFullyClosed = useMemo(() => {
        if (employees.length === 0) return false;
        return employees.every(emp => lockedEmployeeIds.has(emp.empleado_id!));
    }, [employees, lockedEmployeeIds]);

    // Mensaje de la barra de acción fija
    let validationStatus: { message: string; colorClass: string; icon: React.ReactNode };
    if (validationErrors.size > 0) {
        validationStatus = {
            message: `${validationErrors.size} empleado(s) con conflictos de horario (traslapes).`,
            colorClass: 'text-brand',
            icon: <AlertTriangleIcon size={4} />
        };
    } else if (incompleteEmployeeIds.size > 0) {
        validationStatus = {
            message: `${incompleteEmployeeIds.size} empleado(s) pendientes por registrar.`,
            colorClass: 'text-slate-600 font-medium',
            icon: <AlertCircleIcon size={4} className="text-slate-500" />
        };
    } else {
        validationStatus = {
            message: 'Todos los registros son válidos para guardar.',
            colorClass: 'text-green font-medium',
            icon: <CheckCircleIcon size={4} />
        };
    }

    const isSaveDisabled = isSaving || validationErrors.size > 0 || incompleteEmployeeIds.size > 0 || isDayFullyClosed;

    // Render de Skeletons con Shimmer
    if (isLoading && employees.length === 0) {
        return (
            <div className="space-y-4 py-4 animate-pulse">
                <div className="h-14 bg-surface border border-line rounded-lg w-full"></div>
                <div className="h-10 bg-surface border border-line rounded-lg w-72"></div>
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-16 bg-surface border border-line rounded-lg flex items-center px-4 gap-3">
                            <div className="w-9 h-9 rounded-lg bg-surface2"></div>
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3.5 bg-surface2 rounded w-48"></div>
                                <div className="h-2.5 bg-surface2 rounded w-32"></div>
                            </div>
                            <div className="w-24 h-5 bg-surface2 rounded"></div>
                            <div className="w-16 h-5 bg-surface2 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const renderCaptureView = () => (
        <>
            {/* 1. Barra de Métricas */}
            <MetricsBar 
                employees={employees}
                entryData={entryData}
                lockedEmployeeIds={lockedEmployeeIds}
            />

            {/* 2. Tabla de Resultado Post Guardado */}
            {savedTransactions && (
                <SavedTransactionsTable 
                    transactions={savedTransactions}
                    onClose={() => setSavedTransactions(null)}
                />
            )}

            {/* 3. Banner informativo si el día está completamente cerrado */}
            {isDayFullyClosed && (
                <div className="mb-6 p-4 rounded-lg bg-steelSoft border border-steel/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-steel">
                    <div className="flex items-center gap-2.5">
                        <CheckCircleIcon size={5} />
                        <div>
                            <span className="font-semibold block text-sm">
                                Día cerrado: {formatLongDate(currentDate)}
                            </span>
                            <span className="text-xs opacity-90">
                                Todos los empleados de la cuadrilla ya cuentan con registros para esta fecha. Para ajustes o correcciones, acuda al módulo de Históricos.
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Buscador */}
            <div className="mb-6 flex items-center justify-between gap-4">
                <div className="relative w-full max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink3">
                        <SearchIcon size={4.5} />
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar por empleado o cuadrilla..."
                        className="block w-full pl-9 pr-3 py-2 text-sm bg-surface border border-line rounded-lg text-ink placeholder-ink3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition-colors"
                    />
                </div>
            </div>

            {/* 5. Búsqueda sin resultados */}
            {employeesByTeam.length === 0 && searchTerm && (
                <div className="border border-dashed border-line2 rounded-xl p-10 text-center bg-surface2/30 my-6">
                    <div className="w-12 h-12 mx-auto rounded-full bg-surface flex items-center justify-center text-ink3 mb-3 border border-line">
                        <SearchIcon size={6} />
                    </div>
                    <p className="text-sm font-semibold text-ink">
                        No se encontraron resultados para &ldquo;{searchTerm}&rdquo;
                    </p>
                    <p className="text-xs text-ink3 mt-1">
                        Verifique el nombre o limpie el filtro de búsqueda.
                    </p>
                    <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="mt-3 text-xs font-semibold text-brand hover:underline"
                    >
                        Limpiar búsqueda
                    </button>
                </div>
            )}

            {/* 6. Listado por Cuadrillas */}
            <div className="space-y-6 pb-6">
                {employeesByTeam.map(([teamName, teamEmployees]) => {
                    const isBulkOpen = openBulkTeam === teamName;

                    // Progreso de listos en esta cuadrilla
                    const totalInTeam = teamEmployees.length;
                    const readyInTeam = teamEmployees.filter(emp => {
                        const isLocked = lockedEmployeeIds.has(emp.empleado_id!);
                        const isInc = incompleteEmployeeIds.has(emp.empleado_id!);
                        const hasErr = validationErrors.has(emp.empleado_id!);
                        return isLocked || (!isInc && !hasErr);
                    }).length;

                    return (
                        <section 
                            key={teamName} 
                            className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm"
                        >
                            {/* Encabezado de Cuadrilla: acorde al look de la app */}
                            <div className="sticky top-0 z-20 bg-slate-50 border-b border-gray-200 py-3 px-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-sarp-dark-blue truncate">
                                        {teamName}
                                    </h2>
                                    <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white text-gray-600 border border-gray-200 tabular-nums shrink-0">
                                        {totalInTeam} {totalInTeam === 1 ? 'miembro' : 'miembros'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                    <span className="text-xs font-mono text-gray-500 tabular-nums hidden sm:inline-block">
                                        {readyInTeam}/{totalInTeam} listos
                                    </span>

                                    {/* Botón Precargar Último Registro del Equipo */}
                                    <button
                                        type="button"
                                        onClick={() => handlePreloadTeam(teamName, teamEmployees)}
                                        disabled={isPreloading}
                                        className="px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-slate-100 hover:border-gray-300 transition-colors flex items-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sarp-blue"
                                        title={`Precargar el último registro para los miembros de ${teamName}`}
                                    >
                                        <HistoryIcon size={3.5} />
                                        <span className="hidden md:inline">Precargar equipo</span>
                                        <span className="md:hidden">Precargar</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setOpenBulkTeam(isBulkOpen ? null : teamName)}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sarp-blue ${
                                            isBulkOpen
                                                ? 'bg-sarp-dark-blue text-white border-sarp-dark-blue'
                                                : 'bg-white text-sarp-blue border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <span>Carga masiva</span>
                                        <svg 
                                            className={`w-3.5 h-3.5 transition-transform duration-200 ${isBulkOpen ? 'rotate-180' : ''}`}
                                            viewBox="0 0 20 20" 
                                            fill="currentColor"
                                        >
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Panel Desplegable de Carga Masiva (280ms) */}
                            <BulkTeamAssignment
                                teamName={teamName}
                                projects={projects}
                                isOpen={isBulkOpen}
                                onClose={() => setOpenBulkTeam(null)}
                                onApply={activities => handleBulkTeamAssign(teamName, activities)}
                                onPreloadTeam={() => handlePreloadTeam(teamName, teamEmployees)}
                            />

                            {/* Filas de Empleados */}
                            <div>
                                {teamEmployees.map(emp => (
                                    <EmployeeRow
                                        key={emp.empleado_id}
                                        employee={emp}
                                        projects={projects}
                                        data={entryData.get(emp.empleado_id!)!}
                                        errors={validationErrors.get(emp.empleado_id!) || new Set()}
                                        onUpdate={updateEmployeeData}
                                        isLocked={lockedEmployeeIds.has(emp.empleado_id!)}
                                        isIncomplete={incompleteEmployeeIds.has(emp.empleado_id!)}
                                        onPreload={handlePreloadEmployee}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>

            {/* 7. Barra de Acción Sticky al Fondo (dentro de main, nunca cubre la barra lateral) */}
            <footer 
                className="sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 -mb-4 sm:-mb-6 lg:-mb-8 mt-auto z-20 bg-surface px-4 py-3 sm:py-3.5 border-t border-line shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
            >
                <div className="max-w-7xl mx-auto flex flex-col [@media(min-width:900px)]:flex-row [@media(min-width:900px)]:items-center justify-between gap-3">
                    {/* Mensaje de validación con ícono */}
                    <div className={`flex items-center gap-2 text-xs font-semibold ${validationStatus.colorClass}`}>
                        {validationStatus.icon}
                        <span>{validationStatus.message}</span>
                    </div>

                    {/* Resumen numérico y botón de guardar */}
                    <div className="flex items-center justify-between [@media(min-width:900px)]:justify-end gap-4 w-full [@media(min-width:900px)]:w-auto">
                        <div className="text-right">
                            <span className="font-mono text-sm font-semibold tabular-nums text-ink block leading-none">
                                {globalSummary.hours} hrs
                            </span>
                            <span className="text-[0.6875rem] text-ink3 uppercase tracking-[0.06em]">
                                Total de horas del día
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaveDisabled}
                            className="px-6 py-2.5 min-h-[44px] bg-ink text-surface font-semibold text-xs rounded-lg hover:bg-ink2 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 shrink-0"
                        >
                            {isSaving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-surface border-t-transparent"></div>
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <SaveIcon size={4} />
                                    <span>Guardar Registros del Día</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </footer>
        </>
    );

    return (
        <div className="min-h-full flex flex-col bg-canvas text-ink">
            {/* Header del módulo: Pestañas + Selector de fecha */}
            <header className="bg-surface p-4 rounded-xl border border-line shadow-sm mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div 
                    role="tablist" 
                    aria-label="Vistas de captura"
                    className="flex bg-surface2 p-1 rounded-lg border border-line shrink-0"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeView === 'capture'}
                        onClick={() => setActiveView('capture')}
                        className={`px-4 py-2 text-xs font-bold uppercase tracking-[0.06em] rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                            activeView === 'capture'
                                ? 'bg-surface text-ink shadow-sm border border-line'
                                : 'text-ink3 hover:text-ink'
                        }`}
                    >
                        Captura Diaria
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeView === 'summary'}
                        onClick={() => setActiveView('summary')}
                        className={`px-4 py-2 text-xs font-bold uppercase tracking-[0.06em] rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                            activeView === 'summary'
                                ? 'bg-surface text-ink shadow-sm border border-line'
                                : 'text-ink3 hover:text-ink'
                        }`}
                    >
                        Resumen Semanal
                    </button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={handleApplyStandardShiftAll}
                        disabled={isDayFullyClosed}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 hover:border-amber-400 transition-colors flex items-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Cargar la jornada estándar (08:00 a 13:00 y 14:00 a 17:30 con comida de 1 a 2 pm = 8.5 h) a los empleados sin periodos"
                    >
                        <span>🍽️</span>
                        <span className="hidden sm:inline">Jornada estándar (Comida 1–2 pm)</span>
                        <span className="sm:hidden">Jornada estándar</span>
                    </button>

                    <button
                        type="button"
                        onClick={handlePreloadAll}
                        disabled={isPreloading || isDayFullyClosed}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-slate-100 hover:border-gray-300 transition-colors flex items-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sarp-blue disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Precargar el último registro guardado para todos los empleados de la empresa"
                    >
                        <HistoryIcon size={4} />
                        <span>Precargar día completo</span>
                    </button>

                    <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-colors ${
                        lockedEmployeeIds.size > 0 ? 'bg-steelSoft border-steel/20' : 'bg-surface border-line'
                    }`}>
                    <CalendarIcon size={4.5} className={lockedEmployeeIds.size > 0 ? "text-steel" : "text-ink3"} />
                    <input
                        type="date"
                        value={currentDate}
                        onChange={e => setCurrentDate(e.target.value)}
                        className="bg-transparent border-0 text-xs font-mono font-bold text-ink tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded p-1"
                        aria-label="Fecha de registro"
                    />
                    {lockedEmployeeIds.size > 0 && (
                        <span 
                            className="ml-1 px-2 py-0.5 rounded text-[0.6875rem] font-mono font-bold bg-surface text-steel border border-steel/30 tabular-nums flex items-center gap-1"
                            title={`${lockedEmployeeIds.size} empleados ya cuentan con registros guardados en esta fecha`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-steel animate-pulse"></span>
                            {lockedEmployeeIds.size} Reg.
                        </span>
                    )}
                    </div>
                </div>
            </header>

            {/* Contenido según vista activa */}
            {activeView === 'capture' ? (
                renderCaptureView()
            ) : (
                <WeeklySummary 
                    currentDate={currentDate} 
                    allEmployees={employees} 
                    allProjects={projects} 
                />
            )}
        </div>
    );
};

export default DailyEntry;
