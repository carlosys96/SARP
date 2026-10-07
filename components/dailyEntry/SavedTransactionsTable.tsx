import React from 'react';
import type { HourTransaction } from '../../types';
import { CloseIcon } from '../icons/Icons';

interface SavedTransactionsTableProps {
    transactions: Omit<HourTransaction, 'transaccion_id' | '_row'>[];
    onClose: () => void;
}

export const SavedTransactionsTable: React.FC<SavedTransactionsTableProps> = ({
    transactions,
    onClose,
}) => {
    if (transactions.length === 0) return null;

    const weekNum = transactions[0]?.semana_del_anio || 1;
    const totalHours = transactions.reduce((sum, t) => sum + (t.horas_registradas || 0), 0);

    return (
        <div 
            id="saved-transactions-container"
            className="mb-6 bg-surface border border-line rounded-lg overflow-hidden shadow-sm animate-fadeIn"
        >
            <div className="bg-surface2 px-4 py-3 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green"></span>
                    <h3 className="text-[0.9375rem] font-bold text-ink tracking-tight">
                        {transactions.length} registros generados · semana {weekNum}
                    </h3>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1 text-ink3 hover:text-ink rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    title="Ocultar resumen de guardado"
                    aria-label="Ocultar resumen de guardado"
                >
                    <CloseIcon size={4} />
                </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-surface2 z-10 border-b border-line text-ink2">
                        <tr>
                            <th className="py-2.5 px-3 font-semibold uppercase tracking-[0.08em] text-[0.6875rem]">Empleado</th>
                            <th className="py-2.5 px-3 font-semibold uppercase tracking-[0.08em] text-[0.6875rem]">Proyecto / Concepto</th>
                            <th className="py-2.5 px-3 font-semibold uppercase tracking-[0.08em] text-[0.6875rem]">Concepto Contable</th>
                            <th className="py-2.5 px-3 font-semibold uppercase tracking-[0.08em] text-[0.6875rem] text-center">Tipo</th>
                            <th className="py-2.5 px-3 font-semibold uppercase tracking-[0.08em] text-[0.6875rem] text-right">Hrs</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-ink">
                        {transactions.map((t, idx) => {
                            const isExtra = t.tipo_hora === 'Extra';
                            return (
                                <tr key={idx} className="hover:bg-surface2/50 transition-colors">
                                    <td className="py-2 px-3 font-medium truncate max-w-[160px]" title={t.nombre_completo_empleado}>
                                        {t.nombre_completo_empleado}
                                    </td>
                                    <td className="py-2 px-3 font-mono text-ink2 truncate max-w-[180px]" title={t.nombre_proyecto}>
                                        {t.nombre_proyecto}
                                    </td>
                                    <td className="py-2 px-3 text-ink3">
                                        {t.concept || '—'}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                        <span className={`inline-block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded border ${
                                            isExtra 
                                                ? 'bg-blue-50 border-blue-200 text-sarp-blue' 
                                                : 'bg-surface2 border-line text-ink2'
                                        }`}>
                                            {t.tipo_hora || 'Normal'}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 font-mono text-right tabular-nums font-semibold">
                                        {t.horas_registradas.toFixed(1)} h
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-surface2 font-semibold border-t-2 border-line text-ink">
                        <tr>
                            <td colSpan={4} className="py-2.5 px-3 uppercase tracking-[0.09em] text-[0.6875rem] text-ink2">
                                Totales del guardado
                            </td>
                            <td className="py-2.5 px-3 font-mono text-right tabular-nums text-sm font-bold text-ink">
                                {totalHours.toFixed(1)} h
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};
