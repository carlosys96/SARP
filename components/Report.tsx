
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { Proyecto, ProfitabilityReport, HourTransaction, MaterialTransaction, AdditionalCost, Cliente } from '../types';
import { CostType } from '../types';
import { apiService } from '../services/api';
import { CloseIcon, DownloadIcon } from './icons/Icons';

// ... (DrillDownModal remains unchanged)
const DrillDownModal: React.FC<{ 
    isOpen: boolean, 
    onClose: () => void, 
    title: string, 
    type: 'mo' | 'mat' | 'add' | 'calc' | 'summary', 
    data: any[] 
}> = ({ isOpen, onClose, title, type, data }) => {
    if (!isOpen) return null;

    // Agrupación de datos para Mano de Obra (MO)
    const processedData = useMemo(() => {
        if (type === 'mo') {
            const groups: Record<string, HourTransaction> = {};
            
            data.forEach((item: any) => {
                const t = item as HourTransaction;
                const date = t.fecha_registro || '';
                const empId = t.empleado_id || '';
                const cost = Number(t.costo_hora_real || 0).toFixed(2);
                
                const key = `${date}-${empId}-${cost}`;
                
                if (!groups[key]) {
                    groups[key] = { 
                        ...t,
                        fecha_registro: date,
                        empleado_id: empId,
                        nombre_completo_empleado: t.nombre_completo_empleado || '',
                        horas_registradas: Number(t.horas_registradas) || 0,
                        costo_total_mo: Number(t.costo_total_mo) || 0,
                        costo_hora_real: Number(t.costo_hora_real) || 0,
                        tipo_hora: t.tipo_hora
                    }; 
                } else {
                    groups[key].horas_registradas += (Number(t.horas_registradas) || 0);
                    groups[key].costo_total_mo += (Number(t.costo_total_mo) || 0);
                }
            });

            return Object.values(groups).sort((a, b) => {
                const dateA = String(a.fecha_registro || '');
                const dateB = String(b.fecha_registro || '');
                const nameA = String(a.nombre_completo_empleado || '');
                const nameB = String(b.nombre_completo_empleado || '');
                return dateA.localeCompare(dateB) || nameA.localeCompare(nameB);
            });
        }
        return data;
    }, [data, type]);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-sarp-dark-blue">{title}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><CloseIcon /></button>
                </header>
                <div className="p-0 overflow-y-auto flex-1">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                            {type === 'mo' && (
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-32 bg-gray-100">Fecha</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase bg-gray-100">Empleado (ID - Nombre)</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase w-24 bg-gray-100">Horas</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase w-24 bg-gray-100">Tipo</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase w-32 bg-gray-100">Tarifa</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase w-32 bg-gray-100">Total</th>
                                </tr>
                            )}
                            {type === 'mat' && (
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-32 bg-gray-100">Fecha</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-40 bg-gray-100">No. Parte</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase min-w-[300px] bg-gray-100">Descripción</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase w-24 bg-gray-100">Cant.</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase w-32 bg-gray-100">Costo Unit.</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase w-32 bg-gray-100">Total</th>
                                </tr>
                            )}
                            {(type === 'add' || type === 'summary') && (
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-32 bg-gray-100">Periodo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-40 bg-gray-100">Categoría / Tipo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase bg-gray-100">Descripción / Resumen</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase w-32 bg-gray-100">Monto</th>
                                </tr>
                            )}
                            {type === 'calc' && (
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-1/2 bg-gray-100">Concepto</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase w-1/4 bg-gray-100">Valor / Factor</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase w-1/4 bg-gray-100">Resultado</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {processedData.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-500 text-sm">No hay detalles disponibles para este concepto.</td></tr>
                            ) : (
                                processedData.map((item: any, idx: number) => {
                                    if (type === 'mo') {
                                        const i = item as HourTransaction;
                                        const isExtra = i.tipo_hora === 'Extra';
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{i.fecha_registro}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                                                    <span className="font-mono text-xs text-gray-500 mr-2 bg-gray-100 px-1 rounded">{i.empleado_id}</span>
                                                    {i.nombre_completo_empleado}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 text-right font-bold">{i.horas_registradas.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-sm text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs border ${isExtra ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                        {i.tipo_hora || 'Normal'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 text-right font-mono">
                                                    {formatCurrency(i.costo_hora_real)}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(i.costo_total_mo)}</td>
                                            </tr>
                                        );
                                    } else if (type === 'mat') {
                                        const i = item as MaterialTransaction;
                                        return (
                                            <tr key={i.transaccion_id || idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{i.fecha_movimiento_sae}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600 font-mono">{i.numero_parte_sae}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-normal break-words">
                                                    {i.descripcion_material}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 text-right">{i.cantidad}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(i.costo_unitario)}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(i.costo_total_material)}</td>
                                            </tr>
                                        );
                                    } else if (type === 'calc') {
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.concept}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700 text-right font-mono">{item.factor}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-sarp-dark-blue text-right">{item.amount !== null ? formatCurrency(item.amount) : ''}</td>
                                            </tr>
                                        );
                                    } else if (type === 'summary') {
                                        return (
                                            <tr key={idx} className={`hover:bg-gray-50 ${item.isHighlight ? 'bg-blue-50 font-semibold' : ''}`}>
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{item.date}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.category}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{item.description}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                                            </tr>
                                        );
                                    } else {
                                        const i = item as AdditionalCost;
                                        return (
                                            <tr key={i.transaccion_id || idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{i.fecha}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900">{i.tipo_costo}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{i.descripcion}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(i.monto)}</td>
                                            </tr>
                                        );
                                    }
                                })
                            )}
                        </tbody>
                        {/* Footer Total for Summary view */}
                         {type === 'summary' && processedData.length > 0 && (
                            <tfoot className="bg-gray-100">
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-900 text-right uppercase">Total</td>
                                    <td className="px-4 py-3 text-sm font-bold text-sarp-dark-blue text-right">
                                        {formatCurrency(processedData.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0))}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Helper Functions ---
const formatCurrency = (value: number) => {
    return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

// --- Freight & Mounting View Component ---
const FreightInstallationView: React.FC<{ 
    reportData: ProfitabilityReport[], 
    manufacturingFactor: number,
    onDrillDown: (title: string, type: 'summary', data: any[]) => void
}> = ({ reportData, manufacturingFactor, onDrillDown }) => {
    // ... (FreightInstallationView remains exactly the same as previous content)
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const [selectedYear, setSelectedYear] = useState<number | null>(null);

    // Process data logic
    const { processedData, years, verticalTotals } = useMemo(() => {
        const yearsSet = new Set<number>();
        const dataMap: Record<number, Record<number, Record<number, { flete: number, montaje: number, costo: number }>>> = {};
        
        const vTotals: Record<number, {
            months: Record<number, { flete: number, montaje: number, costo: number, total: number }>;
            yearTotal: { flete: number, montaje: number, costo: number, total: number };
        }> = {};

        const initVerticalYear = (y: number) => {
            if (!vTotals[y]) {
                vTotals[y] = { months: {}, yearTotal: { flete: 0, montaje: 0, costo: 0, total: 0 } };
                for(let m=0; m<12; m++) {
                    vTotals[y].months[m] = { flete: 0, montaje: 0, costo: 0, total: 0 };
                }
            }
        };

        const addToMap = (projId: number, dateStr: string, amount: number, type: 'flete' | 'montaje' | 'costo') => {
            const date = new Date(dateStr);
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth();

            if (!isNaN(year)) {
                yearsSet.add(year);
                initVerticalYear(year);

                if (!dataMap[projId]) dataMap[projId] = {};
                if (!dataMap[projId][year]) dataMap[projId][year] = {};
                if (!dataMap[projId][year][month]) dataMap[projId][year][month] = { flete: 0, montaje: 0, costo: 0 };

                dataMap[projId][year][month][type] += amount;
            }
        };

        reportData.forEach(p => {
            p.detalles_adicionales.forEach(cost => {
                if (cost.tipo_costo === CostType.Flete) {
                    addToMap(p.proyecto_id, cost.fecha, cost.monto, 'flete');
                } else {
                    addToMap(p.proyecto_id, cost.fecha, cost.monto, 'montaje');
                }
            });

            p.detalles_mano_obra.forEach(mo => {
                addToMap(p.proyecto_id, mo.fecha_registro, mo.costo_total_mo, 'costo');
            });

            p.detalles_materiales.forEach(mat => {
                const baseCost = mat.costo_total_material;
                const fabCost = baseCost * manufacturingFactor; 
                addToMap(p.proyecto_id, mat.fecha_movimiento_sae, baseCost + fabCost, 'costo');
            });
        });

        const finalData = reportData.map(p => {
            const projectYears: Record<number, { 
                months: Record<number, { flete: number, montaje: number, costo: number, total: number }>, 
                total: { flete: number, montaje: number, costo: number, total: number } 
            }> = {};
            
            Array.from(yearsSet).forEach(year => {
                const yearData = dataMap[p.proyecto_id]?.[year] || {};
                let totalFlete = 0;
                let totalMontaje = 0;
                let totalCosto = 0;

                const monthsProcessed: Record<number, { flete: number, montaje: number, costo: number, total: number }> = {};

                for (let m = 0; m < 12; m++) {
                    const mData = yearData[m] || { flete: 0, montaje: 0, costo: 0 };
                    const mTotal = mData.flete + mData.montaje + mData.costo;
                    
                    monthsProcessed[m] = { ...mData, total: mTotal };

                    totalFlete += mData.flete;
                    totalMontaje += mData.montaje;
                    totalCosto += mData.costo;

                    vTotals[year].months[m].flete += mData.flete;
                    vTotals[year].months[m].montaje += mData.montaje;
                    vTotals[year].months[m].costo += mData.costo;
                    vTotals[year].months[m].total += mTotal;
                }
                
                const grandTotalYear = totalFlete + totalMontaje + totalCosto;

                vTotals[year].yearTotal.flete += totalFlete;
                vTotals[year].yearTotal.montaje += totalMontaje;
                vTotals[year].yearTotal.costo += totalCosto;
                vTotals[year].yearTotal.total += grandTotalYear;

                projectYears[year] = {
                    months: monthsProcessed,
                    total: { flete: totalFlete, montaje: totalMontaje, costo: totalCosto, total: grandTotalYear }
                };
            });
            
            return { ...(p as any), breakdown: projectYears };
        });

        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
        return { processedData: finalData, years: sortedYears, verticalTotals: vTotals };
    }, [reportData, manufacturingFactor]);

    useEffect(() => {
        if (years.length > 0 && selectedYear === null) {
            setSelectedYear(years[0]);
        }
    }, [years, selectedYear]);

    // Handle Drill Down Click
    const handleDrillDown = (projectId: number, monthIndex: number | null, type: 'costo' | 'flete' | 'montaje') => {
        if (selectedYear === null) return;

        const project = reportData.find(p => p.proyecto_id === projectId);
        if (!project) return;

        let summaryItems: any[] = [];
        const targetYear = selectedYear;

        // Filter function for date
        const isDateMatch = (dateStr: string) => {
            const date = new Date(dateStr);
            if (date.getUTCFullYear() !== targetYear) return false;
            if (monthIndex === null) return true;
            return date.getUTCMonth() === monthIndex;
        };

        const timeLabel = monthIndex !== null 
            ? `${monthNames[monthIndex]} ${targetYear}` 
            : `Anual ${targetYear}`;

        if (type === 'flete') {
            summaryItems = project.detalles_adicionales
                .filter(d => d.tipo_costo === CostType.Flete && isDateMatch(d.fecha))
                .map(d => ({
                    date: d.fecha,
                    category: 'Flete',
                    description: d.descripcion,
                    amount: d.monto
                }));
             summaryItems.sort((a, b) => a.date.localeCompare(b.date));
        } else if (type === 'montaje') {
             summaryItems = project.detalles_adicionales
                .filter(d => d.tipo_costo !== CostType.Flete && isDateMatch(d.fecha))
                .map(d => ({
                    date: d.fecha,
                    category: d.tipo_costo,
                    description: d.descripcion,
                    amount: d.monto
                }));
             summaryItems.sort((a, b) => a.date.localeCompare(b.date));
        } else if (type === 'costo') {
            const laborTransactions = project.detalles_mano_obra.filter(mo => isDateMatch(mo.fecha_registro));
            const totalLaborCost = laborTransactions.reduce((sum, t) => sum + t.costo_total_mo, 0);
            const totalLaborHours = laborTransactions.reduce((sum, t) => sum + t.horas_registradas, 0);

            if (totalLaborCost > 0) {
                summaryItems.push({
                    date: timeLabel,
                    category: 'Mano de Obra',
                    description: `Acumulado (${totalLaborHours.toFixed(2)} hrs)`,
                    amount: totalLaborCost
                });
            }
            
            const materialTransactions = project.detalles_materiales.filter(mat => isDateMatch(mat.fecha_movimiento_sae));
            const totalMaterialCost = materialTransactions.reduce((sum, t) => sum + t.costo_total_material, 0);

            if (totalMaterialCost > 0) {
                 summaryItems.push({
                    date: timeLabel,
                    category: 'Materia Prima',
                    description: `Acumulado (${materialTransactions.length} registros)`,
                    amount: totalMaterialCost
                });
            }

            if (totalMaterialCost > 0) {
                const overheadAmount = totalMaterialCost * manufacturingFactor;
                summaryItems.push({
                    date: timeLabel,
                    category: 'Gasto Fabricación',
                    description: `Calculado (Factor ${(manufacturingFactor * 100).toFixed(2)}%)`,
                    amount: overheadAmount,
                    isHighlight: true
                });
            }
        }

        onDrillDown(`Desglose: ${project.nombre_proyecto} - ${type.toUpperCase()}`, 'summary', summaryItems);
    };

    if (years.length === 0) {
        return <div className="p-8 text-center text-gray-500">No hay registros de costos con fechas válidas.</div>;
    }

    if (selectedYear === null) return null;

    const currentVerticalTotals = verticalTotals[selectedYear];

    return (
        <div className="flex flex-col space-y-4">
             <div className="flex items-center space-x-3 bg-white border border-gray-200 p-3 rounded-lg shadow-sm self-start">
                <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Año Fiscal:</span>
                <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="block w-32 pl-3 pr-10 py-1.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-sarp-blue focus:border-sarp-blue sm:text-sm rounded-md bg-gray-50 text-gray-900 font-bold cursor-pointer hover:bg-gray-100"
                >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            <div className="overflow-x-auto max-h-[70vh] border border-gray-200 rounded-lg relative">
                <table className="min-w-full divide-y divide-gray-200 border-collapse">
                    <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gray-100 sticky left-0 z-30 w-64 border-r border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                Proyecto
                            </th>
                            {monthNames.map((m, idx) => (
                                <th key={`${selectedYear}-${idx}`} colSpan={4} className="px-1 py-1 text-center text-xs font-bold text-gray-700 border-r border-gray-300 bg-gray-100">
                                    {m}
                                </th>
                            ))}
                            <th colSpan={4} className="px-1 py-1 text-center text-xs font-bold text-sarp-dark-blue border-r border-gray-300 bg-blue-100">
                                Acumulado {selectedYear}
                            </th>
                        </tr>
                        <tr>
                            {monthNames.map((_, idx) => (
                                <React.Fragment key={`${selectedYear}-${idx}-cols`}>
                                    <th className="px-1 py-1 text-right text-[10px] font-semibold text-gray-600 bg-white border-r border-gray-100 min-w-[65px]">Costo</th>
                                    <th className="px-1 py-1 text-right text-[10px] font-semibold text-gray-600 bg-white border-r border-gray-100 min-w-[65px]">Flete</th>
                                    <th className="px-1 py-1 text-right text-[10px] font-semibold text-gray-600 bg-white border-r border-gray-100 min-w-[65px]">Montaje</th>
                                    <th className="px-1 py-1 text-right text-[10px] font-bold text-gray-800 bg-gray-50 border-r border-gray-300 min-w-[65px]">Total</th>
                                </React.Fragment>
                            ))}
                            <th className="px-1 py-1 text-right text-[10px] font-bold text-sarp-blue bg-blue-50/50 border-r border-gray-100 min-w-[70px]">Costo</th>
                            <th className="px-1 py-1 text-right text-[10px] font-bold text-sarp-blue bg-blue-50/50 border-r border-gray-100 min-w-[70px]">Flete</th>
                            <th className="px-1 py-1 text-right text-[10px] font-bold text-sarp-blue bg-blue-50/50 border-r border-gray-100 min-w-[70px]">Montaje</th>
                            <th className="px-1 py-1 text-right text-[10px] font-extrabold text-sarp-dark-blue bg-blue-100 border-r border-gray-300 min-w-[70px]">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {processedData.map(p => {
                            const yData = p.breakdown[selectedYear];
                            return (
                                <tr key={p.proyecto_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-xs font-bold text-gray-900 sticky left-0 z-10 bg-white border-r border-gray-300 whitespace-normal break-words w-64 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-gray-50">
                                        {p.nombre_proyecto}
                                    </td>
                                    {monthNames.map((_, idx) => {
                                        const mData = yData?.months[idx];
                                        return (
                                            <React.Fragment key={`${p.proyecto_id}-${selectedYear}-${idx}`}>
                                                <td 
                                                    onClick={() => handleDrillDown(p.proyecto_id, idx, 'costo')}
                                                    className="px-1 py-3 text-xs text-sarp-blue hover:underline hover:text-sarp-dark-blue cursor-pointer text-right border-r border-gray-100"
                                                >
                                                    {mData?.costo ? formatCurrency(mData.costo) : '-'}
                                                </td>
                                                <td 
                                                    onClick={() => handleDrillDown(p.proyecto_id, idx, 'flete')}
                                                    className="px-1 py-3 text-xs text-sarp-blue hover:underline hover:text-sarp-dark-blue cursor-pointer text-right border-r border-gray-100"
                                                >
                                                    {mData?.flete ? formatCurrency(mData.flete) : '-'}
                                                </td>
                                                <td 
                                                    onClick={() => handleDrillDown(p.proyecto_id, idx, 'montaje')}
                                                    className="px-1 py-3 text-xs text-sarp-blue hover:underline hover:text-sarp-dark-blue cursor-pointer text-right border-r border-gray-100 bg-gray-50/30"
                                                >
                                                    {mData?.montaje ? formatCurrency(mData.montaje) : '-'}
                                                </td>
                                                <td className="px-1 py-3 text-xs font-bold text-gray-800 text-right border-r border-gray-300 bg-gray-100/50">{mData?.total ? formatCurrency(mData.total) : '-'}</td>
                                            </React.Fragment>
                                        )
                                    })}
                                    <td onClick={() => handleDrillDown(p.proyecto_id, null, 'costo')} className="px-1 py-3 text-xs font-bold text-sarp-dark-blue hover:underline cursor-pointer text-right border-r border-gray-100 bg-blue-50/30">{yData?.total.costo ? formatCurrency(yData.total.costo) : '-'}</td>
                                    <td onClick={() => handleDrillDown(p.proyecto_id, null, 'flete')} className="px-1 py-3 text-xs font-bold text-sarp-dark-blue hover:underline cursor-pointer text-right border-r border-gray-100 bg-blue-50/30">{yData?.total.flete ? formatCurrency(yData.total.flete) : '-'}</td>
                                    <td onClick={() => handleDrillDown(p.proyecto_id, null, 'montaje')} className="px-1 py-3 text-xs font-bold text-sarp-dark-blue hover:underline cursor-pointer text-right border-r border-gray-100 bg-blue-50/30">{yData?.total.montaje ? formatCurrency(yData.total.montaje) : '-'}</td>
                                    <td className="px-1 py-3 text-xs font-extrabold text-sarp-dark-blue text-right border-r border-gray-300 bg-blue-100">{yData?.total.total ? formatCurrency(yData.total.total) : '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="bg-gray-100 sticky bottom-0 z-20 shadow-[0_-2px_5px_-2px_rgba(0,0,0,0.1)]">
                        <tr>
                            <td className="px-4 py-3 text-xs font-bold text-gray-900 sticky left-0 z-30 bg-gray-200 border-r border-gray-300 w-64 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">TOTALES</td>
                            {monthNames.map((_, idx) => {
                                const mTotals = currentVerticalTotals?.months[idx];
                                return (
                                    <React.Fragment key={`footer-${idx}`}>
                                        <td className="px-1 py-2 text-xs font-bold text-gray-800 text-right border-r border-gray-200">{mTotals?.costo ? formatCurrency(mTotals.costo) : '-'}</td>
                                        <td className="px-1 py-2 text-xs font-bold text-gray-800 text-right border-r border-gray-200">{mTotals?.flete ? formatCurrency(mTotals.flete) : '-'}</td>
                                        <td className="px-1 py-2 text-xs font-bold text-gray-800 text-right border-r border-gray-200">{mTotals?.montaje ? formatCurrency(mTotals.montaje) : '-'}</td>
                                        <td className="px-1 py-2 text-xs font-extrabold text-gray-900 text-right border-r border-gray-300 bg-gray-200/50">{mTotals?.total ? formatCurrency(mTotals.total) : '-'}</td>
                                    </React.Fragment>
                                );
                            })}
                            <td className="px-1 py-2 text-xs font-bold text-sarp-dark-blue text-right border-r border-gray-200 bg-blue-100/50">{currentVerticalTotals?.yearTotal.costo ? formatCurrency(currentVerticalTotals.yearTotal.costo) : '-'}</td>
                            <td className="px-1 py-2 text-xs font-bold text-sarp-dark-blue text-right border-r border-gray-200 bg-blue-100/50">{currentVerticalTotals?.yearTotal.flete ? formatCurrency(currentVerticalTotals.yearTotal.flete) : '-'}</td>
                            <td className="px-1 py-2 text-xs font-bold text-sarp-dark-blue text-right border-r border-gray-200 bg-blue-100/50">{currentVerticalTotals?.yearTotal.montaje ? formatCurrency(currentVerticalTotals.yearTotal.montaje) : '-'}</td>
                            <td className="px-1 py-2 text-xs font-extrabold text-sarp-dark-blue text-right border-r border-gray-300 bg-blue-200">{currentVerticalTotals?.yearTotal.total ? formatCurrency(currentVerticalTotals.yearTotal.total) : '-'}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

// ... (Rest of Report component - Report, return JSX)
const Report: React.FC = () => {
    // ...
    const [projects, setProjects] = useState<Proyecto[]>([]);
    const [clients, setClients] = useState<Cliente[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
    const [reportData, setReportData] = useState<ProfitabilityReport[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'freight_install'>('general');
    
    // Visibility States
    const [showRevenueBreakdown, setShowRevenueBreakdown] = useState(false);
    const [showManufacturingCostBreakdown, setShowManufacturingCostBreakdown] = useState(false);
    const [showSalesCostBreakdown, setShowSalesCostBreakdown] = useState(false);
    
    // Factors State
    const [operatingFactor, setOperatingFactor] = useState<number>(0);
    const [manufacturingFactor, setManufacturingFactor] = useState<number>(0);
    
    // Drill Down State
    const [drillDownState, setDrillDownState] = useState<{
        isOpen: boolean;
        title: string;
        type: 'mo' | 'mat' | 'add' | 'calc' | 'summary';
        data: any[];
    }>({ isOpen: false, title: '', type: 'mo', data: [] });

    useEffect(() => {
        Promise.all([
            apiService.getProjects(),
            apiService.getClients()
        ]).then(([projs, clis]) => {
            setProjects(projs);
            setClients(clis);
        });
        
        // Load latest factors
        Promise.all([
            apiService.getFactorHistory('FACTOR_GASTOS_OP'),
            apiService.getFactorHistory('FACTOR_GASTOS_FAB')
        ]).then(([opHistory, manHistory]) => {
            if (opHistory.length > 0) setOperatingFactor(opHistory[0].valor);
            if (manHistory.length > 0) setManufacturingFactor(manHistory[0].valor);
        });

        handleGenerateReport();
    }, []);

    const handleGenerateReport = async () => {
        setIsLoading(true);
        const data = await apiService.getProfitabilityReport({ proyecto_id: selectedProjectId });
        setReportData(data);
        setIsLoading(false);
    };

    const handleExportExcel = () => {
        if (reportData.length === 0) return;

        const dataToExport = reportData.map(item => {
            const pVenta = item.monto_venta_pactado;
            const cMateriaPrima = item.costo_total_materiales;
            const cManoObra = item.costo_total_mano_obra;
            const cGtoFab = cMateriaPrima * manufacturingFactor;
            const subTotalFab = cMateriaPrima + cManoObra + cGtoFab;
            const margenFab = pVenta - subTotalFab;
            
            const detallesFletes = item.detalles_adicionales.filter(d => d.tipo_costo === CostType.Flete);
            const detallesInstalacion = item.detalles_adicionales.filter(d => d.tipo_costo !== CostType.Flete);
            const cFletes = detallesFletes.reduce((sum, d) => sum + d.monto, 0);
            const cInstalacion = detallesInstalacion.reduce((sum, d) => sum + d.monto, 0);
            const subTotalLog = cFletes + cInstalacion;
            
            const margenBruto = margenFab - subTotalLog;
            const cGtoOp = pVenta * operatingFactor;
            const margenOperativo = margenBruto - cGtoOp;
            const percentMargen = pVenta > 0 ? (margenOperativo / pVenta) : 0;

            const clientName = projects.find(p => p.proyecto_id === item.proyecto_id) 
                ? clients.find(c => c.cliente_id === projects.find(p => p.proyecto_id === item.proyecto_id)?.cliente_id)?.nombre_cliente 
                : '-';

            return {
                "Clave SAE": item.nueva_sae || '',
                "Cliente": clientName || '-',
                "Proyecto": item.nombre_proyecto,
                "Ejercicio": item.ejercicio,
                "Precio Venta Total": pVenta,
                "Precio Mobiliario": item.precio_fabricacion,
                "Precio Instalación": item.precio_instalacion,
                "Precio Flete": item.precio_flete,
                "Precio Servicios": item.precio_servicios,
                "Costo Materia Prima": cMateriaPrima,
                "Costo Mano de Obra": cManoObra,
                "Gasto Fabricación": cGtoFab,
                "Subtotal Fabricación": subTotalFab,
                "Margen Fabricación": margenFab,
                "Costo Fletes": cFletes,
                "Costo Instalación/Otros": cInstalacion,
                "Subtotal Venta": subTotalLog,
                "Margen Bruto": margenBruto,
                "Gasto Operación": cGtoOp,
                "Margen Operativo": margenOperativo,
                "% Margen": percentMargen
            };
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rentabilidad");
        XLSX.writeFile(wb, `Reporte_Rentabilidad_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const openDrillDown = (e: React.MouseEvent, title: string, type: 'mo' | 'mat' | 'add' | 'calc', data: any[]) => {
        e.stopPropagation();
        setDrillDownState({ isOpen: true, title, type, data });
    };

    const handleSummaryDrillDown = (title: string, type: 'summary', data: any[]) => {
        setDrillDownState({ isOpen: true, title, type, data });
    };

    const closeDrillDown = () => {
        setDrillDownState(prev => ({ ...prev, isOpen: false }));
    };

    const getMarginColor = (percentage: number) => {
        if (percentage < 0) return 'text-sarp-red';
        if (percentage < 15) return 'text-orange-600';
        return 'text-green-700';
    }

    const calculatePercentage = (part: number, total: number) => {
        if (!total || total === 0) return '0.0%';
        return `${((part / total) * 100).toFixed(1)}%`;
    };

    const getClientName = (projId: number) => {
        const proj = projects.find(p => p.proyecto_id === projId);
        if(!proj || !proj.cliente_id) return '-';
        const client = clients.find(c => c.cliente_id === proj.cliente_id);
        return client ? client.nombre_cliente : '-';
    }

    return (
        <div>
            <DrillDownModal 
                isOpen={drillDownState.isOpen} 
                onClose={closeDrillDown} 
                title={drillDownState.title} 
                type={drillDownState.type} 
                data={drillDownState.data} 
            />

            <h1 className="text-3xl font-bold text-sarp-gray mb-6">Reporte de Rentabilidad</h1>

            <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                     <h2 className="text-xl font-semibold text-sarp-gray mb-4 md:mb-0">Filtros</h2>
                     <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'general' ? 'bg-white text-sarp-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            General
                        </button>
                        <button
                            onClick={() => setActiveTab('freight_install')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'freight_install' ? 'bg-white text-sarp-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Costo Flete-Montaje
                        </button>
                     </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-end md:space-x-4 space-y-4 md:space-y-0">
                    <div className="flex-1">
                        <label htmlFor="projectFilter" className="block text-sm font-medium text-gray-700">Proyecto</label>
                        <select 
                            id="projectFilter" 
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-50 border border-gray-300 focus:outline-none focus:ring-sarp-blue focus:border-sarp-blue sm:text-sm rounded-md shadow-sm"
                            value={selectedProjectId || ''}
                            onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value) : undefined)}
                        >
                            <option value="">Todos los proyectos</option>
                            {projects.map(p => <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre_proyecto}</option>)}
                        </select>
                    </div>
                    
                    {/* Info Box for Factors */}
                    <div className="flex space-x-2">
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-2 min-w-[150px] flex flex-col justify-center">
                            <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">Factor Gastos Op.</span>
                            <span className="text-base font-bold text-sarp-dark-blue">{(operatingFactor * 100).toFixed(4)}%</span>
                        </div>
                         <div className="bg-blue-50 border border-blue-200 rounded-md p-2 min-w-[150px] flex flex-col justify-center">
                            <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">Factor Gastos Fab.</span>
                            <span className="text-base font-bold text-sarp-dark-blue">{(manufacturingFactor * 100).toFixed(4)}%</span>
                        </div>
                    </div>

                    <button 
                        onClick={handleExportExcel}
                        disabled={reportData.length === 0 || isLoading}
                        className="w-full md:w-auto py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sarp-blue disabled:bg-gray-100 disabled:text-gray-400 h-[58px] flex items-center justify-center"
                        title="Exportar a Excel"
                    >
                        <DownloadIcon className="mr-2" /> Exportar
                    </button>

                    <button 
                        onClick={handleGenerateReport}
                        disabled={isLoading}
                        className="w-full md:w-auto py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sarp-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sarp-blue disabled:bg-gray-400 h-[58px]"
                    >
                        {isLoading ? 'Generando...' : 'Generar Reporte'}
                    </button>
                </div>
            </div>

            {reportData.length > 0 ? (
                 <div className="bg-white p-1 sm:p-6 rounded-xl shadow-lg">
                    {activeTab === 'freight_install' ? (
                        <FreightInstallationView 
                            reportData={reportData} 
                            manufacturingFactor={manufacturingFactor} 
                            onDrillDown={handleSummaryDrillDown}
                        />
                    ) : (
                        <div className="overflow-x-auto overflow-y-auto max-h-[75vh] border border-gray-200 rounded-lg relative">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm">
                                    <tr>
                                        {/* New Header Structure */}
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-100 sticky left-0 z-30 border-r border-gray-300 w-32 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Número de Proyecto</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-100 border-r border-gray-300 w-32">Cliente</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-100 border-r border-gray-300 w-64">Proyecto</th>
                                        
                                        {showRevenueBreakdown && (
                                            <>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap bg-gray-100 animate-fade-in">Precio Mobiliario</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap bg-gray-100 animate-fade-in">Precio Instalación</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap bg-gray-100 animate-fade-in">Precio Flete / Envío</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap bg-gray-100 animate-fade-in">Precio Servicios</th>
                                            </>
                                        )}

                                        <th 
                                            onClick={() => setShowRevenueBreakdown(!showRevenueBreakdown)}
                                            className="px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase tracking-wider bg-gray-100 border-l border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                            title="Clic para mostrar/ocultar desglose de precios"
                                        >
                                            PRECIO VENTA <span className="text-sarp-blue text-[10px] ml-1">{showRevenueBreakdown ? '(-)' : '(+)'}</span>
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider bg-gray-100">Ejercicio</th>

                                        {showManufacturingCostBreakdown && (
                                            <>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider bg-gray-100 border-l border-gray-300 animate-fade-in">Materia Prima</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider bg-gray-100 animate-fade-in">Mano de Obra</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider bg-gray-100 animate-fade-in">Gasto de Fabricacion</th>
                                            </>
                                        )}
                                        
                                        <th 
                                            onClick={() => setShowManufacturingCostBreakdown(!showManufacturingCostBreakdown)}
                                            className="px-4 py-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-200 cursor-pointer hover:bg-gray-300 transition-colors select-none"
                                            title="Clic para mostrar/ocultar desglose de costo de fabricación"
                                        >
                                            Costo de fabricación <span className="text-sarp-blue text-[10px] ml-1">{showManufacturingCostBreakdown ? '(-)' : '(+)'}</span>
                                        </th>
                                        
                                        <th className="px-4 py-3 text-right text-xs font-bold text-sarp-blue uppercase tracking-wider bg-gray-100">Margen Fabricacion</th>

                                        {showSalesCostBreakdown && (
                                            <>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider bg-gray-100 border-l border-gray-300 animate-fade-in">Fletes</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider bg-gray-100 animate-fade-in">Instalacion / Viaticos / Otros</th>
                                            </>
                                        )}
                                        
                                        <th 
                                            onClick={() => setShowSalesCostBreakdown(!showSalesCostBreakdown)}
                                            className="px-4 py-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-200 cursor-pointer hover:bg-gray-300 transition-colors select-none"
                                            title="Clic para mostrar/ocultar desglose de costo de venta"
                                        >
                                            Costo de venta <span className="text-sarp-blue text-[10px] ml-1">{showSalesCostBreakdown ? '(-)' : '(+)'}</span>
                                        </th>
                                        
                                        <th className="px-4 py-3 text-right text-xs font-bold text-sarp-blue uppercase tracking-wider bg-gray-100 border-l border-gray-300">Margen Bruto</th>
                                        
                                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider bg-gray-100 border-l border-gray-300">Gastos de Operación</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-sarp-dark-blue uppercase tracking-wider bg-blue-50">Margen Operativo</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-sarp-dark-blue uppercase tracking-wider bg-blue-50">% / Vta</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {reportData.map(item => {
                                        // 1. Calculate Revenue Parts
                                        const pVenta = item.monto_venta_pactado;
                                        
                                        // 2. Direct Costs (Based on User Formula)
                                        // Materia prima = suma de todos los materiales
                                        const cMateriaPrima = item.costo_total_materiales;
                                        // Mano de obra = costo de las horas
                                        const cManoObra = item.costo_total_mano_obra;
                                        
                                        // Gasto de Fabricación = Materia prima * Factor de gastos de FABRICACION (Nuevo Factor)
                                        const cGtoFab = cMateriaPrima * manufacturingFactor;

                                        // Subtotal = Materia prima + mano de obra + gasto de fabricación
                                        const subTotalFab = cMateriaPrima + cManoObra + cGtoFab;
                                        
                                        // Margen de fabricación = Precio de Venta - Subtotal
                                        const margenFab = pVenta - subTotalFab;

                                        // Logistics Costs (Based on User Formula)
                                        // Filter: Fletes and everything else (Montaje, Viaticos, Others)
                                        const detallesFletes = item.detalles_adicionales.filter(d => d.tipo_costo === CostType.Flete);
                                        const detallesInstalacion = item.detalles_adicionales.filter(d => d.tipo_costo !== CostType.Flete);
                                        
                                        // Flete = Suma de todos los gastos "flete"
                                        const cFletes = detallesFletes.reduce((sum, d) => sum + d.monto, 0);
                                        // Instalación (Gto viaje/Viaticos/Otros) = Suma de todos los gastos NO flete
                                        const cInstalacion = detallesInstalacion.reduce((sum, d) => sum + d.monto, 0);

                                        // Subtotal = Fletes + Instalación (Gto viaje)
                                        const subTotalLog = cFletes + cInstalacion;

                                        // Margen bruto = Margen de fabricación - Subtotal (el de flete)
                                        const margenBruto = margenFab - subTotalLog;

                                        // Gasto de Operación = precio de venta * Factor de gastos de OPERACION (Factor Existente)
                                        const cGtoOp = pVenta * operatingFactor;

                                        // Margen operativo = Margen bruto - Gasto de Operación
                                        const margenOperativo = margenBruto - cGtoOp;
                                        
                                        // % / Venta = Margen operativo / precio de venta
                                        const percentMargen = pVenta > 0 ? (margenOperativo / pVenta) * 100 : 0;
                                        
                                        // Calculation details for Drilldowns
                                        const calcDetailsGtoFab = [
                                            { concept: 'Costo Materia Prima', factor: 'Base', amount: cMateriaPrima },
                                            { concept: 'Factor Gastos Fabricación', factor: `${(manufacturingFactor * 100).toFixed(6)}%`, amount: null },
                                            { concept: 'Gasto Fabricación Calculado', factor: '=', amount: cGtoFab }
                                        ];

                                        const calcDetailsGtoOp = [
                                            { concept: 'Precio Venta Total', factor: 'Base', amount: pVenta },
                                            { concept: 'Factor Gastos Operación', factor: `${(operatingFactor * 100).toFixed(6)}%`, amount: null },
                                            { concept: 'Gasto Operación Calculado', factor: '=', amount: cGtoOp }
                                        ];

                                        return (
                                            <React.Fragment key={item.proyecto_id}>
                                                <tr className="hover:bg-gray-50 transition-colors">
                                                    {/* Nuevo SAE Column - Sticky */}
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 font-mono sticky left-0 z-10 bg-white border-r border-gray-300 w-32 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{item.nueva_sae}</td>
                                                    
                                                    {/* Cliente Column - Normal */}
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-medium w-32 truncate border-r border-gray-300">{getClientName(item.proyecto_id)}</td>
                                                    
                                                    {/* Proyecto Column - Normal */}
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 w-64 truncate border-r border-gray-300">{item.nombre_proyecto}</td>
                                                    
                                                    {/* Revenue Columns (Conditional) */}
                                                    {showRevenueBreakdown && (
                                                        <>
                                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 text-right animate-fade-in">
                                                                <div>{formatCurrency(item.precio_fabricacion)}</div>
                                                                <div className="text-xs text-gray-400">{calculatePercentage(item.precio_fabricacion, item.monto_venta_pactado)}</div>
                                                            </td>
                                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 text-right animate-fade-in">
                                                                <div>{formatCurrency(item.precio_instalacion)}</div>
                                                                <div className="text-xs text-gray-400">{calculatePercentage(item.precio_instalacion, item.monto_venta_pactado)}</div>
                                                            </td>
                                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 text-right animate-fade-in">
                                                                <div>{formatCurrency(item.precio_flete)}</div>
                                                                <div className="text-xs text-gray-400">{calculatePercentage(item.precio_flete, item.monto_venta_pactado)}</div>
                                                            </td>
                                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 text-right animate-fade-in">
                                                                <div>{formatCurrency(item.precio_servicios)}</div>
                                                                <div className="text-xs text-gray-400">{calculatePercentage(item.precio_servicios, item.monto_venta_pactado)}</div>
                                                            </td>
                                                        </>
                                                    )}

                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold bg-gray-50/50 border-l border-gray-200">
                                                        <div>{formatCurrency(item.monto_venta_pactado)}</div>
                                                        <div className="text-xs text-gray-400">100.0%</div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{item.ejercicio}</td>

                                                    {/* Manufacturing Costs */}
                                                    {showManufacturingCostBreakdown && (
                                                        <>
                                                            <td 
                                                                onClick={(e) => openDrillDown(e, `Desglose Materia Prima - ${item.nombre_proyecto}`, 'mat', item.detalles_materiales)}
                                                                className="px-4 py-4 whitespace-nowrap text-sm text-sarp-blue hover:text-sarp-dark-blue hover:underline cursor-pointer text-right font-medium border-l border-gray-200 animate-fade-in"
                                                            >
                                                                <div>{formatCurrency(cMateriaPrima)}</div>
                                                                <div className="text-xs text-gray-400">{calculatePercentage(cMateriaPrima, pVenta)}</div>
                                                            </td>
                                                            <td 
                                                                onClick={(e) => openDrillDown(e, `Desglose Mano de Obra - ${item.nombre_proyecto}`, 'mo', item.detalles_mano_obra)}
                                                                className="px-4 py-4 whitespace-nowrap text-sm text-sarp-blue hover:text-sarp-dark-blue hover:underline cursor-pointer text-right font-medium animate-fade-in"
                                                            >
                                                                <div>{formatCurrency(cManoObra)}</div>
                                                                <div className="text-xs text-gray-400">{calculatePercentage(cManoObra, pVenta)}</div>
                                                            </td>
                                                            <td 
                                                                onClick={(e) => openDrillDown(e, `Cálculo Gasto Fabricación - ${item.nombre_proyecto}`, 'calc', calcDetailsGtoFab)}
                                                                className="px-4 py-4 whitespace-nowrap text-sm text-sarp-blue hover:text-sarp-dark-blue hover:underline cursor-pointer text-right font-medium bg-blue-50/10 animate-fade-in"
                                                                title="Cálculo: Materia Prima * Factor Fabricación"
                                                            >
                                                                <div>{formatCurrency(cGtoFab)}</div>
                                                                <div className="text-xs text-gray-400">{calculatePercentage(cGtoFab, pVenta)}</div>
                                                            </td>
                                                        </>
                                                    )}
                                                    
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right bg-gray-100/50">
                                                        <div>{formatCurrency(subTotalFab)}</div>
                                                        <div className="text-xs text-gray-400">{calculatePercentage(subTotalFab, pVenta)}</div>
                                                    </td>
                                                    <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold text-right text-gray-900`}>
                                                        <div>{formatCurrency(margenFab)}</div>
                                                        <div className="text-xs text-gray-400">{calculatePercentage(margenFab, pVenta)}</div>
                                                    </td>

                                                    {/* Logistics Costs */}
                                                    {showSalesCostBreakdown && (
                                                        <>
                                                            <td 
                                                                onClick={(e) => openDrillDown(e, `Desglose Fletes - ${item.nombre_proyecto}`, 'add', detallesFletes)}
                                                                className="px-4 py-4 whitespace-nowrap text-sm text-sarp-blue hover:text-sarp-dark-blue hover:underline cursor-pointer text-right font-medium border-l border-gray-200 animate-fade-in"
                                                            >
                                                                <div>{formatCurrency(cFletes)}</div>
                                                                <div className="text-xs text-gray-400">{calculatePercentage(cFletes, pVenta)}</div>
                                                            </td>
                                                            <td 
                                                                 onClick={(e) => openDrillDown(e, `Desglose Instalación / Viáticos / Otros - ${item.nombre_proyecto}`, 'add', detallesInstalacion)}
                                                                className="px-4 py-4 whitespace-nowrap text-sm text-sarp-blue hover:text-sarp-dark-blue hover:underline cursor-pointer text-right font-medium animate-fade-in"
                                                            >
                                                                <div>{formatCurrency(cInstalacion)}</div>
                                                                <div className="text-xs text-gray-400">{calculatePercentage(cInstalacion, pVenta)}</div>
                                                            </td>
                                                        </>
                                                    )}
                                                    
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right bg-gray-100/50">
                                                        <div>{formatCurrency(subTotalLog)}</div>
                                                        <div className="text-xs text-gray-400">{calculatePercentage(subTotalLog, pVenta)}</div>
                                                    </td>
                                                    
                                                    {/* Margins */}
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-right border-l border-gray-200 text-gray-900">
                                                        <div>{formatCurrency(margenBruto)}</div>
                                                        <div className="text-xs text-gray-400">{calculatePercentage(margenBruto, pVenta)}</div>
                                                    </td>
                                                    
                                                    {/* OpEx */}
                                                    <td 
                                                         onClick={(e) => openDrillDown(e, `Cálculo Gastos Operación - ${item.nombre_proyecto}`, 'calc', calcDetailsGtoOp)}
                                                        className="px-4 py-4 whitespace-nowrap text-sm text-sarp-blue hover:text-sarp-dark-blue hover:underline cursor-pointer text-right font-medium border-l border-gray-200 bg-blue-50/10"
                                                        title="Cálculo: Venta * Factor Operación"
                                                    >
                                                        <div>{formatCurrency(cGtoOp)}</div>
                                                        <div className="text-xs text-gray-400">{calculatePercentage(cGtoOp, pVenta)}</div>
                                                    </td>
                                                    
                                                    <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold text-right bg-blue-50/30 ${getMarginColor(percentMargen)}`}>
                                                        <div>{formatCurrency(margenOperativo)}</div>
                                                        <div className="text-xs text-gray-500/80">{calculatePercentage(margenOperativo, pVenta)}</div>
                                                    </td>
                                                    <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold text-right bg-blue-50/30 ${getMarginColor(percentMargen)}`}>{percentMargen.toFixed(1)}%</td>
                                                </tr>
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-lg text-center text-gray-500">
                    <p>{isLoading ? 'Cargando reporte...' : 'No hay datos de reporte para mostrar. Genere un reporte usando los filtros de arriba.'}</p>
                </div>
            )}
             <style>{`
              @keyframes fade-in {
                0% { opacity: 0; width: 0; }
                100% { opacity: 1; width: auto; }
              }
              .animate-fade-in {
                animation: fade-in 0.3s ease-out forwards;
              }
            `}</style>
        </div>
    );
};

export default Report;
