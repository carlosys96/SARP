
import React, { useState, useCallback, useMemo } from 'react';
import type { Proyecto, Empleado, Mismatch, MaterialTransaction } from '../types';
import { CostType } from '../types';
import { apiService } from '../services/api';
import FileDropzone from './common/FileDropzone';
import { useToast } from '../contexts/ToastContext';
import { CalendarIcon } from './icons/Icons';

const baseInputClasses = "mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-base text-gray-900 shadow-sm focus:outline-none focus:ring-sarp-blue focus:border-sarp-blue sm:text-sm";
const baseSelectClasses = `${baseInputClasses} pl-3 pr-10`;
const datePickerInputClasses = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sarp-blue focus:border-sarp-blue block w-full pl-10 p-2.5";

const RowListDisplay: React.FC<{ rows: number[] }> = ({ rows }) => {
    const [expanded, setExpanded] = useState(false);
    const uniqueRows = useMemo(() => [...new Set(rows)].sort((a: number, b: number) => a - b), [rows]);
    const threshold = 10;
    if (uniqueRows.length === 0) return null;
    if (uniqueRows.length <= threshold) return <span className="font-mono text-xs text-gray-500 break-all">{uniqueRows.join(', ')}</span>;
    return (
        <div className="text-xs flex flex-col items-start">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mb-1">{uniqueRows.length} filas</span>
            <span className="font-mono text-gray-500 break-all">{expanded ? uniqueRows.join(', ') : `${uniqueRows.slice(0, threshold).join(', ')}...`}</span>
            <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="text-sarp-blue hover:text-sarp-dark-blue font-medium mt-1 text-[11px] focus:outline-none underline decoration-dotted">{expanded ? 'Colapsar lista' : `Ver las ${uniqueRows.length - threshold} restantes`}</button>
        </div>
    );
};
const UploadSummary: React.FC<{ projectSummary: { [key: string]: number }; employeeSummary?: { [key: string]: number }; saeDetails?: { totalMaterialsCost: number; count: number; bySheet: Record<string, number> }; }> = ({ projectSummary, employeeSummary, saeDetails }) => {
    const [showDetails, setShowDetails] = useState(true);
    const hasProjectData = projectSummary && Object.keys(projectSummary).length > 0;
    const hasEmployeeData = employeeSummary && Object.keys(employeeSummary).length > 0;
    const hasSaeData = !!saeDetails;
    if (!hasProjectData && !hasEmployeeData && !hasSaeData) return null;
    return (
        <div className="mt-4 p-4 rounded-lg text-sm bg-blue-50 border border-blue-200 text-blue-800">
            <button onClick={() => setShowDetails(!showDetails)} className="font-semibold w-full text-left flex justify-between items-center text-blue-900"><span>Resumen de Registros Procesados</span><span>{showDetails ? '▲' : '▼'}</span></button>
            {showDetails && (<div className="mt-3 border-t border-blue-200 pt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">{hasProjectData && (<div><p className="font-medium text-blue-900">Resumen por Proyecto (Horas):</p><ul className="list-disc list-inside mt-1 text-xs space-y-1 max-h-40 overflow-y-auto">{Object.entries(projectSummary).map(([name, hours]) => <li key={name}>{name}: <strong>{Number(hours).toFixed(2)} hrs</strong></li>)}</ul></div>)}{hasEmployeeData && (<div><p className="font-medium text-blue-900">Horas por empleado:</p><ul className="list-disc list-inside mt-1 text-xs space-y-1 max-h-40 overflow-y-auto">{Object.entries(employeeSummary!).map(([name, hours]) => <li key={name}>{name}: <strong>{Number(hours).toFixed(2)} hrs</strong></li>)}</ul></div>)}{hasSaeData && (<div className="md:col-span-2"><p className="font-medium text-blue-900">Resumen de Materiales (SAE):</p><div className="grid grid-cols-2 gap-4 mt-2"><div className="bg-white p-2 rounded border border-blue-100"><p className="text-xs text-gray-500">Costo Total Procesado</p><p className="text-lg font-bold text-sarp-blue">${saeDetails!.totalMaterialsCost.toFixed(2)}</p></div><div className="bg-white p-2 rounded border border-blue-100"><p className="text-xs text-gray-500">Registros Totales</p><p className="text-lg font-bold text-gray-700">{saeDetails!.count}</p></div></div><div className="mt-2 text-xs"><p>Desglose por hoja:</p><ul className="list-disc list-inside pl-2">{Object.entries(saeDetails!.bySheet).map(([sheet, cost]) => (<li key={sheet}>{sheet}: <strong>${Number(cost).toFixed(2)}</strong></li>))}</ul></div></div>)}</div>)}
        </div>
    )
};
const WarningDisplay: React.FC<{ warnings: Mismatch[]; }> = ({ warnings }) => {
    if (warnings.length === 0) return null;
    const groupedWarnings = useMemo(() => { const groups: { [key: string]: { value: string; rows: number[]; sheet?: string } } = {}; warnings.forEach(w => { const key = w.value; if (!groups[key]) { groups[key] = { value: w.value, rows: [], sheet: w.sheetName }; } groups[key].rows.push(w.rowIndex); }); return Object.values(groups).sort((a,b) => Math.min(...a.rows) - Math.min(...b.rows)); }, [warnings]);
    return (
        <div className="mt-6 bg-yellow-50 border border-yellow-300 p-6 rounded-xl shadow-md"><h3 className="text-xl font-bold text-yellow-900">Advertencias de Carga</h3><p className="text-md text-yellow-800 mt-2 mb-4">Los siguientes registros no se cargarán porque el proyecto asociado ya está marcado como "Terminado". No se requiere acción.</p><div className="overflow-x-auto max-h-60 border border-yellow-200 rounded-lg"><table className="min-w-full text-sm"><thead className="bg-yellow-100 sticky top-0"><tr><th className="px-4 py-3 text-left font-semibold text-yellow-900 w-1/4">Filas Afectadas</th><th className="px-4 py-3 text-left font-semibold text-yellow-900">Proyecto (Archivo)</th>{groupedWarnings.some(g => g.sheet) && <th className="px-4 py-3 text-left font-semibold text-yellow-900">Hoja</th>}<th className="px-4 py-3 text-left font-semibold text-yellow-900">Advertencia</th></tr></thead><tbody className="bg-white divide-y divide-yellow-200">{groupedWarnings.map((group) => (<tr key={group.value} className="hover:bg-yellow-50/50"><td className="px-4 py-3 align-top"><RowListDisplay rows={group.rows} /></td><td className="px-4 py-3 align-top"><span className="font-mono bg-gray-100 text-gray-800 font-bold px-2 py-1 rounded-md text-xs">{group.value}</span></td>{group.sheet && <td className="px-4 py-3 text-gray-500 text-xs align-top">{group.sheet}</td>}<td className="px-4 py-3 text-gray-700 capitalize align-top">Proyecto Terminado</td></tr>))}</tbody></table></div></div>
    );
};
const MismatchCorrector: React.FC<{ groupedMismatches: { type: 'employee' | 'project'; value: string; rows: number[]; sheet?: string }[]; projects: Proyecto[]; employees: Empleado[]; corrections: Record<string, string>; onCorrect: (key: string, correctedIdentifier: string) => void; saveAttempted: boolean; ignoredMismatches: string[]; onToggleIgnore: (key: string) => void; }> = ({ groupedMismatches, projects, employees, corrections, onCorrect, saveAttempted, ignoredMismatches, onToggleIgnore }) => {
    if (groupedMismatches.length === 0) return null;
    const sortedEmployees = useMemo(() => [...employees].sort((a, b) => String(a.empleado_id || '').localeCompare(String(b.empleado_id || ''))), [employees]);
    const sortedProjects = useMemo(() => [...projects].sort((a, b) => String(a.nombre_proyecto || '').localeCompare(String(b.nombre_proyecto || ''))), [projects]);
    return (
        <div className="mt-8 bg-amber-50 border border-amber-300 p-6 rounded-xl shadow-md"><h3 className="text-xl font-bold text-amber-900">Corregir Errores de Coincidencia</h3><p className="text-md text-amber-800 mt-2 mb-4">Se encontraron IDs que no existen en los catálogos. Seleccione el valor correcto para cada grupo o ignore los registros si no deben ser cargados.</p><div className="overflow-x-auto max-h-96 border border-amber-200 rounded-lg"><table className="min-w-full text-sm"><thead className="bg-amber-100 sticky top-0"><tr><th className="px-4 py-3 text-left font-semibold text-amber-900 w-1/5">Filas Afectadas</th><th className="px-4 py-3 text-left font-semibold text-amber-900 w-1/6">Tipo de Error</th><th className="px-4 py-3 text-left font-semibold text-amber-900">ID No Encontrado</th>{groupedMismatches.some(g => g.sheet) && <th className="px-4 py-3 text-left font-semibold text-amber-900">Hoja</th>}<th className="px-4 py-3 text-left font-semibold text-amber-900 w-2/5">Acción (Corregir o Ignorar)</th></tr></thead><tbody className="bg-white divide-y divide-amber-200">{groupedMismatches.map((group) => { const correctionKey = `${group.type}-${group.value}`; const isIgnored = ignoredMismatches.includes(correctionKey); const needsAttention = saveAttempted && !corrections[correctionKey] && !isIgnored; return ( <tr key={correctionKey} className="hover:bg-amber-50/50"><td className="px-4 py-3 text-gray-500 align-top"><RowListDisplay rows={group.rows} /></td><td className="px-4 py-3 text-gray-700 capitalize align-top font-medium pt-4">{group.type === 'employee' ? 'Empleado' : 'Proyecto'}</td><td className="px-4 py-3 align-top pt-4"><span className="font-mono bg-red-100 text-red-800 font-bold px-2 py-1 rounded-md text-xs">{group.value}</span></td>{group.sheet !== undefined && <td className="px-4 py-3 text-gray-500 text-xs align-top pt-4">{group.sheet || '-'}</td>}<td className="px-4 py-3 align-top"><div className="flex items-center space-x-2"><select value={corrections[correctionKey] || ''} onChange={(e) => onCorrect(correctionKey, e.target.value)} disabled={isIgnored} className={`block w-full text-sm p-2.5 rounded-lg shadow-sm focus:ring-sarp-blue focus:border-sarp-blue bg-white text-gray-900 ${needsAttention ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} ${isIgnored ? 'bg-gray-200 cursor-not-allowed' : ''}`} aria-label={`Corrección para ${group.value}`}><option value="" disabled>Seleccione una corrección...</option>{group.type === 'employee' ? sortedEmployees.map(e => <option key={e.empleado_id} value={e.empleado_id!}>{e.empleado_id} - {e.nombre_completo}</option>) : sortedProjects.map(p => <option key={p.proyecto_id} value={String(p.proyecto_id)}>{p.nombre_proyecto} (SAE: {p.nueva_sae})</option>)}</select><button type="button" onClick={() => onToggleIgnore(correctionKey)} className={`py-2 px-3 text-xs font-medium rounded-md whitespace-nowrap ${isIgnored ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>{isIgnored ? 'Deshacer' : 'Ignorar'}</button></div></td></tr>); })}</tbody></table></div></div>
    );
};

const Upload: React.FC = () => {
    const [projects, setProjects] = useState<Proyecto[]>([]);
    const [employees, setEmployees] = useState<Empleado[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [costType, setCostType] = useState<CostType>(CostType.Flete);
    const [description, setDescription] = useState('');
    const [otherConcept, setOtherConcept] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [weekStartDate, setWeekStartDate] = useState('');
    const [weeklyHoursFile, setWeeklyHoursFile] = useState<File | null>(null);
    const [saeFile, setSaeFile] = useState<File | null>(null);
    const [uploadStatus, setUploadStatus] = useState<Record<string, { message: string, errors?: string[], warnings?: string[], details?: any, isError: boolean } | undefined>>({});
    const [isUploading, setIsUploading] = useState({ weekly: false, sae: false });
    const [mismatches, setMismatches] = useState<Mismatch[]>([]);
    const [validTransactions, setValidTransactions] = useState<any[]>([]);
    const [corrections, setCorrections] = useState<Record<string, string>>({});
    const [ignoredMismatches, setIgnoredMismatches] = useState<string[]>([]);
    const [saveAttempted, setSaveAttempted] = useState(false);
    const [saeMismatches, setSaeMismatches] = useState<Mismatch[]>([]);
    const [saeValidTransactions, setSaeValidTransactions] = useState<any[]>([]);
    const [saeCorrections, setSaeCorrections] = useState<Record<string, string>>({});
    const [saeIgnoredMismatches, setSaeIgnoredMismatches] = useState<string[]>([]);
    const [saeSaveAttempted, setSaeSaveAttempted] = useState(false);
    const { addToast } = useToast();
    const employeeMap = useMemo(() => new Map(employees.map(e => [String(e.empleado_id).toUpperCase(), e])), [employees]);
    const projectSaeMap = useMemo(() => new Map(projects.map(p => [String(p.nueva_sae).toUpperCase(), p])), [projects]);
    const projectIdMap = useMemo(() => new Map(projects.map(p => [String(p.proyecto_id), p])), [projects]);
    const correctableMismatches = useMemo(() => mismatches.filter((m): m is Mismatch & { type: 'employee' | 'project' } => m.type === 'employee' || m.type === 'project'), [mismatches]);
    const projectFinishedWarnings = useMemo(() => mismatches.filter(m => m.type === 'project-finished'), [mismatches]);
    const groupedMismatches = useMemo(() => { if (!correctableMismatches.length) return []; const groups: { [key: string]: { type: 'employee' | 'project'; value: string; rows: number[] } } = {}; correctableMismatches.forEach(m => { const key = `${m.type}-${m.value}`; if (!groups[key]) groups[key] = { type: m.type, value: m.value, rows: [] }; groups[key].rows.push(m.rowIndex); }); return Object.values(groups).sort((a, b) => Math.min(...a.rows) - Math.min(...b.rows)); }, [correctableMismatches]);
    const saeCorrectableMismatches = useMemo(() => saeMismatches.filter((m): m is Mismatch & { type: 'project' } => m.type === 'project'), [saeMismatches]);
    const saeProjectFinishedWarnings = useMemo(() => saeMismatches.filter(m => m.type === 'project-finished'), [saeMismatches]);
    const saeGroupedMismatches = useMemo(() => { if (!saeCorrectableMismatches.length) return []; const groups: { [key: string]: { type: 'employee' | 'project'; value: string; rows: number[]; sheet?: string } } = {}; saeCorrectableMismatches.forEach(m => { const key = `${m.type}-${m.value}`; if (!groups[key]) groups[key] = { type: m.type, value: m.value, rows: [], sheet: m.sheetName }; groups[key].rows.push(m.rowIndex); }); return Object.values(groups).sort((a, b) => Math.min(...a.rows) - Math.min(...b.rows)); }, [saeCorrectableMismatches]);
    
    React.useEffect(() => {
        apiService.getProjects().then(data => setProjects(data.filter(p => p.estatus !== 'Terminado')));
        apiService.getEmployees().then(data => setEmployees(data.filter(e => e.activo)));
    }, []);

    const resetWeeklyHoursState = () => { setMismatches([]); setValidTransactions([]); setCorrections({}); setIgnoredMismatches([]); setWeeklyHoursFile(null); setUploadStatus(prev => ({ ...prev, weekly: undefined })); setSaveAttempted(false); };
    const handleToggleIgnore = (key: string) => { setIgnoredMismatches(prev => { if (prev.includes(key)) { return prev.filter(k => k !== key); } else { setCorrections(currentCorrections => { const newCorrections = { ...currentCorrections }; delete newCorrections[key]; return newCorrections; }); return [...prev, key]; } }); };
    const handleProcessFile = useCallback(async () => { if (!weekStartDate) { addToast('Por favor, seleccione la fecha de inicio de la semana (Lunes).', 'error'); return; } if (!weeklyHoursFile) { addToast('Por favor, seleccione un archivo de horas para procesar.', 'error'); return; } setIsUploading(prev => ({ ...prev, weekly: true })); setSaveAttempted(false); setMismatches([]); setValidTransactions([]); setCorrections({}); setIgnoredMismatches([]); setUploadStatus(prev => ({ ...prev, weekly: undefined })); try { const buffer = await weeklyHoursFile.arrayBuffer(); const result = await apiService.parseWeeklyHoursReport(buffer, weekStartDate); setUploadStatus(prev => ({ ...prev, weekly: { message: result.message, details: result.details, isError: !result.success } })); if(result.success) { setValidTransactions(result.transactions || []); setMismatches(result.mismatches || []); } else { addToast(result.message, 'error'); } } catch (e: unknown) { const message = e instanceof Error ? e.message : String(e); setUploadStatus(prev => ({ ...prev, weekly: { message, isError: true } })); addToast(message, 'error'); } finally { setIsUploading(prev => ({ ...prev, weekly: false })); } }, [addToast, weekStartDate, weeklyHoursFile]);
    const handleSaveData = async () => {
        setSaveAttempted(true);
        const allCorrected = groupedMismatches.every(g => corrections[`${g.type}-${g.value}`] || ignoredMismatches.includes(`${g.type}-${g.value}`));
        if (!allCorrected) {
            addToast("Por favor, corrija o ignore todos los errores de coincidencia antes de guardar.", 'error');
            return;
        }

        const finalTransactions = [...validTransactions];
        const correctedMismatches = mismatches.filter(m => {
            const key = `${m.type}-${m.value}`;
            return (m.type === 'project' || m.type === 'employee') && corrections[key] && !ignoredMismatches.includes(key);
        });

        correctedMismatches.forEach(m => {
            const key = `${m.type}-${m.value}`;
            const correctedId = corrections[key];
            if (m.type === 'project' && m.employeeIdentifier) {
                const project = projectIdMap.get(correctedId);
                const employee = employeeMap.get(m.employeeIdentifier.toUpperCase());
                if (project && employee) {
                    finalTransactions.push({
                        proyecto_id: project.proyecto_id!,
                        nombre_proyecto: project.nombre_proyecto,
                        empleado_id: employee.empleado_id,
                        nombre_completo_empleado: employee.nombre_completo,
                        fecha_registro: m.date!,
                        semana_del_anio: m.weekNum!,
                        horas_registradas: m.hours!,
                        costo_hora_real: employee.costo_hora,
                        costo_total_mo: m.hours! * employee.costo_hora,
                        tipo_hora: 'Normal'
                    });
                }
            }
        });

        setIsUploading(prev => ({ ...prev, weekly: true }));
        try {
            const res = await apiService.batchAddHourTransactions(finalTransactions);
            addToast(res.message, 'success');
            resetWeeklyHoursState();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            addToast(message, 'error');
        } finally {
            setIsUploading(prev => ({ ...prev, weekly: false }));
        }
    };
    const resetSaeState = () => { setSaeMismatches([]); setSaeValidTransactions([]); setSaeCorrections({}); setSaeIgnoredMismatches([]); setSaeFile(null); setUploadStatus(prev => ({ ...prev, sae: undefined })); setSaeSaveAttempted(false); };
    const handleSaeToggleIgnore = (key: string) => { setSaeIgnoredMismatches(prev => { if (prev.includes(key)) { return prev.filter(k => k !== key); } else { setSaeCorrections(curr => { const next = { ...curr }; delete next[key]; return next; }); return [...prev, key]; } }); };
    const handleProcessSae = async () => {
        if (!saeFile) {
            addToast('Por favor, seleccione un archivo SAE para procesar.', 'error');
            return;
        }
        setIsUploading(prev => ({ ...prev, sae: true }));
        resetSaeState();
        try {
            const buffer = await saeFile.arrayBuffer();
            const result = await apiService.parseSaeReport(buffer);
            setUploadStatus(prev => ({ ...prev, sae: { message: result.message, details: result.details, isError: !result.success } }));
            if (result.success) {
                setSaeValidTransactions(result.transactions || []);
                setSaeMismatches(result.mismatches || []);
            } else {
                addToast(result.message, 'error');
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            setUploadStatus(prev => ({ ...prev, sae: { message, isError: true } }));
            addToast(message, 'error');
        } finally {
            setIsUploading(prev => ({ ...prev, sae: false }));
        }
    };
    const handleSaveSaeData = async () => {
        setSaeSaveAttempted(true);
        const allCorrected = saeGroupedMismatches.every(g => saeCorrections[`${g.type}-${g.value}`] || saeIgnoredMismatches.includes(`${g.type}-${g.value}`));

        if (!allCorrected) {
            addToast("Por favor, corrija o ignore todos los errores de coincidencia antes de guardar los datos de SAE.", 'error');
            return;
        }

        const finalTransactions: MaterialTransaction[] = [...saeValidTransactions];
        if (finalTransactions.length === 0) {
            addToast("No hay transacciones válidas para guardar.", 'info');
            return;
        }

        setIsUploading(prev => ({ ...prev, sae: true }));
        try {
            const res = await apiService.batchAddMaterialTransactions(finalTransactions);
            addToast(res.message, 'success');
            resetSaeState();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            addToast(message, 'error');
        } finally {
            setIsUploading(prev => ({ ...prev, sae: false }));
        }
    };
    const handleAddCost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProjectId || !amount || !date) {
            addToast('Por favor complete todos los campos requeridos.', 'error');
            return;
        }
        if (costType === CostType.Otros && !otherConcept.trim()) {
            addToast('Por favor especifique el concepto para "Otros".', 'error');
            return;
        }
        try {
            await apiService.addAdditionalCost({
                proyecto_id: Number(selectedProjectId),
                tipo_costo: costType,
                descripcion: description,
                monto: parseFloat(amount),
                fecha: date,
                otro_concepto: costType === CostType.Otros ? otherConcept : undefined,
            });
            addToast('Costo adicional guardado exitosamente.', 'success');
            setSelectedProjectId(''); setCostType(CostType.Flete); setDescription(''); setAmount(''); setDate(''); setOtherConcept('');
        } catch (error) {
            const message = error instanceof Error ? (error as Error).message : String(error);
            addToast(`Error al guardar costo: ${message}`, 'error');
        }
    };

    const renderWeeklyHoursContent = () => (
        <div className="bg-white p-8 rounded-xl shadow-lg">
            <h2 className="text-2xl font-semibold text-sarp-gray mb-1">Paso 1: Cargar Reporte Semanal de Horas</h2>
            <p className="text-gray-500 mb-6">Suba el archivo de Excel del reporte de asistencia semanal.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div>
                    <label htmlFor="week-start-date" className="block text-sm font-medium text-gray-700">Fecha de Inicio de Semana (Lunes)</label>
                    <div className="relative mt-1">
                        <div className="absolute inset-y-0 start-0 flex items-center pl-3.5 pointer-events-none"><CalendarIcon className="text-gray-500 h-4 w-4" /></div>
                        <input type="date" id="week-start-date" value={weekStartDate} onChange={e => setWeekStartDate(e.target.value)} onClick={(e) => { const input = e.target as HTMLInputElement; if (input.showPicker) input.showPicker(); }} required className={datePickerInputClasses} />
                    </div>
                </div>
                <FileDropzone onFileDrop={setWeeklyHoursFile} isLoading={isUploading.weekly} />
            </div>
            <div className="mt-4 flex justify-end">
                <button onClick={handleProcessFile} disabled={!weeklyHoursFile || isUploading.weekly || !weekStartDate} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sarp-blue hover:bg-opacity-90 focus:outline-none disabled:bg-gray-400">
                    Procesar Archivo
                </button>
            </div>
            {uploadStatus.weekly && <UploadSummary projectSummary={uploadStatus.weekly.details?.projectSummary || {}} employeeSummary={uploadStatus.weekly.details?.employeeSummary || {}} />}
            {projectFinishedWarnings.length > 0 && <WarningDisplay warnings={projectFinishedWarnings} />}
            {groupedMismatches.length > 0 && <MismatchCorrector groupedMismatches={groupedMismatches} projects={projects} employees={employees} corrections={corrections} onCorrect={(key, val) => setCorrections(prev => ({ ...prev, [key]: val }))} saveAttempted={saveAttempted} ignoredMismatches={ignoredMismatches} onToggleIgnore={handleToggleIgnore} />}
            {validTransactions.length > 0 && (
                <div className="mt-6 flex justify-end">
                    <button onClick={handleSaveData} disabled={isUploading.weekly} className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none">
                        Guardar Datos Verificados
                    </button>
                </div>
            )}
        </div>
    );
    const renderSaeContent = () => (
        <div className="bg-white p-8 rounded-xl shadow-lg">
            <h2 className="text-2xl font-semibold text-sarp-gray mb-1">Paso 2: Cargar Reporte de Materiales (SAE)</h2>
            <p className="text-gray-500 mb-6">Suba el reporte de consumo de materiales exportado desde SAE.</p>
            <FileDropzone onFileDrop={setSaeFile} isLoading={isUploading.sae} />
            <div className="mt-4 flex justify-end">
                <button onClick={handleProcessSae} disabled={!saeFile || isUploading.sae} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sarp-blue hover:bg-opacity-90 focus:outline-none disabled:bg-gray-400">
                    Procesar Archivo SAE
                </button>
            </div>
            {uploadStatus.sae && <UploadSummary projectSummary={{}} saeDetails={uploadStatus.sae.details} />}
            {saeProjectFinishedWarnings.length > 0 && <WarningDisplay warnings={saeProjectFinishedWarnings} />}
            {saeGroupedMismatches.length > 0 && <MismatchCorrector groupedMismatches={saeGroupedMismatches} projects={projects} employees={employees} corrections={saeCorrections} onCorrect={(key, val) => setSaeCorrections(prev => ({ ...prev, [key]: val }))} saveAttempted={saeSaveAttempted} ignoredMismatches={saeIgnoredMismatches} onToggleIgnore={handleSaeToggleIgnore} />}
            {saeValidTransactions.length > 0 && (
                <div className="mt-6 flex justify-end">
                    <button onClick={handleSaveSaeData} disabled={isUploading.sae} className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none">
                        Guardar Materiales Verificados
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-sarp-gray mb-2">Carga por Archivo</h1>
            {renderWeeklyHoursContent()}
            {renderSaeContent()}
             <div className="bg-white p-8 rounded-xl shadow-lg">
                <h2 className="text-2xl font-semibold text-sarp-gray mb-1">Paso 3 (Opcional): Registrar Costo Adicional</h2>
                <p className="text-gray-500 mb-6">Utilice este formulario para añadir manualmente cualquier costo no contemplado en los archivos, como fletes, viáticos o compras directas.</p>
                <form onSubmit={handleAddCost} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                         <label htmlFor="project" className="block text-sm font-medium text-gray-700">Proyecto</label>
                        <select id="project" value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} required className={baseSelectClasses}>
                            <option value="">Seleccione un proyecto</option>
                            {projects.map(p => <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre_proyecto}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="costType" className="block text-sm font-medium text-gray-700">Tipo de Costo</label>
                        <select id="costType" value={costType} onChange={e => setCostType(e.target.value as CostType)} className={baseSelectClasses}>
                            {Object.values(CostType).map(ct => <option key={ct} value={ct}>{ct}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Monto</label>
                        <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" className={baseInputClasses} />
                    </div>
                     <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700">Fecha</label>
                        <div className="relative max-w-sm">
                            <div className="absolute inset-y-0 start-0 flex items-center pl-3.5 pointer-events-none">
                                <CalendarIcon className="text-gray-500 h-4 w-4" />
                            </div>
                            <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} onClick={(e) => { const input = e.target as HTMLInputElement; if (input.showPicker) input.showPicker(); }} required className={datePickerInputClasses}/>
                        </div>
                    </div>
                    {costType === CostType.Otros && (
                        <div className="md:col-span-2 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                            <label htmlFor="otherConcept" className="block text-sm font-medium text-yellow-800">Concepto (Especificar) <span className="text-red-500">*</span></label>
                            <input type="text" id="otherConcept" value={otherConcept} onChange={e => setOtherConcept(e.target.value)} required placeholder="Ej. Compra de EPP Especial" className={baseInputClasses} />
                        </div>
                    )}
                    <div className="md:col-span-2">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descripción / Detalles</label>
                        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} className={baseInputClasses}></textarea>
                    </div>
                    <div className="md:col-span-2 flex items-center justify-end flex-wrap gap-4">
                        <button type="submit" className="ml-auto inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sarp-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sarp-blue">
                            Agregar Costo
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Upload;
