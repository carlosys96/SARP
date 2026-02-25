
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { apiService } from '../services/api';
import type { Empleado, Proyecto, HourTransaction } from '../types';
import { DownloadIcon } from './icons/Icons';

// --- Helper Functions ---
const getWeekDateRange = (dateStr: string): { start: Date, end: Date } => {
    const date = new Date(dateStr + 'T00:00:00'); // Use local time
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
};

const formatDate = (date: Date) => date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

const NON_BILLABLE_PROJECT_NAMES = [
    "--- TIEMPO DISPONIBLE ---",
    "--- TRABAJOS VARIOS ---",
    "--- ADMINISTRACIÓN ---",
    "--- TRASLADOS ---",
];

const ABSENCE_PROJECT_NAMES = ['Vacaciones', 'Incapacidad', 'Falta', 'Permiso'];

// --- Sub-components ---
const SummaryHeader: React.FC<{
    range: { start: Date, end: Date };
    onExport: () => void;
    projects: Proyecto[];
    selectedProject: string;
    onProjectChange: (projectId: string) => void;
}> = ({ range, onExport, projects, selectedProject, onProjectChange }) => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div>
            <h2 className="text-xl font-bold text-sarp-dark-blue">Resumen Semanal por Equipo y Concepto</h2>
            <p className="text-sm text-gray-500 font-medium">Semana del {formatDate(range.start)} al {formatDate(range.end)}</p>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
            <div>
                <label htmlFor="project-filter" className="sr-only">Filtrar por Proyecto</label>
                <select
                    id="project-filter"
                    value={selectedProject}
                    onChange={(e) => onProjectChange(e.target.value)}
                    className="block w-full pl-3 pr-10 py-2 text-base bg-white border border-gray-300 focus:outline-none focus:ring-sarp-blue focus:border-sarp-blue sm:text-sm rounded-md shadow-sm"
                >
                    <option value="">Todos los proyectos</option>
                    {projects.map(p => (
                        <option key={p.proyecto_id} value={String(p.proyecto_id)}>
                            {p.nombre_proyecto}
                        </option>
                    ))}
                </select>
            </div>
            <button onClick={onExport} className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 shadow-sm">
                <DownloadIcon className="mr-2" /> Exportar
            </button>
        </div>
    </div>
);

const TeamSummaryTable: React.FC<{ data: any, onToggle: (team: string) => void, expandedTeams: Set<string> }> = ({ data, onToggle, expandedTeams }) => (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-[10px] font-black text-gray-600 uppercase">
                <tr>
                    <th className="px-4 py-3 text-left w-1/4">Colaborador / Concepto</th>
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => <th key={day} className="px-2 py-3 text-right">{day}</th>)}
                    <th className="px-4 py-3 text-right bg-gray-200 font-bold">Total</th>
                </tr>
            </thead>
            <tbody>
                {data.teams.map((team: any) => (
                    <React.Fragment key={team.name}>
                        <tr className="bg-slate-100 border-y border-slate-200 hover:bg-slate-200 cursor-pointer" onClick={() => onToggle(team.name)}>
                            <td className="px-4 py-2 font-bold text-sarp-dark-blue flex items-center gap-2">
                                <span className={`transition-transform transform ${expandedTeams.has(team.name) ? 'rotate-90' : 'rotate-0'}`}>▶</span>
                                EQUIPO {team.name.toUpperCase()}
                            </td>
                            {team.subtotals.daily.map((total: number, i: number) => <td key={i} className="px-2 py-2 text-right font-bold text-gray-700">{total > 0 ? total.toFixed(1) : '-'}</td>)}
                            <td className="px-4 py-2 text-right font-black bg-slate-200 text-sarp-dark-blue">{team.subtotals.weekly.toFixed(1)}</td>
                        </tr>
                        {expandedTeams.has(team.name) && team.employees.map((emp: any) => (
                            <tr key={emp.id} className="bg-white hover:bg-blue-50/50 text-gray-900">
                                <td className="pl-12 pr-4 py-2">{emp.name}</td>
                                {emp.daily.map((hours: number, i: number) => <td key={i} className="px-2 py-2 text-right">{hours > 0 ? hours.toFixed(1) : '-'}</td>)}
                                <td className="px-4 py-2 text-right font-bold bg-gray-100">{emp.total.toFixed(1)}</td>
                            </tr>
                        ))}
                        <tr className="bg-sky-200 font-bold text-sky-950 border-y-2 border-sky-300">
                            <td className="px-4 py-2 text-right">Subtotal {team.name}:</td>
                            {team.subtotals.daily.map((total: number, i: number) => <td key={i} className="px-2 py-2 text-right">{total.toFixed(1)}</td>)}
                            <td className="px-4 py-2 text-right bg-sky-300">{team.subtotals.weekly.toFixed(1)}</td>
                        </tr>
                    </React.Fragment>
                ))}
            </tbody>
            <tfoot className="bg-sarp-dark-blue text-white font-black text-base">
                <tr>
                    <td className="px-4 py-3 text-right">GRAN TOTAL SEMANA</td>
                    {data.grandTotals.daily.map((total: number, i: number) => <td key={i} className="px-2 py-3 text-right">{total.toFixed(1)}</td>)}
                    <td className="px-4 py-3 text-right bg-sarp-blue text-lg text-yellow-300">{data.grandTotals.weekly.toFixed(1)}</td>
                </tr>
            </tfoot>
        </table>
    </div>
);

const ConceptSummaryTable: React.FC<{ data: any }> = ({ data }) => {
    const getRowClass = (name: string) => {
        const cleanName = name.replace(/---/g, '').trim();
        if (ABSENCE_PROJECT_NAMES.map(n => n.toLowerCase()).includes(cleanName.toLowerCase()) || cleanName.toLowerCase() === 'ausentismos') return 'bg-red-100 text-red-900';
        if (NON_BILLABLE_PROJECT_NAMES.map(n => n.replace(/---/g, '').trim().toLowerCase()).includes(cleanName.toLowerCase())) return 'bg-amber-100 text-amber-900';
        return 'bg-white text-gray-900';
    };

    return (
        <div className="mt-8">
            <h2 className="text-xl font-bold text-sarp-dark-blue mb-4">2. Desglose General por Concepto</h2>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-[10px] font-black text-gray-600 uppercase">
                        <tr>
                            <th className="px-4 py-3 text-left w-1/4">Concepto</th>
                            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => <th key={day} className="px-2 py-3 text-right">{day}</th>)}
                            <th className="px-4 py-3 text-right bg-gray-200 font-bold">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {data.concepts.map((concept: any) => (
                            <tr key={concept.name} className={getRowClass(concept.name)}>
                                <td className="px-4 py-2 font-semibold">{concept.name}</td>
                                {concept.daily.map((hours: number, i: number) => <td key={i} className="px-2 py-2 text-right">{hours > 0 ? hours.toFixed(1) : '-'}</td>)}
                                <td className="px-4 py-2 text-right font-bold bg-gray-100">{concept.total.toFixed(1)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-sarp-dark-blue text-white font-black text-base">
                        <tr>
                            <td className="px-4 py-3 text-right">TOTAL GENERAL SEMANA</td>
                            {data.totals.daily.map((total: number, i: number) => <td key={i} className="px-2 py-3 text-right">{total.toFixed(1)}</td>)}
                            <td className="px-4 py-3 text-right bg-sarp-blue text-lg text-yellow-300">{data.totals.weekly.toFixed(1)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};


// --- Main Component ---
const WeeklySummary: React.FC<{ currentDate: string; allEmployees: Empleado[]; allProjects: Proyecto[] }> = ({ currentDate, allEmployees, allProjects }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [weeklyTransactions, setWeeklyTransactions] = useState<HourTransaction[]>([]);
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    const weekRange = useMemo(() => getWeekDateRange(currentDate), [currentDate]);

    useEffect(() => {
        const fetchWeeklyData = async () => {
            setIsLoading(true);
            try {
                const transactions = await apiService.getHourTransactions({
                    startDate: weekRange.start.toISOString().split('T')[0],
                    endDate: weekRange.end.toISOString().split('T')[0],
                    includeDeleted: false
                });
                setWeeklyTransactions(transactions);
            } catch (error) {
                console.error("Error fetching weekly summary data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchWeeklyData();
    }, [weekRange]);
    
    useEffect(() => {
        // Expand all teams by default when data loads, including a "Sin Equipo" category
        const teamNames = new Set(allEmployees.map(e => e.equipo).filter(Boolean) as string[]);
        teamNames.add('Sin Equipo'); // Add the default category
        setExpandedTeams(teamNames);
    }, [allEmployees]);

    const filteredTransactions = useMemo(() => {
        if (!selectedProjectId) {
            return weeklyTransactions;
        }
        return weeklyTransactions.filter(tx => String(tx.proyecto_id) === selectedProjectId);
    }, [weeklyTransactions, selectedProjectId]);
    
    const reportData = useMemo(() => {
        const dailyTotals = Array(7).fill(0);
        const teams: { [key: string]: { name: string; employees: any[], subtotals: { daily: number[], weekly: number } } } = {};
        const NO_TEAM_KEY = 'Sin Equipo';

        // Initialize team buckets, including a default for employees without a team.
        allEmployees.forEach(emp => {
            const teamName = emp.equipo || NO_TEAM_KEY;
            if (!teams[teamName]) {
                teams[teamName] = {
                    name: teamName,
                    employees: [],
                    subtotals: { daily: Array(7).fill(0), weekly: 0 }
                };
            }
        });

        // If 'Sin Equipo' was not created because there were no employees without a team, create it now to be safe.
        if (!teams[NO_TEAM_KEY]) {
            teams[NO_TEAM_KEY] = {
                name: NO_TEAM_KEY,
                employees: [],
                subtotals: { daily: Array(7).fill(0), weekly: 0 }
            };
        }
        
        filteredTransactions.forEach(tx => {
            const employee = allEmployees.find(e => e.empleado_id === tx.empleado_id);
            if (!employee) return; // Skip transactions for employees not in the main list
            
            const teamName = employee.equipo || NO_TEAM_KEY;
            const txDate = new Date(tx.fecha_registro + 'T00:00:00');
            const dayIndex = (txDate.getDay() + 6) % 7; // Monday is 0
            
            let teamData = teams[teamName];
            if (!teamData) return; // Should not happen due to pre-initialization, but as a safeguard.

            let empData = teamData.employees.find(e => e.id === employee.empleado_id);
            if (!empData) {
                empData = { id: employee.empleado_id, name: employee.nombre_completo, daily: Array(7).fill(0), total: 0 };
                teamData.employees.push(empData);
            }

            empData.daily[dayIndex] += tx.horas_registradas;
            empData.total += tx.horas_registradas;
            teamData.subtotals.daily[dayIndex] += tx.horas_registradas;
            teamData.subtotals.weekly += tx.horas_registradas;
            dailyTotals[dayIndex] += tx.horas_registradas;
        });

        // Filter out teams with no hours and sort, putting "Sin Equipo" last.
        const sortedTeams = Object.values(teams)
            .filter(t => t.subtotals.weekly > 0) // Only include teams with activity
            .sort((a, b) => {
                if (a.name === NO_TEAM_KEY) return 1;
                if (b.name === NO_TEAM_KEY) return -1;
                return a.name.localeCompare(b.name);
            });

        sortedTeams.forEach(t => t.employees.sort((a, b) => a.name.localeCompare(b.name)));
        
        const conceptMap: { [key: string]: { daily: number[] } } = {};
        const conceptAggregationMap: Record<string, string> = {};

        filteredTransactions.forEach(tx => {
            let conceptName = tx.concept;
            
            // Fallback for old data without a concept field
            if (!conceptName) {
                if (ABSENCE_PROJECT_NAMES.includes(tx.nombre_proyecto)) {
                    conceptName = tx.nombre_proyecto;
                } else if (NON_BILLABLE_PROJECT_NAMES.includes(tx.nombre_proyecto)) {
                    conceptName = tx.nombre_proyecto.replace(/---/g, '').trim().toLowerCase();
                    conceptName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);
                } else {
                     if (tx.tipo_hora === 'Extra') {
                        conceptName = tx.is_site ? 'Hrs extras instalación' : 'Hrs extras';
                    } else {
                        conceptName = tx.is_site ? 'Hrs de instalación' : 'Hrs normales planta';
                    }
                }
            }

            const finalConceptName = conceptAggregationMap[conceptName!] || conceptName;

            if (!conceptMap[finalConceptName!]) {
                conceptMap[finalConceptName!] = { daily: Array(7).fill(0) };
            }

            const txDate = new Date(tx.fecha_registro + 'T00:00:00');
            const dayIndex = (txDate.getDay() + 6) % 7;
            conceptMap[finalConceptName!].daily[dayIndex] += tx.horas_registradas;
        });

        const conceptOrder = [
            'Hrs normales planta',
            'Hrs de instalación',
            'Hrs extras',
            'Hrs extras instalación',
            'Trabajos varios',
            'Tiempo disponible',
            'Vacaciones',
            'Falta',
            'Permiso',
            'Incapacidad',
            'Administración',
            'Traslados',
        ];

        const concepts = Object.entries(conceptMap)
            .map(([name, data]) => ({
                name,
                daily: data.daily,
                total: data.daily.reduce((a, b) => a + b, 0)
            }))
            .filter(c => c.total > 0) // Only show concepts with hours
            .sort((a, b) => {
                const aIndex = conceptOrder.indexOf(a.name);
                const bIndex = conceptOrder.indexOf(b.name);
                if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            });

        return {
            teamSummary: {
                teams: sortedTeams,
                grandTotals: { daily: dailyTotals, weekly: dailyTotals.reduce((a, b) => a + b, 0) },
            },
            conceptSummary: {
                concepts,
                totals: { daily: dailyTotals, weekly: dailyTotals.reduce((a, b) => a + b, 0) }
            }
        };

    }, [filteredTransactions, allEmployees]);

    const handleToggleTeam = (teamName: string) => {
        setExpandedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamName)) next.delete(teamName);
            else next.add(teamName);
            return next;
        });
    };

    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Team Summary
        const teamDataForSheet: any[] = [];
        reportData.teamSummary.teams.forEach(team => {
            team.employees.forEach(emp => {
                teamDataForSheet.push({
                    'Equipo': team.name,
                    'Colaborador': emp.name,
                    'LUN': emp.daily[0] || 0, 'MAR': emp.daily[1] || 0, 'MIE': emp.daily[2] || 0, 'JUE': emp.daily[3] || 0, 'VIE': emp.daily[4] || 0, 'SAB': emp.daily[5] || 0, 'DOM': emp.daily[6] || 0,
                    'Total': emp.total
                });
            });
        });
        const teamSheet = XLSX.utils.json_to_sheet(teamDataForSheet);
        XLSX.utils.book_append_sheet(wb, teamSheet, "Resumen por Equipo");

        // Sheet 2: Concept Summary
        const conceptDataForSheet = reportData.conceptSummary.concepts.map(c => ({
            'Concepto': c.name,
            'LUN': c.daily[0] || 0, 'MAR': c.daily[1] || 0, 'MIE': c.daily[2] || 0, 'JUE': c.daily[3] || 0, 'VIE': c.daily[4] || 0, 'SAB': c.daily[5] || 0, 'DOM': c.daily[6] || 0,
            'Total': c.total
        }));
        const conceptSheet = XLSX.utils.json_to_sheet(conceptDataForSheet);
        XLSX.utils.book_append_sheet(wb, conceptSheet, "Desglose por Concepto");

        XLSX.writeFile(wb, `Resumen_Semanal_${currentDate}.xlsx`);
    };

    if (isLoading) {
        return <div className="text-center p-8">Cargando resumen semanal...</div>;
    }

    return (
        <div className="space-y-6">
            <SummaryHeader
                range={weekRange}
                onExport={handleExport}
                projects={allProjects}
                selectedProject={selectedProjectId}
                onProjectChange={setSelectedProjectId}
            />
            <TeamSummaryTable data={reportData.teamSummary} onToggle={handleToggleTeam} expandedTeams={expandedTeams}/>
            <ConceptSummaryTable data={reportData.conceptSummary} />
        </div>
    );
};

export default WeeklySummary;
