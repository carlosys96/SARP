
import React, { useState, useEffect } from 'react';
import type { HourTransaction, MaterialTransaction, AdditionalCost, LogEntry, Proyecto } from '../../types';
import { CostType } from '../../types';
import { CloseIcon, CalendarIcon } from '../icons/Icons';

const baseInputClasses = "mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-base text-gray-900 shadow-sm focus:outline-none focus:ring-sarp-blue focus:border-sarp-blue sm:text-sm";
const baseSelectClasses = `${baseInputClasses} pl-3 pr-10`;
const datePickerInputClasses = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sarp-blue focus:border-sarp-blue block w-full pl-10 p-2.5";


// --- Generic Modal Wrapper ---
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; }> = ({ isOpen, onClose, title, children, footer }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-sarp-gray">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><CloseIcon /></button>
                </header>
                <main className="p-6 overflow-y-auto">{children}</main>
                {footer && <footer className="flex justify-end items-center p-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">{footer}</footer>}
            </div>
        </div>
    );
};


// --- Confirmation Dialog ---
export const ConfirmationDialog: React.FC<{ title: string; message: string; confirmText?: string; onConfirm: () => void; onCancel: () => void; }> = ({ title, message, confirmText = 'Eliminar', onConfirm, onCancel }) => (
    <Modal isOpen={true} onClose={onCancel} title={title}>
        <p className="text-gray-600">{message}</p>
        <div className="flex justify-end space-x-4 mt-6">
            <button onClick={onCancel} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Cancelar</button>
            <button onClick={onConfirm} className={`px-4 py-2 rounded-md text-sm font-medium text-white ${confirmText === 'Eliminar' ? 'bg-sarp-red hover:bg-sarp-red/90' : 'bg-sarp-blue hover:bg-sarp-blue/90'}`}>{confirmText}</button>
        </div>
    </Modal>
);

// --- Log Modal ---
export const LogModal: React.FC<{ isOpen: boolean, onClose: () => void, logs: LogEntry[] }> = ({ isOpen, onClose, logs }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Historial de Cambios">
        {logs.length === 0 ? (
            <p className="text-gray-500">No hay historial de cambios para este registro (simulación).</p>
        ) : (
            <ul className="space-y-4">
                {logs.map(log => (
                    <li key={log.log_id} className="border-b pb-2">
                        <p className="font-semibold text-gray-800">{log.action}</p>
                        <p className="text-sm text-gray-500">Por: {log.user_name}</p>
                        <p className="text-sm text-gray-500">Fecha: {new Date(log.timestamp).toLocaleString()}</p>
                        {log.changes && Array.isArray(log.changes) && log.changes.length > 0 && (
                            <div className="mt-1 text-xs">
                                {log.changes.map((c, i) => <p key={i}>- Campo <span className="font-medium">{c.field}</span>: de '{String(c.oldValue)}' a '{String(c.newValue)}'</p>)}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        )}
    </Modal>
);

// --- Edit Modals ---
export const EditHourModal: React.FC<{ isOpen: boolean, onClose: () => void, transaction: HourTransaction, onSave: (t: HourTransaction) => void }> = ({ isOpen, onClose, transaction, onSave }) => {
    const [formData, setFormData] = useState(transaction);
    useEffect(() => setFormData(transaction), [transaction]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Registro de Horas" footer={
            <>
                <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Cancelar</button>
                <button onClick={() => onSave(formData)} className="ml-3 px-4 py-2 rounded-md text-sm font-medium text-white bg-sarp-blue hover:bg-opacity-90">Guardar Cambios</button>
            </>
        }>
            <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700">Horas Registradas</label><input type="number" name="horas_registradas" value={formData.horas_registradas} onChange={handleChange} className={baseInputClasses}/></div>
                <div><label className="block text-sm font-medium text-gray-700">Costo por Hora</label><input type="number" name="costo_hora_real" value={formData.costo_hora_real} onChange={handleChange} className={baseInputClasses}/></div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha</label>
                    <div className="relative max-w-sm">
                        <div className="absolute inset-y-0 start-0 flex items-center pl-3.5 pointer-events-none">
                            <CalendarIcon className="text-gray-500 h-4 w-4" />
                        </div>
                        <input 
                            type="date" 
                            name="fecha_registro" 
                            value={formData.fecha_registro} 
                            onChange={handleChange} 
                            onClick={(e) => { const input = e.target as HTMLInputElement; if (input.showPicker) input.showPicker(); }}
                            className={datePickerInputClasses}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export const EditMaterialModal: React.FC<{ isOpen: boolean, onClose: () => void, transaction: MaterialTransaction, onSave: (t: MaterialTransaction) => void }> = ({ isOpen, onClose, transaction, onSave }) => {
    const [formData, setFormData] = useState(transaction);
    useEffect(() => setFormData(transaction), [transaction]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Consumo de Material" footer={
             <>
                <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Cancelar</button>
                <button onClick={() => onSave(formData)} className="ml-3 px-4 py-2 rounded-md text-sm font-medium text-white bg-sarp-blue hover:bg-opacity-90">Guardar Cambios</button>
            </>
        }>
             <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700">Cantidad</label><input type="number" name="cantidad" value={formData.cantidad} onChange={handleChange} className={baseInputClasses}/></div>
                <div><label className="block text-sm font-medium text-gray-700">Costo Unitario</label><input type="number" name="costo_unitario" value={formData.costo_unitario} onChange={handleChange} className={baseInputClasses}/></div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha</label>
                    <div className="relative max-w-sm">
                        <div className="absolute inset-y-0 start-0 flex items-center pl-3.5 pointer-events-none">
                            <CalendarIcon className="text-gray-500 h-4 w-4" />
                        </div>
                        <input 
                            type="date" 
                            name="fecha_movimiento_sae" 
                            value={formData.fecha_movimiento_sae} 
                            onChange={handleChange} 
                            onClick={(e) => { const input = e.target as HTMLInputElement; if (input.showPicker) input.showPicker(); }}
                            className={datePickerInputClasses}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export const EditCostModal: React.FC<{ isOpen: boolean, onClose: () => void, cost: AdditionalCost, onSave: (c: AdditionalCost) => void, projects: Proyecto[] }> = ({ isOpen, onClose, cost, onSave, projects }) => {
    const [formData, setFormData] = useState(cost);
    const [otherConcept, setOtherConcept] = useState('');

    useEffect(() => {
        const initialData = { ...cost };
        setOtherConcept(initialData.otro_concepto || '');
        setFormData(initialData);
    }, [cost]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: name === 'proyecto_id' || name === 'monto' ? parseFloat(value) : value });
    };
    
    const handleSaveClick = () => {
        const finalData = { 
            ...formData,
            otro_concepto: formData.tipo_costo === CostType.Otros ? otherConcept : undefined
        };
        onSave(finalData);
    }
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Costo Adicional" footer={
             <>
                <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Cancelar</button>
                <button onClick={handleSaveClick} className="ml-3 px-4 py-2 rounded-md text-sm font-medium text-white bg-sarp-blue hover:bg-opacity-90">Guardar Cambios</button>
            </>
        }>
            <div className="space-y-4">
                 <div><label className="block text-sm font-medium text-gray-700">Proyecto</label><select name="proyecto_id" value={formData.proyecto_id} onChange={handleChange} className={baseSelectClasses}>{projects.map(p => <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre_proyecto}</option>)}</select></div>
                 <div><label className="block text-sm font-medium text-gray-700">Tipo de Costo</label><select name="tipo_costo" value={formData.tipo_costo} onChange={handleChange} className={baseSelectClasses}>{Object.values(CostType).map(ct => <option key={ct} value={ct}>{ct}</option>)}</select></div>
                 <div><label className="block text-sm font-medium text-gray-700">Monto</label><input type="number" name="monto" value={formData.monto} onChange={handleChange} className={baseInputClasses}/></div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha</label>
                    <div className="relative max-w-sm">
                        <div className="absolute inset-y-0 start-0 flex items-center pl-3.5 pointer-events-none">
                            <CalendarIcon className="text-gray-500 h-4 w-4" />
                        </div>
                        <input 
                            type="date" 
                            name="fecha" 
                            value={formData.fecha} 
                            onChange={handleChange} 
                            onClick={(e) => { const input = e.target as HTMLInputElement; if (input.showPicker) input.showPicker(); }}
                            className={datePickerInputClasses}
                        />
                    </div>
                </div>
                 
                 {formData.tipo_costo === CostType.Otros && (
                    <div className="bg-yellow-50 p-2 rounded border border-yellow-100">
                         <label className="block text-sm font-medium text-yellow-800">Concepto <span className="text-red-500">*</span></label>
                         <input type="text" value={otherConcept} onChange={(e) => setOtherConcept(e.target.value)} className={baseInputClasses} placeholder="Ej. Compra EPP"/>
                    </div>
                 )}

                 <div><label className="block text-sm font-medium text-gray-700">Descripción</label><textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows={3} className={baseInputClasses}></textarea></div>
            </div>
        </Modal>
    );
};
