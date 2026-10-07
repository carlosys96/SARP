import type { HourTransaction } from '../../types';
import { 
    type Activity, 
    type EmployeeData, 
    timeToMinutes,
    calculateActivityDuration,
    LUNCH_START_MINUTES,
    LUNCH_END_MINUTES
} from './dailyEntryTypes';

const LOCAL_STORAGE_KEY = 'sarp_last_employee_entries';

const NON_BILLABLE_MAP: Record<string, string> = {
    'tiempo disponible': 'idle',
    'trabajos varios': 'varios',
    'administracion': 'admin',
    'administración': 'admin',
    'traslados': 'traslados',
};

const ABSENCE_REASONS = new Set([
    'vacaciones',
    'incapacidad',
    'falta',
    'permiso',
    'día festivo oficial',
    'dia festivo oficial'
]);

export interface PreloadResult {
    sourceDate: string;
    sourceType: 'local' | 'history';
    data: EmployeeData;
}

/**
 * Convierte minutos desde las 00:00 a string "HH:mm" en 24h sin desbordar ni retroceder
 */
export const minutesToTimeString = (totalMinutes: number): string => {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(totalMinutes)));
    const hours = Math.floor(clamped / 60);
    const mins = clamped % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Clona los datos de un empleado generando nuevos IDs únicos para cada actividad
 * y auto-repara cualquier actividad con horario 12h invertido (ej. 08:00 a 02:00 -> 14:00)
 */
const cloneEmployeeData = (source: EmployeeData): EmployeeData => {
    return {
        isAbsent: Boolean(source.isAbsent),
        absenceReason: source.absenceReason || 'Vacaciones',
        activities: (source.activities || []).map(act => {
            let s = act.startTime || '08:00';
            let e = act.endTime || '08:00';
            const sMin = timeToMinutes(s);
            const eMin = timeToMinutes(e);
            if (sMin !== null && eMin !== null && eMin <= sMin) {
                // Si la hora de inicio es matutina y la de fin es menor a 12:00 (ej. 08:00 a 02:00 -> 14:00)
                if (sMin >= 360 && eMin > 0 && eMin <= 720 && (eMin + 720) > sMin) {
                    const correctedH = Math.floor((eMin + 720) / 60);
                    const correctedM = eMin % 60;
                    e = `${String(correctedH).padStart(2, '0')}:${String(correctedM).padStart(2, '0')}`;
                } else if (sMin === eMin) {
                    // Si son idénticas, asignar un bloque de 1 hora
                    const nextMin = Math.min(1439, sMin + 60);
                    const nh = Math.floor(nextMin / 60);
                    const nm = nextMin % 60;
                    e = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
                }
            }
            return {
                ...act,
                startTime: s,
                endTime: e,
                id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
            };
        })
    };
};

/**
 * Guarda en localStorage una instantánea del día registrado por empleado
 */
export const saveLastEntriesToStorage = (
    entries: Map<string, EmployeeData>,
    currentDate: string
) => {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        const stored: Record<string, { date: string; data: EmployeeData }> = raw ? JSON.parse(raw) : {};

        entries.forEach((data, empId) => {
            const hasActivities = data.activities && data.activities.some(act => {
                return calculateActivityDuration(act.startTime, act.endTime) > 0;
            });

            if (data.isAbsent || hasActivities) {
                stored[empId] = {
                    date: currentDate,
                    data: {
                        isAbsent: data.isAbsent,
                        absenceReason: data.absenceReason || 'Vacaciones',
                        activities: data.activities.map(a => ({ ...a }))
                    }
                };
            }
        });

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stored));
    } catch (err) {
        console.warn('No se pudo guardar la instantánea en localStorage:', err);
    }
};

/**
 * Obtiene la última instantánea local de un empleado
 */
export const getLocalEntryForEmployee = (
    employeeId: string,
    currentDate: string
): { date: string; data: EmployeeData } | null => {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return null;
        const stored = JSON.parse(raw);
        const entry = stored[employeeId];
        if (!entry || !entry.data) return null;
        // Priorizar fechas distintas a la fecha actual para no copiarse a sí mismo
        if (entry.date && entry.date !== currentDate) {
            return entry;
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Obtiene el último registro de tiempo disponible para un empleado,
 * ya sea de la base de datos histórica o de la instantánea local más reciente.
 */
export const getLastRecordForEmployee = (
    employeeId: string,
    currentDate: string,
    historyTransactions: HourTransaction[]
): PreloadResult | null => {
    const localEntry = getLocalEntryForEmployee(employeeId, currentDate);

    // Filtrar transacciones históricas de este empleado antes o distintas de currentDate
    const empTx = historyTransactions.filter(t => {
        if (String(t.empleado_id) !== String(employeeId)) return false;
        if (t.is_deleted) return false;
        // Excluir la fecha que actualmente se está capturando
        if (t.fecha_registro === currentDate) return false;
        return true;
    });

    // Encontrar la fecha más reciente en transacciones históricas
    let latestHistoryDate: string | null = null;
    if (empTx.length > 0) {
        const dates = Array.from(new Set(empTx.map(t => t.fecha_registro).filter(Boolean))).sort();
        if (dates.length > 0) {
            latestHistoryDate = dates[dates.length - 1];
        }
    }

    // Comparar si la instantánea local es más reciente o igual a la histórica
    if (localEntry && (!latestHistoryDate || localEntry.date >= latestHistoryDate)) {
        return {
            sourceDate: localEntry.date,
            sourceType: 'local',
            data: cloneEmployeeData(localEntry.data)
        };
    }

    // Si hay fecha histórica y es más reciente o no hay local, reconstruir desde transacciones
    if (latestHistoryDate) {
        const dayTx = empTx.filter(t => t.fecha_registro === latestHistoryDate);
        if (dayTx.length === 0) return null;

        // 1. Verificar si fue ausencia
        const isAllAbsence = dayTx.every(t => {
            if (t.proyecto_id && t.proyecto_id !== 0) return false;
            const conceptLower = (t.concept || '').toLowerCase();
            const nameLower = (t.nombre_proyecto || '').toLowerCase();
            return ABSENCE_REASONS.has(conceptLower) || ABSENCE_REASONS.has(nameLower);
        });

        if (isAllAbsence) {
            const rawReason = dayTx[0].concept || dayTx[0].nombre_proyecto || 'Vacaciones';
            // Normalizar a capitalización esperada
            let absenceReason = 'Vacaciones';
            const rLower = rawReason.toLowerCase();
            if (rLower.includes('incapacidad')) absenceReason = 'Incapacidad';
            else if (rLower.includes('falta')) absenceReason = 'Falta';
            else if (rLower.includes('permiso')) absenceReason = 'Permiso';
            else if (rLower.includes('festivo')) absenceReason = 'Día festivo oficial';

            return {
                sourceDate: latestHistoryDate,
                sourceType: 'history',
                data: {
                    isAbsent: true,
                    absenceReason,
                    activities: []
                }
            };
        }

        // 2. Reconstruir actividades agrupando por proyecto y si es en sitio
        interface TxGroup {
            proyectoId: number;
            nombreProyecto: string;
            concept: string;
            isSite: boolean;
            totalHours: number;
        }

        const groups: TxGroup[] = [];
        dayTx.forEach(tx => {
            const projId = Number(tx.proyecto_id) || 0;
            const isSite = Boolean(tx.is_site);
            const hrs = Number(tx.horas_registradas) || 0;
            const concept = tx.concept || '';
            const nombre = tx.nombre_proyecto || '';

            // Intentar agrupar con el último grupo si coinciden proyecto y sitio
            const last = groups[groups.length - 1];
            if (last && last.proyectoId === projId && last.isSite === isSite) {
                last.totalHours += hrs;
            } else {
                groups.push({
                    proyectoId: projId,
                    nombreProyecto: nombre,
                    concept,
                    isSite,
                    totalHours: hrs
                });
            }
        });

        // Construir bloques horarios comenzando por defecto a las 08:00
        // respetando la hora estándar de comida (1:00 PM a 2:00 PM = 13:00 a 14:00)
        const totalHistoricalHrs = groups.reduce((acc, g) => acc + (g.totalHours || 0), 0);
        let currentMinutes = 8 * 60; // 08:00
        const activities: Activity[] = [];

        // Si el total acumulado en historial supera 14h (por ejemplo cargas masivas semanales en un solo día):
        // Escalar proporcionalmente a una jornada completa estándar de 8.5 horas para evitar distorsiones
        const isExcessive = totalHistoricalHrs > 14;
        const targetTotalMins = 8.5 * 60; // 510 min

        groups.forEach(g => {
            let durationMins: number;
            if (isExcessive) {
                const ratio = (g.totalHours || 1) / (totalHistoricalHrs || 1);
                durationMins = Math.max(30, Math.round((ratio * targetTotalMins) / 15) * 15);
            } else {
                durationMins = Math.max(30, Math.round((g.totalHours || 0.5) * 60));
            }

            let projectId = "0";
            if (g.proyectoId > 0) {
                projectId = String(g.proyectoId);
            } else {
                // Mapear concepto no facturable
                const combined = (g.nombreProyecto + ' ' + g.concept).toLowerCase();
                for (const [text, key] of Object.entries(NON_BILLABLE_MAP)) {
                    if (combined.includes(text)) {
                        projectId = key;
                        break;
                    }
                }
                if (projectId === "0") {
                    projectId = "varios";
                }
            }

            // Si el horario actual coincide con la hora de comida (13:00 a 14:00), saltar a las 14:00
            if (currentMinutes >= LUNCH_START_MINUTES && currentMinutes < LUNCH_END_MINUTES) {
                currentMinutes = LUNCH_END_MINUTES;
            }

            // Si el bloque inicia antes de las 13:00 y su duración lo llevaría después de las 13:00:
            // Dividir en 2 partes: antes de comida (hasta 13:00) y después de comida (desde 14:00)
            if (currentMinutes < LUNCH_START_MINUTES && currentMinutes + durationMins > LUNCH_START_MINUTES) {
                const part1Duration = LUNCH_START_MINUTES - currentMinutes;
                const part2Duration = durationMins - part1Duration;

                // Parte 1 (ej: 08:00 a 13:00)
                activities.push({
                    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    projectId,
                    startTime: minutesToTimeString(currentMinutes),
                    endTime: minutesToTimeString(LUNCH_START_MINUTES),
                    isSite: g.isSite
                });

                // Salto de comida de 1:00 PM a 2:00 PM
                currentMinutes = LUNCH_END_MINUTES;

                // Parte 2 (ej: 14:00 a 17:30)
                if (part2Duration > 0) {
                    const clampedPart2 = Math.min(part2Duration, 1439 - currentMinutes);
                    activities.push({
                        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        projectId,
                        startTime: minutesToTimeString(currentMinutes),
                        endTime: minutesToTimeString(currentMinutes + clampedPart2),
                        isSite: g.isSite
                    });
                    currentMinutes = Math.min(1439, currentMinutes + clampedPart2);
                }
            } else {
                // Bloque que no cruza la hora de comida
                if (currentMinutes + durationMins > 1439) {
                    durationMins = Math.max(30, 1439 - currentMinutes);
                }

                activities.push({
                    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    projectId,
                    startTime: minutesToTimeString(currentMinutes),
                    endTime: minutesToTimeString(currentMinutes + durationMins),
                    isSite: g.isSite
                });
                currentMinutes = Math.min(1439, currentMinutes + durationMins);

                // Si al finalizar este bloque llegamos a las 13:00 exactas, saltar a las 14:00
                if (currentMinutes === LUNCH_START_MINUTES) {
                    currentMinutes = LUNCH_END_MINUTES;
                }
            }
        });

        return {
            sourceDate: latestHistoryDate,
            sourceType: 'history',
            data: {
                isAbsent: false,
                absenceReason: 'Vacaciones',
                activities
            }
        };
    }

    // Si no hubo transacciones históricas pero hay una entrada local aunque sea de otra fecha
    if (localEntry) {
        return {
            sourceDate: localEntry.date,
            sourceType: 'local',
            data: cloneEmployeeData(localEntry.data)
        };
    }

    return null;
};
