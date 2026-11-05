import type { Proyecto } from '../../types';

/**
 * Normaliza un texto para búsqueda (minúsculas y sin acentos)
 */
export function normalizeSearchText(text?: string | number | null): string {
    if (text === null || text === undefined) return '';
    return String(text)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

/**
 * Obtiene el código identificador de un proyecto.
 * Prioridad:
 * 1. codigo_proyecto (si está asignado explícitamente)
 * 2. nueva_sae (Clave SAE del proyecto, ej: 25-058-00)
 * 3. odc_po (Orden de compra si existe)
 * 4. PRJ-{proyecto_id} (identificador por defecto)
 */
export function getProjectCode(p?: Partial<Proyecto> | null): string {
    if (!p) return '';
    if (p.codigo_proyecto && String(p.codigo_proyecto).trim() !== '') {
        return String(p.codigo_proyecto).trim();
    }
    if (p.nueva_sae && String(p.nueva_sae).trim() !== '') {
        return String(p.nueva_sae).trim();
    }
    if (p.odc_po && String(p.odc_po).trim() !== '') {
        return String(p.odc_po).trim();
    }
    if (p.proyecto_id !== undefined && p.proyecto_id !== null && String(p.proyecto_id).trim() !== '') {
        return `PRJ-${p.proyecto_id}`;
    }
    return '';
}

/**
 * Devuelve la etiqueta completa para mostrar: [CÓDIGO] Nombre del Proyecto
 */
export function getProjectLabel(p?: Partial<Proyecto> | null): string {
    if (!p) return '';
    const code = getProjectCode(p);
    const name = p.nombre_proyecto || 'Sin Nombre';
    return code ? `[${code}] ${name}` : name;
}

/**
 * Comprueba si un proyecto coincide con la consulta de búsqueda
 * evaluando código de proyecto, nombre, clave SAE, estación y ODC.
 */
export function matchesProject(p: Proyecto, query: string, clientName?: string): boolean {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return true;

    // Tokens para búsquedas múltiples palabras (ej. "25 miu")
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

    const code = normalizeSearchText(getProjectCode(p));
    const name = normalizeSearchText(p.nombre_proyecto);
    const sae = normalizeSearchText(p.nueva_sae);
    const odc = normalizeSearchText(p.odc_po);
    const estacion = normalizeSearchText(p.estacion);
    const id = normalizeSearchText(p.proyecto_id);
    const client = normalizeSearchText(clientName || '');

    const searchableCombined = `${code} ${name} ${sae} ${odc} ${estacion} ${id} ${client}`;

    return tokens.every(token => searchableCombined.includes(token));
}

/**
 * Filtra y ordena proyectos según la consulta de búsqueda
 */
export function filterProjects(projects: Proyecto[], query: string, clientMap?: Map<number | string, string>): Proyecto[] {
    if (!query || !query.trim()) return projects;

    const normalizedQuery = normalizeSearchText(query);

    return projects.filter(p => {
        const clientName = (clientMap && p.cliente) ? clientMap.get(p.cliente) : undefined;
        return matchesProject(p, normalizedQuery, clientName);
    });
}
