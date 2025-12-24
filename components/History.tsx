
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { apiService } from '../services/api';
import type { Proyecto, HourTransaction, MaterialTransaction, AdditionalCost, DeletedItem, LogEntry } from '../types';
import { EditIcon, TrashIcon, LogbookIcon, CalendarIcon, RestoreIcon, DownloadIcon } from './icons/Icons';
import { ConfirmationDialog, LogModal, EditHourModal, EditMaterialModal, EditCostModal } from './history/Modals';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

type HistoryTab = 'hours' | 'materials' | 'costs' | 'deleted';

const datePickerInputClasses = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sarp-blue focus:border-sarp-blue block w-full pl-10 p-2.5";

// Reusable Checkbox Component (Same as Admin)
const Checkbox: React.FC<{ checked: boolean, onChange: () => void }> = ({ checked, onChange }) => (
    <div onClick={(e) => { e.stopPropagation(); onChange(); }} className="flex items-center justify-center cursor-pointer p-1">
        <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${checked ? 'bg-sarp-blue border-sarp-blue' : 'bg-white border-gray-300 hover:border-gray-400'}`}>
            {checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
        </div>
    </div>
);

const TabButton: React.FC<{name: string, isActive: boolean, onClick: () => void}> = ({ name, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`${
            isActive
                ? 'border-sarp-blue text-sarp-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
    >
        {name}
    </button>
);

const History: React.FC = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<HistoryTab>('hours');
    const [projects, setProjects] = useState<Proyecto[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Data states
    const [hourData, setHourData] = useState<HourTransaction[]>([]);
    const [materialData, setMaterialData] = useState<MaterialTransaction[]>([]);
    const [costData, setCostData] = useState<AdditionalCost[]>([]);
    const [deletedData, setDeletedData] = useState<DeletedItem[]>([]);
    const [logData, setLogData] = useState<LogEntry[]>([]);
    
    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Modal states
    const [modalState, setModalState] = useState<{ type: 'edit' | 'delete' | 'logs' | 'restore' | 'bulk-delete' | 'bulk-restore' | null, data: any, entityType?: 'Hour' | 'Material' | 'Cost' }>({ type: null, data: null });

    // Filter states
    const [filters, setFilters] = useState({
        proyecto_id: undefined as number | undefined,
        startDate: '',
        endDate: '',
    });

    // Reset selection when tab changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [activeTab, filters]);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [proj, hours, materials, costs, deleted] = await Promise.all([
                apiService.getProjects(),
                apiService.getHourTransactions(filters),
                apiService.getMaterialTransactions(filters),
                apiService.getAdditionalCosts(filters),
                apiService.getDeletedItems(),
            ]);
            setProjects(proj);
            setHourData(hours);
            setMaterialData(materials);
            setCostData(costs);
            setDeletedData(deleted);
        } catch (error) {
            console.error("Failed to fetch historical data", error);
            addToast("Error al cargar datos históricos", 'error');
        } finally {
            setIsLoading(false);
        }
    }, [filters, addToast]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: name === 'proyecto_id' ? (value ? parseInt(value) : undefined) : value,
        }));
    };
    
    const handleAction = (type: 'edit' | 'delete' | 'logs' | 'restore', data: any, entityType: 'Hour' | 'Material' | 'Cost') => {
        setModalState({ type, data, entityType });
    };

    // --- Selection Logic ---
    const handleToggleSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const getCurrentDataIds = () => {
        switch (activeTab) {
            case 'hours': return hourData.map(h => h.transaccion_id);
            case 'materials': return materialData.map(m => m.transaccion_id);
            case 'costs': return costData.map(c => c.transaccion_id!);
            case 'deleted': return deletedData.map(d => d.transaccion_id!); // Note: deleted items might conflict if ID logic isn't unique across tables, but typical use case assumes UI stability
            default: return [];
        }
    };

    const handleToggleAll = () => {
        const currentIds = getCurrentDataIds();
        if (selectedIds.size === currentIds.length && currentIds.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(currentIds));
        }
    };

    // --- Bulk Logic ---
    const handleBulkActionClick = () => {
        if (selectedIds.size === 0) return;
        if (activeTab === 'deleted') {
            setModalState({ type: 'bulk-restore', data: Array.from(selectedIds) });
        } else {
            setModalState({ type: 'bulk-delete', data: Array.from(selectedIds) });
        }
    };

    const handleConfirmBulkAction = async () => {
        const ids = modalState.data as number[];
        const userName = user?.nombre || 'Desconocido';
        setIsLoading(true);
        setModalState({ type: null, data: null }); // Close modal immediately

        try {
            let successCount = 0;
            let errors = 0;

            const promises = ids.map(async (id) => {
                try {
                    if (activeTab === 'hours') {
                        await apiService.deleteHourTransaction(id, userName);
                    } else if (activeTab === 'materials') {
                        await apiService.deleteMaterialTransaction(id, userName);
                    } else if (activeTab === 'costs') {
                        await apiService.deleteAdditionalCost(id, userName);
                    } else if (activeTab === 'deleted') {
                        // Find the item to know its type
                        const item = deletedData.find(d => d.transaccion_id === id);
                        if (item) {
                            if (item.entity_type === 'Hour') await apiService.restoreHourTransaction(id, userName);
                            else if (item.entity_type === 'Material') await apiService.restoreMaterialTransaction(id, userName);
                            else if (item.entity_type === 'Cost') await apiService.restoreAdditionalCost(id, userName);
                        }
                    }
                    successCount++;
                } catch (e) {
                    console.error(`Error processing ID ${id}`, e);
                    errors++;
                }
            });

            await Promise.all(promises);
            
            if (successCount > 0) addToast(`${successCount} registros procesados exitosamente.`, 'success');
            if (errors > 0) addToast(`Hubo errores en ${errors} registros.`, 'error');

            setSelectedIds(new Set());
            await fetchAllData();

        } catch (error) {
            addToast("Error crítico en la operación masiva.", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Single Action Handlers ---
    const handleConfirmDelete = async () => {
        if (!modalState.data || !modalState.entityType) return;
        const id = modalState.data.transaccion_id || modalState.data.costo_id; 
        const userName = user?.nombre || 'Desconocido';

        try {
            switch (modalState.entityType) {
                case 'Hour': await apiService.deleteHourTransaction(id, userName); break;
                case 'Material': await apiService.deleteMaterialTransaction(id, userName); break;
                case 'Cost': await apiService.deleteAdditionalCost(id, userName); break;
            }
            addToast("Registro eliminado.", 'success');
            setModalState({ type: null, data: null });
            fetchAllData();
        } catch (e) { addToast("Error al eliminar.", 'error'); }
    };
    
    const handleConfirmRestore = async () => {
        if (!modalState.data || !modalState.entityType) return;
        const id = modalState.data.transaccion_id || modalState.data.costo_id;
        const userName = user?.nombre || 'Desconocido';

        try {
            switch (modalState.entityType) {
                case 'Hour': await apiService.restoreHourTransaction(id, userName); break;
                case 'Material': await apiService.restoreMaterialTransaction(id, userName); break;
                case 'Cost': await apiService.restoreAdditionalCost(id, userName); break;
            }
            addToast("Registro restaurado.", 'success');
            setModalState({ type: null, data: null });
            fetchAllData();
        } catch (e) { addToast("Error al restaurar.", 'error'); }
    }
    
    const handleSaveEdit = async (editedData: any) => {
        if (!modalState.entityType) return;
        const userName = user?.nombre || 'Desconocido';
        try {
            switch (modalState.entityType) {
                case 'Hour': await apiService.updateHourTransaction(editedData, userName); break;
                case 'Material': await apiService.updateMaterialTransaction(editedData, userName); break;
                case 'Cost': await apiService.updateAdditionalCost(editedData, userName); break;
            }
            addToast("Cambios guardados.", 'success');
            setModalState({ type: null, data: null });
            fetchAllData();
        } catch (e) { addToast("Error al guardar cambios.", 'error'); }
    }
    
    useEffect(() => {
        if(modalState.type === 'logs' && modalState.entityType && modalState.data) {
            const id = modalState.data.transaccion_id;
            if (id) {
                apiService.getLogsForEntity(id, modalState.entityType).then(setLogData);
            }
        }
    }, [modalState]);

    const handleExportExcel = () => {
        let dataToExport: any[] = [];
        let sheetName = "";

        switch(activeTab) {
            case 'hours':
                dataToExport = hourData;
                sheetName = "Horas";
                break;
            case 'materials':
                dataToExport = materialData;
                sheetName = "Materiales";
                break;
            case 'costs':
                dataToExport = costData;
                sheetName = "Costos";
                break;
            case 'deleted':
                dataToExport = deletedData;
                sheetName = "Eliminados";
                break;
        }

        if (dataToExport.length === 0) {
            addToast("No hay datos para exportar.", 'info');
            return;
        }

        // Clean data for export (remove internal fields)
        const cleanData = dataToExport.map(({ _row, is_deleted, ...rest }) => rest);

        const workbook = XLSX.utils.book_new();
        const sheet = XLSX.utils.json_to_sheet(cleanData);
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
        XLSX.writeFile(workbook, `SARP_Historico_${sheetName}_${new Date().toISOString().slice(0,10)}.xlsx`);
    };


    const formatCurrency = (value: number) => value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    const renderContent = () => {
        if (isLoading && !modalState.type) {
            return <div className="text-center p-8">Cargando datos desde Google Sheets...</div>;
        }

        switch (activeTab) {
            case 'hours': return <HoursTable data={hourData} selectedIds={selectedIds} onToggle={handleToggleSelection} onToggleAll={handleToggleAll} onAction={handleAction} formatCurrency={formatCurrency} />;
            case 'materials': return <MaterialsTable data={materialData} selectedIds={selectedIds} onToggle={handleToggleSelection} onToggleAll={handleToggleAll} onAction={handleAction} formatCurrency={formatCurrency} />;
            case 'costs': return <CostsTable data={costData} selectedIds={selectedIds} onToggle={handleToggleSelection} onToggleAll={handleToggleAll} onAction={handleAction} formatCurrency={formatCurrency} />;
            case 'deleted': return <DeletedItemsTable data={deletedData} selectedIds={selectedIds} onToggle={handleToggleSelection} onToggleAll={handleToggleAll} onAction={handleAction} formatCurrency={formatCurrency} />;
            default: return null;
        }
    };

    return (
        <div>
            {modalState.type === 'delete' && (
                <ConfirmationDialog
                    title="Confirmar Eliminación"
                    message="¿Está seguro de que desea mover este registro a la papelera?"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setModalState({ type: null, data: null })}
                />
            )}
             {modalState.type === 'bulk-delete' && (
                <ConfirmationDialog
                    title="Confirmar Eliminación Masiva"
                    message={`¿Está seguro de que desea mover ${modalState.data?.length} registros a la papelera?`}
                    onConfirm={handleConfirmBulkAction}
                    onCancel={() => setModalState({ type: null, data: null })}
                />
            )}
             {modalState.type === 'restore' && (
                <ConfirmationDialog
                    title="Confirmar Restauración"
                    message="¿Está seguro de que desea restaurar este registro?"
                    confirmText="Restaurar"
                    onConfirm={handleConfirmRestore}
                    onCancel={() => setModalState({ type: null, data: null })}
                />
            )}
            {modalState.type === 'bulk-restore' && (
                <ConfirmationDialog
                    title="Confirmar Restauración Masiva"
                    message={`¿Está seguro de que desea restaurar ${modalState.data?.length} registros?`}
                    confirmText="Restaurar"
                    onConfirm={handleConfirmBulkAction}
                    onCancel={() => setModalState({ type: null, data: null })}
                />
            )}
            {modalState.type === 'logs' && (
                <LogModal
                    isOpen={true}
                    onClose={() => setModalState({ type: null, data: null })}
                    logs={logData}
                />
            )}
             {modalState.type === 'edit' && modalState.entityType === 'Hour' && (
                <EditHourModal
                    isOpen={true}
                    onClose={() => setModalState({ type: null, data: null })}
                    transaction={modalState.data}
                    onSave={handleSaveEdit}
                />
            )}
             {modalState.type === 'edit' && modalState.entityType === 'Material' && (
                <EditMaterialModal
                    isOpen={true}
                    onClose={() => setModalState({ type: null, data: null })}
                    transaction={modalState.data}
                    onSave={handleSaveEdit}
                />
            )}
            {modalState.type === 'edit' && modalState.entityType === 'Cost' && (
                <EditCostModal
                    isOpen={true}
                    onClose={() => setModalState({ type: null, data: null })}
                    cost={modalState.data}
                    onSave={handleSaveEdit}
                    projects={projects}
                />
            )}

            <h1 className="text-3xl font-bold text-sarp-gray mb-6">Consulta de Históricos</h1>
             <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
                <h2 className="text-xl font-semibold text-sarp-gray mb-4">Filtros</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 md:items-end gap-4">
                    <div className="flex-1 md:col-span-2">
                        <label htmlFor="projectFilter" className="block text-sm font-medium text-gray-700">Proyecto</label>
                        <select id="projectFilter" name="proyecto_id" className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-50 border border-gray-300 focus:outline-none focus:ring-sarp-blue focus:border-sarp-blue sm:text-sm rounded-md shadow-sm" value={filters.proyecto_id || ''} onChange={handleFilterChange}>
                            <option value="">Todos los proyectos</option>
                            {projects.map(p => <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre_proyecto}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Fecha de Inicio</label>
                        <div className="relative max-w-sm mt-1">
                            <div className="absolute inset-y-0 start-0 flex items-center pl-3.5 pointer-events-none">
                                <CalendarIcon className="text-gray-500 h-4 w-4" />
                            </div>
                            <input 
                                type="date" 
                                id="startDate" 
                                name="startDate" 
                                value={filters.startDate} 
                                onChange={handleFilterChange} 
                                onClick={(e) => { const input = e.target as HTMLInputElement; if (input.showPicker) input.showPicker(); }}
                                className={datePickerInputClasses} 
                            />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Fecha de Fin</label>
                         <div className="relative max-w-sm mt-1">
                            <div className="absolute inset-y-0 start-0 flex items-center pl-3.5 pointer-events-none">
                                <CalendarIcon className="text-gray-500 h-4 w-4" />
                            </div>
                            <input 
                                type="date" 
                                id="endDate" 
                                name="endDate" 
                                value={filters.endDate} 
                                onChange={handleFilterChange} 
                                onClick={(e) => { const input = e.target as HTMLInputElement; if (input.showPicker) input.showPicker(); }}
                                className={datePickerInputClasses} 
                            />
                        </div>
                    </div>
                    <div className="md:col-span-4 flex justify-end space-x-3 mt-2">
                        <button onClick={handleExportExcel} className="flex items-center justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
                            <DownloadIcon className="mr-2" /> Exportar Excel
                        </button>
                        <button onClick={fetchAllData} disabled={isLoading} className="py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sarp-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sarp-blue disabled:bg-gray-400">
                            {isLoading ? 'Buscando...' : 'Buscar'}
                        </button>
                    </div>
                </div>
            </div>

            {selectedIds.size > 0 && (
                <div className={`flex items-center justify-between border rounded-lg p-2 mb-3 px-4 animate-fade-in ${activeTab === 'deleted' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                    <span className={`text-sm font-semibold ${activeTab === 'deleted' ? 'text-green-800' : 'text-sarp-blue'}`}>{selectedIds.size} elementos seleccionados</span>
                    <button onClick={handleBulkActionClick} className={`flex items-center px-3 py-1.5 bg-white border rounded-md text-sm font-bold transition-colors shadow-sm ${activeTab === 'deleted' ? 'border-green-300 text-green-600 hover:bg-green-100' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                        {activeTab === 'deleted' ? <><RestoreIcon size={4} className="mr-2"/> Restaurar Selección</> : <><TrashIcon size={4} className="mr-2"/> Eliminar Selección</>}
                    </button>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-lg">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 px-6 overflow-x-auto" aria-label="Tabs">
                        <TabButton name="Horas Registradas" isActive={activeTab === 'hours'} onClick={() => setActiveTab('hours')} />
                        <TabButton name="Consumo de Materiales" isActive={activeTab === 'materials'} onClick={() => setActiveTab('materials')} />
                        <TabButton name="Costos Adicionales" isActive={activeTab === 'costs'} onClick={() => setActiveTab('costs')} />
                        <TabButton name="Eliminados" isActive={activeTab === 'deleted'} onClick={() => setActiveTab('deleted')} />
                    </nav>
                </div>
                <div className="p-1 sm:p-6">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

// --- TABLE COMPONENTS ---

const ActionButtons: React.FC<{item: any, entityType: 'Hour' | 'Material' | 'Cost', onAction: Function}> = ({ item, entityType, onAction }) => (
    <td className="px-4 py-4 text-sm font-medium text-right space-x-3">
        <button onClick={(e) => { e.stopPropagation(); onAction('logs', item, entityType); }} className="text-gray-400 hover:text-sarp-blue" title="Ver Historial"><LogbookIcon size={5}/></button>
        <button onClick={(e) => { e.stopPropagation(); onAction('edit', item, entityType); }} className="text-sarp-blue hover:text-sarp-blue/80" title="Editar"><EditIcon size={5}/></button>
        <button onClick={(e) => { e.stopPropagation(); onAction('delete', item, entityType); }} className="text-sarp-red hover:text-sarp-red/80" title="Eliminar"><TrashIcon size={5}/></button>
    </td>
);

const HoursTable: React.FC<{data: HourTransaction[], selectedIds: Set<number>, onToggle: (id: number) => void, onToggleAll: () => void, formatCurrency: (v: number) => string, onAction: Function}> = ({ data, selectedIds, onToggle, onToggleAll, formatCurrency, onAction }) => (
    data.length === 0 ? <p className="text-center text-gray-500 py-4">No hay datos de horas para los filtros seleccionados.</p> :
    <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>
        <th className="px-4 py-3 w-10 text-center"><Checkbox checked={selectedIds.size > 0 && selectedIds.size === data.length} onChange={onToggleAll} /></th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proyecto</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleado</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Horas</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo/Hr</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Total</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
    </tr></thead><tbody className="bg-white divide-y divide-gray-200">
        {data.map(h => (<tr key={h.transaccion_id} className={selectedIds.has(h.transaccion_id) ? 'bg-blue-50' : ''} onClick={() => onToggle(h.transaccion_id)}>
            <td className="px-4 py-4 text-center"><Checkbox checked={selectedIds.has(h.transaccion_id)} onChange={() => onToggle(h.transaccion_id)} /></td>
            <td className="px-4 py-4 text-sm text-gray-500">{h.fecha_registro}</td>
            <td className="px-4 py-4 text-sm text-gray-900">{h.nombre_proyecto}</td>
            <td className="px-4 py-4 text-sm text-gray-500">{h.nombre_completo_empleado}</td>
            <td className="px-4 py-4 text-sm text-gray-500 text-right">{h.horas_registradas}</td>
            <td className="px-4 py-4 text-sm text-gray-500 text-right">{formatCurrency(h.costo_hora_real)}</td>
            <td className="px-4 py-4 text-sm text-gray-800 font-semibold text-right">{formatCurrency(h.costo_total_mo)}</td>
            <ActionButtons item={h} entityType="Hour" onAction={onAction} />
        </tr>))}
    </tbody></table></div>
);

const MaterialsTable: React.FC<{data: MaterialTransaction[], selectedIds: Set<number>, onToggle: (id: number) => void, onToggleAll: () => void, formatCurrency: (v: number) => string, onAction: Function}> = ({ data, selectedIds, onToggle, onToggleAll, formatCurrency, onAction }) => (
     data.length === 0 ? <p className="text-center text-gray-500 py-4">No hay datos de materiales para los filtros seleccionados.</p> :
    <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>
        <th className="px-4 py-3 w-10 text-center"><Checkbox checked={selectedIds.size > 0 && selectedIds.size === data.length} onChange={onToggleAll} /></th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proyecto</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Parte</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Unit.</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Total</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
    </tr></thead><tbody className="bg-white divide-y divide-gray-200">
        {data.map(m => (<tr key={m.transaccion_id} className={selectedIds.has(m.transaccion_id) ? 'bg-blue-50' : ''} onClick={() => onToggle(m.transaccion_id)}>
            <td className="px-4 py-4 text-center"><Checkbox checked={selectedIds.has(m.transaccion_id)} onChange={() => onToggle(m.transaccion_id)} /></td>
            <td className="px-4 py-4 text-sm text-gray-500">{m.fecha_movimiento_sae}</td>
            <td className="px-4 py-4 text-sm text-gray-900">{m.nombre_proyecto}</td>
            <td className="px-4 py-4 text-sm text-gray-500">{m.numero_parte_sae}</td>
            <td className="px-4 py-4 text-sm text-gray-500">{m.descripcion_material}</td>
            <td className="px-4 py-4 text-sm text-gray-500 text-right">{m.cantidad}</td>
            <td className="px-4 py-4 text-sm text-gray-500 text-right">{formatCurrency(m.costo_unitario)}</td>
            <td className="px-4 py-4 text-sm text-gray-800 font-semibold text-right">{formatCurrency(m.costo_total_material)}</td>
            <ActionButtons item={m} entityType="Material" onAction={onAction} />
        </tr>))}
    </tbody></table></div>
);

const CostsTable: React.FC<{data: AdditionalCost[], selectedIds: Set<number>, onToggle: (id: number) => void, onToggleAll: () => void, formatCurrency: (v: number) => string, onAction: Function}> = ({ data, selectedIds, onToggle, onToggleAll, formatCurrency, onAction }) => (
    data.length === 0 ? <p className="text-center text-gray-500 py-4">No hay datos de costos adicionales para los filtros seleccionados.</p> :
    <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>
        <th className="px-4 py-3 w-10 text-center"><Checkbox checked={selectedIds.size > 0 && selectedIds.size === data.length} onChange={onToggleAll} /></th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proyecto</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
    </tr></thead><tbody className="bg-white divide-y divide-gray-200">
        {data.map(c => (
        <tr key={c.transaccion_id} className={selectedIds.has(c.transaccion_id!) ? 'bg-blue-50' : ''} onClick={() => onToggle(c.transaccion_id!)}>
            <td className="px-4 py-4 text-center"><Checkbox checked={selectedIds.has(c.transaccion_id!)} onChange={() => onToggle(c.transaccion_id!)} /></td>
            <td className="px-4 py-4 text-sm text-gray-500">{c.fecha}</td>
            <td className="px-4 py-4 text-sm text-gray-900">{c.nombre_proyecto}</td>
            <td className="px-4 py-4 text-sm text-gray-500">
                {c.tipo_costo} 
                {c.otro_concepto ? <span className="block text-xs text-gray-400 italic">{c.otro_concepto}</span> : null}
            </td>
            <td className="px-4 py-4 text-sm text-gray-500">{c.descripcion}</td>
            <td className="px-4 py-4 text-sm text-gray-800 font-semibold text-right">{formatCurrency(c.monto)}</td>
            <ActionButtons item={c} entityType="Cost" onAction={onAction} />
        </tr>))}
    </tbody></table></div>
);

const DeletedItemsTable: React.FC<{data: DeletedItem[], selectedIds: Set<number>, onToggle: (id: number) => void, onToggleAll: () => void, formatCurrency: (v: number) => string, onAction: Function}> = ({ data, selectedIds, onToggle, onToggleAll, formatCurrency, onAction }) => (
     data.length === 0 ? <p className="text-center text-gray-500 py-4">No hay registros eliminados.</p> :
     <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>
        <th className="px-4 py-3 w-10 text-center"><Checkbox checked={selectedIds.size > 0 && selectedIds.size === data.length} onChange={onToggleAll} /></th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción Registro</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Eliminación</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eliminado Por</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
     </tr></thead><tbody className="bg-white divide-y divide-gray-200">
        {data.map((d, index) => {
            let id = d.transaccion_id;
            let description = '';

            const typeMap: Record<string, string> = {
                'Hour': 'Horas',
                'Material': 'Materiales',
                'Cost': 'Costos'
            };

            if (d.entity_type === 'Hour' && 'nombre_completo_empleado' in d) {
                description = `Horas de ${d.nombre_completo_empleado} en ${d.nombre_proyecto}`;
            } else if (d.entity_type === 'Material' && 'descripcion_material' in d) {
                description = `${d.cantidad}x ${d.descripcion_material} en ${d.nombre_proyecto}`;
            } else if (d.entity_type === 'Cost' && 'monto' in d) {
                description = `${d.tipo_costo} por ${formatCurrency(d.monto)} en ${d.nombre_proyecto}`;
            }

            return (<tr key={`${d.entity_type}-${id || index}`} className={selectedIds.has(id!) ? 'bg-green-50' : ''} onClick={() => id && onToggle(id)}>
                <td className="px-4 py-4 text-center"><Checkbox checked={selectedIds.has(id!)} onChange={() => id && onToggle(id)} /></td>
                <td className="px-4 py-4 text-sm text-gray-500">{typeMap[d.entity_type] || d.entity_type}</td>
                <td className="px-4 py-4 text-sm text-gray-900">{description}</td>
                <td className="px-4 py-4 text-sm text-gray-500">{new Date(d.deleted_at).toLocaleString()}</td>
                <td className="px-4 py-4 text-sm text-gray-500">{d.deleted_by}</td>
                <td className="px-4 py-4 text-sm font-medium text-right">
                    <button onClick={(e) => { e.stopPropagation(); onAction('restore', d, d.entity_type); }} className="text-green-600 hover:text-green-800 inline-flex items-center" title="Restaurar">
                        <RestoreIcon size={5} className="mr-1"/> Restaurar
                    </button>
                </td>
            </tr>)
        })}
     </tbody></table></div>
);

export default History;
