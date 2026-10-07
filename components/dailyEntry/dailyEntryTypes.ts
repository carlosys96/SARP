export type Activity = {
    id: string;
    projectId: string;
    startTime: string; // "HH:mm"
    endTime: string; // "HH:mm"
    isSite: boolean;
};

export type EmployeeData = {
    activities: Activity[];
    isAbsent: boolean;
    absenceReason: string;
};

export const MAX_NORMAL_HOURS = 8.5;

// Hora estándar de comida (1:00 PM a 2:00 PM = 13:00 a 14:00)
export const LUNCH_START = '13:00';
export const LUNCH_END = '14:00';
export const LUNCH_START_MINUTES = 13 * 60; // 780 min
export const LUNCH_END_MINUTES = 14 * 60;   // 840 min

/**
 * Plantilla estándar de jornada de 8.5 horas con hora de comida de 1 a 2 pm:
 * Bloque 1: 08:00 a 13:00 (5.0 h)
 * Comida:   13:00 a 14:00 (1.0 h de comida estándar)
 * Bloque 2: 14:00 a 17:30 (3.5 h)
 * Total horas laborales = 8.5 h
 */
export const STANDARD_SHIFT_BLOCKS: { startTime: string; endTime: string }[] = [
    { startTime: '08:00', endTime: '13:00' },
    { startTime: '14:00', endTime: '17:30' }
];

// Nombres limpios sin guiones "---" según especificación de diseño
export const NON_BILLABLE_OPTIONS: Record<string, string> = {
    idle: "Tiempo disponible",
    varios: "Trabajos varios",
    admin: "Administración",
    traslados: "Traslados",
};

// Orden explícito de cuadrillas (no alfabético)
export const TEAM_ORDER = [
    'Corte y Doblez',
    'Pailería',
    'Soldadura',
    'Pintura',
    'Ensamble',
    'Instalación',
    'Instalaciones',
    'Producción',
    'Calidad',
    'Mantenimiento',
    'Administración',
    'Sin Equipo'
];

export const timeToMinutes = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
};

/**
 * Calcula la duración en horas de una actividad en formato 24h.
 * Evita la omisión de horas cuando:
 * 1) Se ingresan horas de la tarde en formato 12h (ej. 08:00 a 02:00 -> interpreta 14:00 = 6.0 h).
 * 2) Turnos nocturnos que cruzan la medianoche (ej. 20:00 a 02:00 = 6.0 h).
 */
export const calculateActivityDuration = (startTime: string, endTime: string): number => {
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
    if (s === null || e === null || s === e) return 0;

    // Caso 1: Fin mayor que inicio normal
    if (e > s) {
        return (e - s) / 60;
    }

    // Caso 2: Fin menor que inicio
    // Si inicio es de mañana (>= 06:00) y fin es <= 12:00 (ej. 08:00 a 02:00):
    // Interpretar como hora de la tarde (12h agregando 12h = 14:00)
    if (s >= 360 && e <= 720 && (e + 720) > s && (e + 720 - s) <= 14 * 60) {
        return (e + 720 - s) / 60;
    }

    // Caso 3: Turno nocturno que cruza medianoche (ej. 20:00 a 02:00)
    return (1440 - s + e) / 60;
};

/**
 * Sugerencia de corrección a 24h cuando una hora de fin es menor que la de inicio
 * pero corresponde a la tarde (ej. "02:00" -> "14:00", "05:00" -> "17:00")
 */
export const getSuggestedCorrection = (startTime: string, endTime: string): { suggestedTime: string; label: string } | null => {
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
    if (s === null || e === null || e >= s) return null;

    if (s >= 360 && e > 0 && e <= 720 && (e + 720) > s && (e + 720 - s) <= 14 * 60) {
        const pmHour = Math.floor((e + 720) / 60);
        const pmMin = e % 60;
        const suggestedTime = `${String(pmHour).padStart(2, '0')}:${String(pmMin).padStart(2, '0')}`;
        const display12h = `${Math.floor(e / 60)}:${String(pmMin).padStart(2, '0')} PM`;
        return {
            suggestedTime,
            label: `${suggestedTime} (${display12h})`
        };
    }
    return null;
};

/**
 * Obtiene el intervalo efectivo en minutos para validación de traslapes
 */
export const getEffectiveInterval = (startTime: string, endTime: string): { start: number; end: number } | null => {
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
    if (s === null || e === null || s === e) return null;

    if (e > s) {
        return { start: s, end: e };
    }

    if (s >= 360 && e <= 720 && (e + 720) > s && (e + 720 - s) <= 14 * 60) {
        return { start: s, end: e + 720 };
    }

    return { start: s, end: 1440 + e };
};

/**
 * Verifica si un periodo cruza la hora estándar de comida (13:00 a 14:00)
 */
export const spansLunchTime = (startTime: string, endTime: string): boolean => {
    const interval = getEffectiveInterval(startTime, endTime);
    if (!interval) return false;
    return interval.start < LUNCH_START_MINUTES && interval.end > LUNCH_END_MINUTES;
};

export const getWeekNumber = (d: Date): number => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const getConceptForActivity = (
    isProject: boolean,
    isSite: boolean,
    tipoHora: 'Normal' | 'Extra',
    projectNameOrConcept: string
): string => {
    if (!isProject) {
        // Para no facturables, el concepto es el nombre mismo, con formato
        const cleaned = projectNameOrConcept.replace(/---/g, '').trim().toLowerCase();
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    // Para proyectos facturables, determinar el concepto según el tipo y la ubicación
    if (tipoHora === 'Extra') {
        return isSite ? 'Hrs extras instalación' : 'Hrs extras';
    } 
    
    return isSite ? 'Hrs de instalación' : 'Hrs normales planta';
};

export const getInitials = (name: string): string => {
    if (!name) return 'EM';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
};
