
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
// Se eliminan los imports de jspdf para usar window.jspdf cargado en index.html
import type { Proyecto, ProfitabilityReport, HourTransaction, MaterialTransaction, AdditionalCost, Cliente, FactorOperativo } from '../types';
import { CostType } from '../types';
import { apiService } from '../services/api';
import { CloseIcon, DownloadIcon, CalendarIcon } from './icons/Icons';

// --- Helpers ---
const formatCurrency = (value: number) => {
    return (value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
};

const formatThousands = (value: number) => {
    return ((value || 0) / 1000).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

const getMarginColor = (percentage: number) => {
    if (percentage < 0) return 'text-red-700';
    if (percentage < 15) return 'text-orange-700';
    return 'text-green-800';
};

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// --- Sub-Components ---

const FactorCard: React.FC<{ label: string, value: number }> = ({ label, value }) => (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 min-w-[160px] shadow-sm">
        <p className="text-[9px] font-bold text-blue-700 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-lg font-black text-gray-900">{((value || 0) * 100).toFixed(4)}%</p>
    </div>
);

const PercentLabel: React.FC<{ value: number, total: number }> = ({ value, total }) => {
    if (!total || total === 0) return null;
    const p = (value / total) * 100;
    return <div className="text-[9px] text-gray-400 font-medium block leading-none mt-0.5">{p.toFixed(1)}%</div>;
};

const DrillDownModal: React.FC<{ isOpen: boolean, onClose: () => void, title: string, type: 'mo' | 'mat', data: any[] }> = ({ isOpen, onClose, title, type, data = [] }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><CloseIcon /></button>
                </header>
                <div className="overflow-y-auto flex-1 p-0">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr className="text-[10px] font-bold text-gray-700 uppercase">
                                {type === 'mo' ? <><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-left">Empleado</th><th className="px-4 py-3 text-right">Horas</th><th className="px-4 py-3 text-right">Tarifa</th><th className="px-4 py-3 text-right">Total</th></> :
                                <><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-left">No. Parte</th><th className="px-4 py-3 text-left">Descripción</th><th className="px-4 py-3 text-right">Cant.</th><th className="px-4 py-3 text-right">Total</th></>}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-xs text-gray-900">
                            {data.length > 0 ? data.map((item, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    {type === 'mo' ? <>
                                        <td className="px-4 py-2">{item.fecha_registro}</td>
                                        <td className="px-4 py-2 font-medium">{item.nombre_completo_empleado}</td>
                                        <td className="px-4 py-2 text-right">{item.horas_registradas}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(item.costo_hora_real)}</td>
                                        <td className="px-4 py-2 text-right font-bold">{formatCurrency(item.costo_total_mo)}</td>
                                    </> : <>
                                        <td className="px-4 py-2">{item.fecha_movimiento_sae}</td>
                                        <td className="px-4 py-2 font-mono">{item.numero_parte_sae}</td>
                                        <td className="px-4 py-2">{item.descripcion_material}</td>
                                        <td className="px-4 py-2 text-right">{item.cantidad}</td>
                                        <td className="px-4 py-2 text-right font-bold">{formatCurrency(item.costo_total_material)}</td>
                                    </>}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">No hay detalles disponibles para este registro.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- Report Views ---

const ExecutiveReportView: React.FC<{
    reportData: ProfitabilityReport[],
    groupedData: any,
    manufacturingFactor: number,
    operatingFactor: number,
    onDrillDown: (e: React.MouseEvent, title: string, type: 'mo' | 'mat', data: any[]) => void,
    calculateTotals: (items: ProfitabilityReport[]) => any
}> = ({ groupedData, manufacturingFactor, operatingFactor, onDrillDown, calculateTotals }) => {
    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200" id="executive-table">
                <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm">
                    <tr className="text-[10px] font-black text-gray-800 uppercase tracking-tight">
                        <th className="px-2 py-3 text-left sticky left-0 z-30 bg-gray-100 border-r w-48 shadow-sm">Cliente / Proyecto</th>
                        <th className="px-2 py-3 text-center">Ej.</th>
                        <th className="px-2 py-3 text-right text-sarp-blue">Venta (k)</th>
                        <th className="px-2 py-3 text-right">MP (k)</th>
                        <th className="px-2 py-3 text-right">MO (k)</th>
                        <th className="px-2 py-3 text-right">GF (k)</th>
                        <th className="px-2 py-3 text-right bg-gray-50 border-x">CF (k)</th>
                        <th className="px-2 py-3 text-right bg-blue-50/50">MF (k)</th>
                        <th className="px-2 py-3 text-right">CV (k)</th>
                        <th className="px-2 py-3 text-right bg-gray-50 border-x">MB (k)</th>
                        <th className="px-2 py-3 text-right">GO (k)</th>
                        <th className="px-2 py-3 text-right bg-blue-100 font-bold">MOp (k)</th>
                        <th className="px-2 py-3 text-right bg-blue-100 font-bold">%</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-[11px] text-gray-900">
                    {Object.entries(groupedData).map(([client, statuses]: [string, any]) => {
                        const clientItems = Object.values(statuses).flat() as ProfitabilityReport[];
                        const clientTotals = calculateTotals(clientItems);
                        return (
                            <React.Fragment key={client}>
                                <tr className="bg-gray-300 font-black"><td colSpan={13} className="px-4 py-2 uppercase text-xs">CLIENTE: {client}</td></tr>
                                {Object.entries(statuses).map(([status, items]: [string, any]) => {
                                    const statusTotals = calculateTotals(items);
                                    return (
                                        <React.Fragment key={status}>
                                            <tr className="bg-gray-50 font-bold italic"><td colSpan={13} className="px-6 py-1 border-l-4 border-gray-400">ESTATUS: {status}</td></tr>
                                            {items.map((item: ProfitabilityReport) => {
                                                const cGtoFab = (item.costo_total_materiales || 0) * manufacturingFactor;
                                                const subFab = (item.costo_total_materiales || 0) + (item.costo_total_mano_obra || 0) + cGtoFab;
                                                const cLog = (item.detalles_adicionales || []).reduce((sum, d) => sum + (d.monto || 0), 0);
                                                const marOp = (item.monto_venta_pactado || 0) - subFab - cLog - ((item.monto_venta_pactado || 0) * operatingFactor);
                                                const pMar = item.monto_venta_pactado > 0 ? (marOp / item.monto_venta_pactado) * 100 : 0;
                                                return (
                                                    <tr key={item.proyecto_id} className="hover:bg-blue-50/20 group">
                                                        <td className="px-4 py-2 font-medium sticky left-0 z-10 bg-white border-r group-hover:bg-blue-50/20">{item.nombre_proyecto}</td>
                                                        <td className="px-2 py-2 text-center text-gray-500">{item.ejercicio}</td>
                                                        {/* Venta Column moved here */}
                                                        <td className="px-2 py-2 text-right font-bold font-mono text-sarp-blue">
                                                            <span className="block">{formatThousands(item.monto_venta_pactado)}</span>
                                                            <PercentLabel value={item.monto_venta_pactado} total={item.monto_venta_pactado} />
                                                        </td>
                                                        <td onClick={(e) => onDrillDown(e, `MP - ${item.nombre_proyecto}`, 'mat', item.detalles_materiales || [])} className="px-2 py-2 text-right cursor-pointer hover:underline text-sarp-gray font-mono">
                                                            <span className="block">{formatThousands(item.costo_total_materiales)}</span>
                                                            <PercentLabel value={item.costo_total_materiales} total={item.monto_venta_pactado} />
                                                        </td>
                                                        <td onClick={(e) => onDrillDown(e, `MO - ${item.nombre_proyecto}`, 'mo', item.detalles_mano_obra || [])} className="px-2 py-2 text-right cursor-pointer hover:underline text-sarp-gray font-mono">
                                                            <span className="block">{formatThousands(item.costo_total_mano_obra)}</span>
                                                            <PercentLabel value={item.costo_total_mano_obra} total={item.monto_venta_pactado} />
                                                        </td>
                                                        <td className="px-2 py-2 text-right text-gray-600 font-mono">
                                                            <span className="block">{formatThousands(cGtoFab)}</span>
                                                            <PercentLabel value={cGtoFab} total={item.monto_venta_pactado} />
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-bold bg-gray-50 font-mono border-x">
                                                            <span className="block">{formatThousands(subFab)}</span>
                                                            <PercentLabel value={subFab} total={item.monto_venta_pactado} />
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-bold bg-blue-50/50 font-mono">
                                                            <span className="block">{formatThousands((item.monto_venta_pactado || 0) - subFab)}</span>
                                                            <PercentLabel value={(item.monto_venta_pactado || 0) - subFab} total={item.monto_venta_pactado} />
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-mono text-gray-600">
                                                            <span className="block">{formatThousands(cLog)}</span>
                                                            <PercentLabel value={cLog} total={item.monto_venta_pactado} />
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-bold bg-gray-50 font-mono border-x">
                                                            <span className="block">{formatThousands((item.monto_venta_pactado || 0) - subFab - cLog)}</span>
                                                            <PercentLabel value={(item.monto_venta_pactado || 0) - subFab - cLog} total={item.monto_venta_pactado} />
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-mono text-gray-600">
                                                            <span className="block">{formatThousands((item.monto_venta_pactado || 0) * operatingFactor)}</span>
                                                            <PercentLabel value={(item.monto_venta_pactado || 0) * operatingFactor} total={item.monto_venta_pactado} />
                                                        </td>
                                                        <td className={`px-2 py-2 text-right font-black bg-blue-100 font-mono ${getMarginColor(pMar)}`}>
                                                            <span className="block">{formatThousands(marOp)}</span>
                                                            <PercentLabel value={marOp} total={item.monto_venta_pactado} />
                                                        </td>
                                                        <td className={`px-2 py-2 text-right font-black bg-blue-100 ${getMarginColor(pMar)}`}>{pMar.toFixed(1)}%</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr className="bg-blue-50 font-black border-t border-blue-100 text-blue-950">
                                                <td className="px-6 py-2 uppercase text-[10px]">SUBTOTAL {status}</td>
                                                <td></td>
                                                <td className="px-2 py-2 text-right font-mono text-sarp-blue">
                                                    <span className="block">{formatThousands(statusTotals.ventaTotal)}</span>
                                                    <PercentLabel value={statusTotals.ventaTotal} total={statusTotals.ventaTotal} />
                                                </td>
                                                <td className="px-2 py-2 text-right font-mono">
                                                    <span className="block">{formatThousands(statusTotals.mp)}</span>
                                                    <PercentLabel value={statusTotals.mp} total={statusTotals.ventaTotal} />
                                                </td>
                                                <td className="px-2 py-2 text-right font-mono">
                                                    <span className="block">{formatThousands(statusTotals.mo)}</span>
                                                    <PercentLabel value={statusTotals.mo} total={statusTotals.ventaTotal} />
                                                </td>
                                                <td className="px-2 py-2 text-right font-mono">
                                                    <span className="block">{formatThousands(statusTotals.gf)}</span>
                                                    <PercentLabel value={statusTotals.gf} total={statusTotals.ventaTotal} />
                                                </td>
                                                <td className="px-2 py-2 text-right font-mono bg-white/50 border-x">
                                                    <span className="block">{formatThousands(statusTotals.subFab)}</span>
                                                    <PercentLabel value={statusTotals.subFab} total={statusTotals.ventaTotal} />
                                                </td>
                                                <td className="px-2 py-2 text-right font-mono bg-white/30">
                                                    <span className="block">{formatThousands(statusTotals.marFab)}</span>
                                                    <PercentLabel value={statusTotals.marFab} total={statusTotals.ventaTotal} />
                                                </td>
                                                <td className="px-2 py-2 text-right font-mono">
                                                    <span className="block">{formatThousands(statusTotals.subVta)}</span>
                                                    <PercentLabel value={statusTotals.subVta} total={statusTotals.ventaTotal} />
                                                </td>
                                                <td className="px-2 py-2 text-right font-mono bg-white/50 border-x">
                                                    <span className="block">{formatThousands(statusTotals.marBruto)}</span>
                                                    <PercentLabel value={statusTotals.marBruto} total={statusTotals.ventaTotal} />
                                                </td>
                                                <td className="px-2 py-2 text-right font-mono">
                                                    <span className="block">{formatThousands(statusTotals.gtoOp)}</span>
                                                    <PercentLabel value={statusTotals.gtoOp} total={statusTotals.ventaTotal} />
                                                </td>
                                                <td className="px-2 py-2 text-right font-mono bg-blue-100">
                                                    <span className="block">{formatThousands(statusTotals.marOp)}</span>
                                                    <PercentLabel value={statusTotals.marOp} total={statusTotals.ventaTotal} />
                                                </td>
                                                <td className="px-2 py-2 text-right bg-blue-100">{statusTotals.percent.toFixed(1)}%</td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                                <tr className="bg-blue-200 font-black border-y-2 border-blue-300 text-blue-950">
                                    <td className="px-4 py-2 uppercase text-xs">TOTAL CLIENTE {client}</td>
                                    <td></td>
                                    <td className="px-2 py-2 text-right font-mono text-sarp-blue">
                                        <span className="block">{formatThousands(clientTotals.ventaTotal)}</span>
                                        <PercentLabel value={clientTotals.ventaTotal} total={clientTotals.ventaTotal} />
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono">
                                        <span className="block">{formatThousands(clientTotals.mp)}</span>
                                        <PercentLabel value={clientTotals.mp} total={clientTotals.ventaTotal} />
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono">
                                        <span className="block">{formatThousands(clientTotals.mo)}</span>
                                        <PercentLabel value={clientTotals.mo} total={clientTotals.ventaTotal} />
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono">
                                        <span className="block">{formatThousands(clientTotals.gf)}</span>
                                        <PercentLabel value={clientTotals.gf} total={clientTotals.ventaTotal} />
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono bg-white/20 border-x">
                                        <span className="block">{formatThousands(clientTotals.subFab)}</span>
                                        <PercentLabel value={clientTotals.subFab} total={clientTotals.ventaTotal} />
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono">
                                        <span className="block">{formatThousands(clientTotals.marFab)}</span>
                                        <PercentLabel value={clientTotals.marFab} total={clientTotals.ventaTotal} />
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono">
                                        <span className="block">{formatThousands(clientTotals.subVta)}</span>
                                        <PercentLabel value={clientTotals.subVta} total={clientTotals.ventaTotal} />
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono bg-white/20 border-x">
                                        <span className="block">{formatThousands(clientTotals.marBruto)}</span>
                                        <PercentLabel value={clientTotals.marBruto} total={clientTotals.ventaTotal} />
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono">
                                        <span className="block">{formatThousands(clientTotals.gtoOp)}</span>
                                        <PercentLabel value={clientTotals.gtoOp} total={clientTotals.ventaTotal} />
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono bg-blue-300">
                                        <span className="block">{formatThousands(clientTotals.marOp)}</span>
                                        <PercentLabel value={clientTotals.marOp} total={clientTotals.ventaTotal} />
                                    </td>
                                    <td className="px-2 py-2 text-right bg-blue-300">{clientTotals.percent.toFixed(1)}%</td>
                                </tr>
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const FreightInstallReportView: React.FC<{ reportData: ProfitabilityReport[], fiscalYear: string }> = ({ reportData, fiscalYear }) => {
    // Logic to build the month matrix
    const matrix = useMemo(() => {
        return reportData.map(p => {
            const monthsData = MONTHS.map((_, i) => {
                const year = parseInt(fiscalYear);
                
                // Filter transactions for this month and year
                const hours = (p.detalles_mano_obra || []).filter(h => {
                    const d = new Date(h.fecha_registro);
                    return d.getMonth() === i && d.getFullYear() === year;
                }).reduce((sum, h) => sum + (h.costo_total_mo || 0), 0);

                const materials = (p.detalles_materiales || []).filter(m => {
                    const d = new Date(m.fecha_movimiento_sae);
                    return d.getMonth() === i && d.getFullYear() === year;
                }).reduce((sum, m) => sum + (m.costo_total_material || 0), 0);

                const fletes = (p.detalles_adicionales || []).filter(a => {
                    const d = new Date(a.fecha);
                    return a.tipo_costo === CostType.Flete && d.getMonth() === i && d.getFullYear() === year;
                }).reduce((sum, a) => sum + (a.monto || 0), 0);

                const montaje = (p.detalles_adicionales || []).filter(a => {
                    const d = new Date(a.fecha);
                    return a.tipo_costo === CostType.Montaje && d.getMonth() === i && d.getFullYear() === year;
                }).reduce((sum, a) => sum + (a.monto || 0), 0);

                const total = hours + materials + fletes + montaje;
                return { costo: hours + materials, flete: fletes, montaje: montaje, total };
            });

            return { nombre: p.nombre_proyecto, months: monthsData };
        });
    }, [reportData, fiscalYear]);

    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 text-[10px]" id="freight-install-table">
                <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm font-black uppercase text-gray-700">
                    <tr>
                        <th rowSpan={2} className="px-4 py-4 text-left sticky left-0 z-30 bg-gray-100 border-r w-48 shadow-sm">PROYECTO</th>
                        {MONTHS.map(m => (
                            <th key={m} colSpan={4} className="px-2 py-2 border-x border-gray-200 text-center">{m}</th>
                        ))}
                    </tr>
                    <tr className="bg-gray-50">
                        {MONTHS.map(m => (
                            <React.Fragment key={`sub-${m}`}>
                                <th className="px-1 py-2 text-right border-l font-normal text-gray-500">Costo</th>
                                <th className="px-1 py-2 text-right font-normal text-gray-500">Flete</th>
                                <th className="px-1 py-2 text-right font-normal text-gray-500">Montaje</th>
                                <th className="px-1 py-2 text-right border-r font-bold text-gray-800">Total</th>
                            </React.Fragment>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {matrix.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/20 transition-colors group">
                            <td className="px-4 py-2 font-bold text-gray-900 sticky left-0 z-10 bg-white border-r group-hover:bg-blue-50/20">{row.nombre}</td>
                            {row.months.map((m, midx) => (
                                <React.Fragment key={midx}>
                                    <td className="px-1 py-2 text-right font-mono text-gray-400">{m.costo === 0 ? '-' : m.costo.toLocaleString()}</td>
                                    <td className="px-1 py-2 text-right font-mono text-gray-400">{m.flete === 0 ? '-' : m.flete.toLocaleString()}</td>
                                    <td className="px-1 py-2 text-right font-mono text-gray-400">{m.montaje === 0 ? '-' : m.montaje.toLocaleString()}</td>
                                    <td className={`px-1 py-2 text-right font-mono font-bold border-r ${m.total > 0 ? 'text-sarp-blue bg-blue-50/10' : 'text-gray-300'}`}>{m.total === 0 ? '-' : m.total.toLocaleString()}</td>
                                </React.Fragment>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const Report: React.FC = () => {
    const [projects, setProjects] = useState<Proyecto[]>([]);
    const [clients, setClients] = useState<Cliente[]>([]);
    const [reportData, setReportData] = useState<ProfitabilityReport[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'executive' | 'freight_install'>('general');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);
    
    // Filters
    const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
    const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
    const [fiscalYear, setFiscalYear] = useState<string>(new Date().getFullYear().toString());

    // Factors
    const [factors, setFactors] = useState({ op: 0, mfg: 0 });
    
    // UI Toggles for Collapsible Sections
    const [showMfgDetail, setShowMfgDetail] = useState(false);
    const [showPriceDetail, setShowPriceDetail] = useState(false);
    const [showLogisticsDetail, setShowLogisticsDetail] = useState(false);

    const [drillDown, setDrillDown] = useState<{ isOpen: boolean, title: string, type: 'mo' | 'mat', data: any[] }>({ isOpen: false, title: '', type: 'mo', data: [] });

    useEffect(() => {
        const init = async () => {
            try {
                const [p, c, opF, mfgF] = await Promise.all([
                    apiService.getProjects(), 
                    apiService.getClients(), 
                    apiService.getFactorHistory('FACTOR_GASTOS_OP'), 
                    apiService.getFactorHistory('FACTOR_GASTOS_FAB')
                ]);
                setProjects(p || []); 
                setClients(c || []);
                setFactors({ 
                    op: (opF && opF[0]?.valor) || 0, 
                    mfg: (mfgF && mfgF[0]?.valor) || 0 
                });
                handleGenerate();
            } catch (err) {
                console.error("Error initializing report catalogs", err);
            }
        };
        init();

        // Close dropdown when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getProfitabilityReport(selectedProjectId ? { proyecto_id: selectedProjectId } : {});
            
            let filtered = data || [];
            
            // Filter by client if selected
            if (selectedClientId && !selectedProjectId) {
                const clientProjectIds = (projects || []).filter(p => p.cliente_id === selectedClientId).map(p => p.proyecto_id);
                filtered = filtered.filter(d => clientProjectIds.includes(d.proyecto_id));
            }

            // Filter by fiscal year
            if (fiscalYear) {
                filtered = filtered.filter(d => (d.ejercicio || '').toString() === fiscalYear);
            }

            setReportData(filtered);
        } catch (err) {
            console.error("Error generating report", err);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateTotals = (items: ProfitabilityReport[]) => {
        const totals = {
            mp: 0, mo: 0, gf: 0, subFab: 0, marFab: 0,
            ventaTotal: 0, p_mob: 0, p_inst: 0, p_flet: 0, p_serv: 0,
            c_flet: 0, c_inst: 0, subVta: 0,
            marBruto: 0, gtoOp: 0, marOp: 0
        };

        (items || []).forEach(item => {
            const cGtoFab = (item.costo_total_materiales || 0) * factors.mfg;
            const cFletes = (item.detalles_adicionales || []).filter(d => d.tipo_costo === CostType.Flete).reduce((sum, d) => sum + (d.monto || 0), 0);
            const cInstalacion = (item.detalles_adicionales || []).filter(d => d.tipo_costo !== CostType.Flete).reduce((sum, d) => sum + (d.monto || 0), 0);
            
            const subFab = (item.costo_total_materiales || 0) + (item.costo_total_mano_obra || 0) + cGtoFab;
            const subVta = cFletes + cInstalacion;
            const gtoOp = (item.monto_venta_pactado || 0) * factors.op;

            totals.mp += (item.costo_total_materiales || 0);
            totals.mo += (item.costo_total_mano_obra || 0);
            totals.gf += cGtoFab;
            totals.subFab += subFab;
            totals.marFab += ((item.monto_venta_pactado || 0) - subFab);
            totals.ventaTotal += (item.monto_venta_pactado || 0);
            totals.p_mob += (item.precio_fabricacion || 0);
            totals.p_inst += (item.precio_instalacion || 0);
            totals.p_flet += (item.precio_flete || 0);
            totals.p_serv += (item.precio_servicios || 0);
            totals.c_flet += cFletes;
            totals.c_inst += cInstalacion;
            totals.subVta += subVta;
            totals.marBruto += ((item.monto_venta_pactado || 0) - subFab - subVta);
            totals.gtoOp += gtoOp;
            totals.marOp += ((item.monto_venta_pactado || 0) - subFab - subVta - gtoOp);
        });

        const percent = totals.ventaTotal > 0 ? (totals.marOp / totals.ventaTotal) * 100 : 0;
        return { ...totals, percent };
    };

    const groupedData = useMemo(() => {
        const grouped: Record<string, Record<string, ProfitabilityReport[]>> = {};
        (reportData || []).forEach(item => {
            const proj = projects.find(p => p.proyecto_id === item.proyecto_id);
            const client = clients.find(c => c.cliente_id === proj?.cliente_id);
            const clientName = client?.nombre_cliente || 'Sin Cliente';
            const status = proj?.estatus || 'Desconocido';
            if (!grouped[clientName]) grouped[clientName] = {};
            if (!grouped[clientName][status]) grouped[clientName][status] = [];
            grouped[clientName][status].push(item);
        });
        return grouped;
    }, [reportData, clients, projects]);

    const openDrill = (e: React.MouseEvent, title: string, type: 'mo' | 'mat', data: any[]) => {
        e.stopPropagation(); 
        setDrillDown({ isOpen: true, title, type, data: data || [] });
    };

    // --- Export Logic ---

    const handleExportExcel = () => {
        const workbook = XLSX.utils.book_new();
        let exportData: any[] = [];

        if (activeTab === 'freight_install') {
            exportData = reportData.map(p => {
                const row: any = { 'PROYECTO': p.nombre_proyecto };
                MONTHS.forEach((m, i) => {
                    const year = parseInt(fiscalYear);
                    const hours = (p.detalles_mano_obra || []).filter(h => {
                        const d = new Date(h.fecha_registro);
                        return d.getMonth() === i && d.getFullYear() === year;
                    }).reduce((sum, h) => sum + (h.costo_total_mo || 0), 0);
                    const materials = (p.detalles_materiales || []).filter(m => {
                        const d = new Date(m.fecha_movimiento_sae);
                        return d.getMonth() === i && d.getFullYear() === year;
                    }).reduce((sum, m) => sum + (m.costo_total_material || 0), 0);
                    const fletes = (p.detalles_adicionales || []).filter(a => {
                        const d = new Date(a.fecha);
                        return a.tipo_costo === CostType.Flete && d.getMonth() === i && d.getFullYear() === year;
                    }).reduce((sum, a) => sum + (a.monto || 0), 0);
                    const montaje = (p.detalles_adicionales || []).filter(a => {
                        const d = new Date(a.fecha);
                        return a.tipo_costo === CostType.Montaje && d.getMonth() === i && d.getFullYear() === year;
                    }).reduce((sum, a) => sum + (a.monto || 0), 0);
                    row[`${m} - Costo`] = hours + materials;
                    row[`${m} - Flete`] = fletes;
                    row[`${m} - Montaje`] = montaje;
                    row[`${m} - Total`] = hours + materials + fletes + montaje;
                });
                return row;
            });
        } else {
            reportData.forEach(item => {
                const cGtoFab = (item.costo_total_materiales || 0) * factors.mfg;
                const subFab = (item.costo_total_materiales || 0) + (item.costo_total_mano_obra || 0) + cGtoFab;
                const cFletes = (item.detalles_adicionales || []).filter(d => d.tipo_costo === CostType.Flete).reduce((sum, d) => sum + (d.monto || 0), 0);
                const cInstalacion = (item.detalles_adicionales || []).filter(d => d.tipo_costo !== CostType.Flete).reduce((sum, d) => sum + (d.monto || 0), 0);
                const subVta = cFletes + cInstalacion;
                const marOp = (item.monto_venta_pactado || 0) - subFab - subVta - ((item.monto_venta_pactado || 0) * factors.op);
                const pMar = item.monto_venta_pactado > 0 ? (marOp / item.monto_venta_pactado) * 100 : 0;

                const proj = projects.find(p => p.proyecto_id === item.proyecto_id);
                const client = clients.find(c => c.cliente_id === proj?.cliente_id);

                exportData.push({
                    'CLIENTE': client?.nombre_cliente || 'N/A',
                    'ESTATUS': proj?.estatus || 'N/A',
                    'PROYECTO': item.nombre_proyecto,
                    'SAE': item.nueva_sae,
                    'EJERCICIO': item.ejercicio,
                    'VENTA PACTADA': item.monto_venta_pactado,
                    'MP': item.costo_total_materiales,
                    'MO': item.costo_total_mano_obra,
                    'GF': cGtoFab,
                    'SUBTOTAL FABRICACION': subFab,
                    'MARGEN FABRICACION': (item.monto_venta_pactado || 0) - subFab,
                    'COSTO LOGISTICA': subVta,
                    'MARGEN BRUTO': (item.monto_venta_pactado || 0) - subFab - subVta,
                    'GASTO OPERATIVO': (item.monto_venta_pactado || 0) * factors.op,
                    'MARGEN OPERATIVO': marOp,
                    '% MARGEN': pMar.toFixed(2) + '%'
                });
            });
        }

        const sheet = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Reporte');
        XLSX.writeFile(workbook, `SARP_Reporte_${activeTab}_${fiscalYear}.xlsx`);
        setShowExportMenu(false);
    };

    const handleExportPDF = () => {
        try {
            // Acceder a las librerías globales cargadas via <script>
            // @ts-ignore
            if (!window.jspdf || !window.jspdf.jsPDF) {
                console.error("jsPDF library not loaded");
                alert("Error: La librería de PDF no se ha cargado correctamente.");
                return;
            }

            // @ts-ignore
            const jsPDF = window.jspdf.jsPDF;
            const doc = new jsPDF('l', 'mm', 'a4'); // LANDSCAPE
            const title = `SARP - Reporte de Rentabilidad (${activeTab.toUpperCase()}) - ${fiscalYear}`;
            
            doc.setFontSize(16);
            doc.setTextColor(2, 48, 71); // sarp-dark-blue
            doc.text(title, 14, 15);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 22);

            let tableId = '';
            if (activeTab === 'general') tableId = 'general-table';
            else if (activeTab === 'executive') tableId = 'executive-table';
            else if (activeTab === 'freight_install') tableId = 'freight-install-table';

            // @ts-ignore
            doc.autoTable({
                html: `#${tableId}`,
                startY: 28,
                styles: { fontSize: 7, cellPadding: 1, textColor: [40, 40, 40] },
                headStyles: { fillColor: [243, 244, 246], textColor: [40, 40, 40], fontStyle: 'bold' },
                theme: 'grid',
                didParseCell: (data: any) => {
                    if (data.section === 'body') {
                        const row = data.row;
                        const firstCellText = row.cells[0] ? row.cells[0].text.join(' ').toUpperCase() : '';

                        // --- Color Lines Logic ---
                        if (firstCellText.startsWith('CLIENTE:')) {
                            data.cell.styles.fillColor = [209, 213, 219]; // bg-gray-300
                            data.cell.styles.textColor = [0, 0, 0];       // Black
                            data.cell.styles.fontStyle = 'bold';
                        } 
                        else if (firstCellText.startsWith('ESTATUS:')) {
                            data.cell.styles.fillColor = [243, 244, 246]; // bg-gray-100
                            data.cell.styles.textColor = [55, 65, 81];    // Dark Gray
                            data.cell.styles.fontStyle = 'bolditalic';
                        }
                        else if (firstCellText.startsWith('SUBTOTAL')) {
                            data.cell.styles.fillColor = [239, 246, 255]; // bg-blue-50
                            data.cell.styles.textColor = [30, 58, 138];   // Dark Blue
                            data.cell.styles.fontStyle = 'bold';
                        }
                        else if (firstCellText.startsWith('TOTAL CLIENTE')) {
                            data.cell.styles.fillColor = [191, 219, 254]; // bg-blue-200
                            data.cell.styles.textColor = [23, 37, 84];    // Darker Blue
                            data.cell.styles.fontStyle = 'bold';
                        }

                        // --- Conditional Number Logic (Preserve logic for percentages) ---
                        const cellText = data.cell.text[0];
                        if (cellText && cellText.includes('%')) {
                            const val = parseFloat(cellText.replace('%', ''));
                            if (!isNaN(val)) {
                                if (val < 0) data.cell.styles.textColor = [185, 28, 28]; // red-700
                                else if (val < 15) data.cell.styles.textColor = [194, 65, 12]; // orange-700
                                else data.cell.styles.textColor = [22, 101, 52]; // green-800
                            }
                        }
                    }
                }
            });

            doc.save(`SARP_Reporte_${activeTab}_${fiscalYear}.pdf`);
            setShowExportMenu(false);
        } catch (error) {
            console.error("PDF Export failed", error);
            alert("Hubo un error al generar el PDF. Verifique la consola.");
        }
    };

    return (
        <div className="space-y-6">
            <DrillDownModal 
                isOpen={drillDown.isOpen} 
                onClose={() => setDrillDown(p => ({...p, isOpen: false}))} 
                title={drillDown.title} 
                type={drillDown.type} 
                data={drillDown.data} 
            />
            
            <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Reporte de Rentabilidad</h1>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg mt-4 md:mt-0 shadow-inner">
                    {['general', 'executive', 'freight_install'].map(t => (
                        <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === t ? 'bg-white text-sarp-blue shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                            {t === 'general' ? 'General' : t === 'executive' ? 'Ejecutivo' : 'Costo Flete-Montaje'}
                        </button>
                    ))}
                </div>
            </header>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Filtros</h2>
                
                <div className="flex flex-col lg:flex-row gap-6 items-end">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente</label>
                            <select className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-sarp-blue focus:border-sarp-blue" value={selectedClientId || ''} onChange={e => setSelectedClientId(e.target.value ? parseInt(e.target.value) : undefined)}>
                                <option value="">Todos los clientes</option>
                                {clients.map(c => <option key={c.cliente_id} value={c.cliente_id}>{c.nombre_cliente}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Proyecto</label>
                            <select className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-sarp-blue focus:border-sarp-blue" value={selectedProjectId || ''} onChange={e => setSelectedProjectId(e.target.value ? parseInt(e.target.value) : undefined)}>
                                <option value="">Todos los proyectos</option>
                                {projects.filter(p => !selectedClientId || p.cliente_id === selectedClientId).map(p => <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre_proyecto}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-4 flex-shrink-0">
                        <FactorCard label="Factor Gastos Fab." value={factors.mfg} />
                        <FactorCard label="Factor Gastos Op." value={factors.op} />
                    </div>

                    <div className="relative" ref={exportRef}>
                        <button 
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 shadow-sm h-[48px]"
                        >
                            <DownloadIcon className="mr-2" /> Exportar
                        </button>
                        
                        {showExportMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-2xl z-50">
                                <button 
                                    onClick={handleExportExcel}
                                    className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center border-b border-gray-100"
                                >
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span> Excel (.xlsx)
                                </button>
                                <button 
                                    onClick={handleExportPDF}
                                    className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center"
                                >
                                    <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span> PDF (.pdf horizontal)
                                </button>
                            </div>
                        )}
                    </div>

                    <button onClick={handleGenerate} className="px-6 py-2 bg-sarp-blue text-white font-bold rounded-md hover:bg-opacity-90 transition-all shadow-md h-[48px] min-w-[120px]">
                        {isLoading ? '...' : 'Generar Reporte'}
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xl border border-gray-200 min-h-[400px]">
                <div className="mb-6 flex items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 inline-flex">
                    <span className="text-xs font-black text-sarp-dark-blue uppercase tracking-widest">Año Fiscal:</span>
                    <select value={fiscalYear} onChange={e => setFiscalYear(e.target.value)} className="bg-white border border-gray-300 rounded-md py-1 px-3 text-sm font-bold focus:ring-sarp-blue">
                        {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                    </select>
                </div>

                {!isLoading && reportData.length > 0 ? (
                    <>
                        {activeTab === 'freight_install' ? (
                            <FreightInstallReportView reportData={reportData} fiscalYear={fiscalYear} />
                        ) : activeTab === 'executive' ? (
                            <ExecutiveReportView 
                                reportData={reportData} 
                                groupedData={groupedData} 
                                manufacturingFactor={factors.mfg} 
                                operatingFactor={factors.op} 
                                onDrillDown={openDrill}
                                calculateTotals={calculateTotals}
                            />
                        ) : (
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 text-xs text-gray-900" id="general-table">
                                    <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm font-black text-gray-800 uppercase tracking-tighter">
                                        <tr className="border-b border-gray-300">
                                            <th className="px-4 py-4 text-left sticky left-0 z-30 bg-gray-100 border-r w-32 shadow-sm">Clave SAE / Proyecto</th>
                                            <th className="px-2 py-4 text-center">Cliente</th>
                                            <th className="px-2 py-4 text-center">Ejercicio</th>
                                            
                                            {showPriceDetail && (
                                                <>
                                                    <th className="px-2 py-4 text-right bg-blue-50/30">Precio Mobiliario</th>
                                                    <th className="px-2 py-4 text-right bg-blue-50/30">Precio Instalación</th>
                                                    <th className="px-2 py-4 text-right bg-blue-50/30">Precio Flete</th>
                                                    <th className="px-2 py-4 text-right bg-blue-50/30">Precio Servicios</th>
                                                </>
                                            )}
                                            <th onClick={() => setShowPriceDetail(!showPriceDetail)} className="px-3 py-4 text-right bg-blue-100 cursor-pointer hover:bg-blue-200 transition-colors border-x border-blue-200 group">
                                                Precio Venta Total <span className="text-blue-600 group-hover:scale-125 inline-block ml-1">{showPriceDetail ? '«' : '»'}</span>
                                            </th>

                                            {showMfgDetail && (
                                                <>
                                                    <th className="px-2 py-4 text-right bg-amber-50/50">Costo Materia Prima</th>
                                                    <th className="px-2 py-4 text-right bg-amber-50/50">Costo Mano de Obra</th>
                                                    <th className="px-2 py-4 text-right bg-amber-50/50">Gasto Fabricación</th>
                                                </>
                                            )}
                                            <th onClick={() => setShowMfgDetail(!showMfgDetail)} className="px-3 py-4 text-right bg-amber-100 cursor-pointer hover:bg-amber-200 transition-colors border-x border-amber-200 group">
                                                Subtotal Fabricación <span className="text-amber-600 group-hover:scale-125 inline-block ml-1">{showMfgDetail ? '«' : '»'}</span>
                                            </th>
                                            <th className="px-2 py-4 text-right">Margen Fabricación</th>

                                            {showLogisticsDetail && (
                                                <>
                                                    <th className="px-2 py-4 text-right bg-gray-50">Costo Fletes</th>
                                                    <th className="px-2 py-4 text-right bg-gray-50">Costo Instalación/Otros</th>
                                                </>
                                            )}
                                            <th onClick={() => setShowLogisticsDetail(!showLogisticsDetail)} className="px-3 py-4 text-right bg-gray-200 cursor-pointer hover:bg-gray-300 transition-colors border-x border-gray-300 group">
                                                Subtotal Venta <span className="text-gray-600 group-hover:scale-125 inline-block ml-1">{showLogisticsDetail ? '«' : '»'}</span>
                                            </th>

                                            <th className="px-2 py-4 text-right font-bold">Margen Bruto</th>
                                            <th className="px-2 py-4 text-right">Gasto Operación</th>
                                            <th className="px-2 py-4 text-right bg-blue-100">Margen Operativo</th>
                                            <th className="px-2 py-4 text-right bg-blue-100">% Margen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {Object.entries(groupedData).map(([client, statuses]: [string, any]) => {
                                            const clientItems = Object.values(statuses).flat() as ProfitabilityReport[];
                                            const clientTotals = calculateTotals(clientItems);
                                            return (
                                                <React.Fragment key={client}>
                                                    <tr className="bg-gray-300 font-black"><td colSpan={35} className="px-4 py-2 uppercase text-xs">CLIENTE: {client}</td></tr>
                                                    {Object.entries(statuses).map(([status, items]: [string, any]) => {
                                                        const statusTotals = calculateTotals(items);
                                                        return (
                                                            <React.Fragment key={status}>
                                                                <tr className="bg-gray-50 font-bold italic"><td colSpan={35} className="px-6 py-1 border-l-4 border-gray-400">ESTATUS: {status}</td></tr>
                                                                {items.map((item: ProfitabilityReport) => {
                                                                    const cGtoFab = (item.costo_total_materiales || 0) * factors.mfg;
                                                                    const subFab = (item.costo_total_materiales || 0) + (item.costo_total_mano_obra || 0) + cGtoFab;
                                                                    const cFletes = (item.detalles_adicionales || []).filter(d => d.tipo_costo === CostType.Flete).reduce((s,d)=>s+(d.monto || 0),0);
                                                                    const cInst = (item.detalles_adicionales || []).filter(d => d.tipo_costo !== CostType.Flete).reduce((s,d)=>s+(d.monto || 0),0);
                                                                    const subVta = cFletes + cInst;
                                                                    const marOp = (item.monto_venta_pactado || 0) - subFab - subVta - ((item.monto_venta_pactado || 0) * factors.op);
                                                                    const pMargen = item.monto_venta_pactado > 0 ? (marOp / item.monto_venta_pactado) * 100 : 0;
                                                                    return (
                                                                        <tr key={item.proyecto_id} className="hover:bg-blue-50/30 group transition-colors">
                                                                            <td className="px-4 py-3 font-bold sticky left-0 z-10 bg-white border-r group-hover:bg-blue-50/30">
                                                                                <div className="text-[10px] text-gray-500 font-mono">{item.nueva_sae}</div>
                                                                                {item.nombre_proyecto}
                                                                            </td>
                                                                            <td className="px-2 py-3 text-center text-gray-600 truncate max-w-[120px]">{client}</td>
                                                                            <td className="px-2 py-3 text-center text-gray-500">{item.ejercicio}</td>
                                                                            
                                                                            {showPriceDetail && (
                                                                                <>
                                                                                    <td className="px-2 py-3 text-right text-gray-600">{formatCurrency(item.precio_fabricacion)}</td>
                                                                                    <td className="px-2 py-3 text-right text-gray-600">{formatCurrency(item.precio_instalacion)}</td>
                                                                                    <td className="px-2 py-3 text-right text-gray-600">{formatCurrency(item.precio_flete)}</td>
                                                                                    <td className="px-2 py-3 text-right text-gray-600">{formatCurrency(item.precio_servicios)}</td>
                                                                                </>
                                                                            )}
                                                                            <td className="px-3 py-3 text-right font-black bg-blue-50/50 border-x border-blue-100">
                                                                                <span className="block">{formatCurrency(item.monto_venta_pactado)}</span>
                                                                                <PercentLabel value={item.monto_venta_pactado} total={item.monto_venta_pactado} />
                                                                            </td>

                                                                            {showMfgDetail && (
                                                                                <>
                                                                                    <td onClick={(e) => openDrill(e, `Materia Prima - ${item.nombre_proyecto}`, 'mat', item.detalles_materiales || [])} className="px-2 py-3 text-right cursor-pointer hover:underline text-sarp-blue">
                                                                                        <span className="block">{formatCurrency(item.costo_total_materiales)}</span>
                                                                                        <PercentLabel value={item.costo_total_materiales} total={item.monto_venta_pactado} />
                                                                                    </td>
                                                                                    <td onClick={(e) => openDrill(e, `Mano de Obra - ${item.nombre_proyecto}`, 'mo', item.detalles_mano_obra || [])} className="px-2 py-3 text-right cursor-pointer hover:underline text-sarp-blue">
                                                                                        <span className="block">{formatCurrency(item.costo_total_mano_obra)}</span>
                                                                                        <PercentLabel value={item.costo_total_mano_obra} total={item.monto_venta_pactado} />
                                                                                    </td>
                                                                                    <td className="px-2 py-3 text-right text-gray-600">
                                                                                        <span className="block">{formatCurrency(cGtoFab)}</span>
                                                                                        <PercentLabel value={cGtoFab} total={item.monto_venta_pactado} />
                                                                                    </td>
                                                                                </>
                                                                            )}
                                                                            <td className="px-3 py-3 text-right font-black bg-amber-50/50 border-x border-amber-100">
                                                                                <span className="block">{formatCurrency(subFab)}</span>
                                                                                <PercentLabel value={subFab} total={item.monto_venta_pactado} />
                                                                            </td>
                                                                            <td className="px-2 py-3 text-right font-bold text-gray-800">
                                                                                <span className="block">{formatCurrency((item.monto_venta_pactado || 0) - subFab)}</span>
                                                                                <PercentLabel value={(item.monto_venta_pactado || 0) - subFab} total={item.monto_venta_pactado} />
                                                                            </td>

                                                                            {showLogisticsDetail && (
                                                                                <>
                                                                                    <td className="px-2 py-3 text-right text-gray-600">{formatCurrency(cFletes)}</td>
                                                                                    <td className="px-2 py-3 text-right text-gray-600">{formatCurrency(cInst)}</td>
                                                                                </>
                                                                            )}
                                                                            <td className="px-3 py-3 text-right font-black bg-gray-50 border-x border-gray-100">
                                                                                <span className="block">{formatCurrency(subVta)}</span>
                                                                                <PercentLabel value={subVta} total={item.monto_venta_pactado} />
                                                                            </td>

                                                                            <td className="px-2 py-3 text-right font-black">{formatCurrency((item.monto_venta_pactado || 0) - subFab - subVta)}</td>
                                                                            <td className="px-2 py-3 text-right text-gray-600">{formatCurrency((item.monto_venta_pactado || 0) * factors.op)}</td>
                                                                            <td className={`px-2 py-3 text-right font-black bg-blue-50 border-l border-blue-100 ${getMarginColor(pMargen)}`}>
                                                                                <span className="block">{formatCurrency(marOp)}</span>
                                                                                <PercentLabel value={marOp} total={item.monto_venta_pactado} />
                                                                            </td>
                                                                            <td className={`px-2 py-3 text-right font-black bg-blue-50 ${getMarginColor(pMargen)}`}>{pMargen.toFixed(1)}%</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                                <tr className="bg-blue-50/50 font-black border-t-2 border-blue-200 text-blue-950">
                                                                    <td className="px-6 py-2 uppercase text-[10px]">SUBTOTAL {status}</td>
                                                                    <td colSpan={2}></td>
                                                                    
                                                                    {showPriceDetail && (
                                                                        <>
                                                                            <td className="px-2 py-2 text-right">{formatCurrency(statusTotals.p_mob)}</td>
                                                                            <td className="px-2 py-2 text-right">{formatCurrency(statusTotals.p_inst)}</td>
                                                                            <td className="px-2 py-2 text-right">{formatCurrency(statusTotals.p_flet)}</td>
                                                                            <td className="px-2 py-2 text-right">{formatCurrency(statusTotals.p_serv)}</td>
                                                                        </>
                                                                    )}
                                                                    <td className="px-2 py-2 text-right bg-blue-100/50 border-x border-blue-200">{formatCurrency(statusTotals.ventaTotal)}</td>

                                                                    {showMfgDetail && (
                                                                        <>
                                                                            <td className="px-2 py-2 text-right">{formatCurrency(statusTotals.mp)}</td>
                                                                            <td className="px-2 py-2 text-right">{formatCurrency(statusTotals.mo)}</td>
                                                                            <td className="px-2 py-2 text-right">{formatCurrency(statusTotals.gf)}</td>
                                                                        </>
                                                                    )}
                                                                    <td className="px-2 py-2 text-right bg-amber-100/50 border-x border-amber-200">{formatCurrency(statusTotals.subFab)}</td>
                                                                    <td className="px-2 py-2 text-right">{formatCurrency(statusTotals.marFab)}</td>
                                                                    
                                                                    {showLogisticsDetail && (
                                                                        <>
                                                                            <td className="px-2 py-2 text-right">{formatCurrency(statusTotals.c_flet)}</td>
                                                                            <td className="px-2 py-2 text-right">{formatCurrency(statusTotals.c_inst)}</td>
                                                                        </>
                                                                    )}
                                                                    <td className="px-2 py-2 text-right bg-gray-100 border-x border-gray-200">{formatCurrency(statusTotals.subVta)}</td>
                                                                    <td className="px-2 py-2 text-right font-black">{formatCurrency(statusTotals.marBruto)}</td>
                                                                    <td className="px-2 py-2 text-right">{formatCurrency(statusTotals.gtoOp)}</td>
                                                                    <td className="px-2 py-2 text-right bg-blue-100/80">{formatCurrency(statusTotals.marOp)}</td>
                                                                    <td className="px-2 py-2 text-right bg-blue-100/80">{statusTotals.percent.toFixed(1)}%</td>
                                                                </tr>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-white p-12 rounded-xl shadow-lg text-center text-gray-500 border border-dashed border-gray-300">
                        <p>{isLoading ? 'Procesando auditoría de proyectos...' : 'No hay datos de rentabilidad disponibles para el año seleccionado.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Report;
