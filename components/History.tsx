
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import type { Proyecto, HourTransaction, MaterialTransaction, AdditionalCost, DeletedItem, LogEntry } from '../types';
import { EditIcon, TrashIcon, LogbookIcon, CalendarIcon, RestoreIcon } from './icons/Icons';
import { ConfirmationDialog, LogModal, EditHourModal, EditMaterialModal, EditCostModal } from './history/Modals';
import { useAuth } from '../contexts/AuthContext';

type HistoryTab = 'hours' | 'materials' | 'costs' | 'deleted';

const datePickerInputClasses = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sarp-blue focus:border-sarp-blue block w-full pl-10 p-2.5";


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
    const [activeTab, setActiveTab] = useState<HistoryTab>('hours');
    const [projects, setProjects] = useState<Proyecto[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Data states
    const [hourData, setHourData] = useState<HourTransaction[]>([]);
    const [materialData, setMaterialData] = useState<MaterialTransaction[]>([]);
    const [costData, setCostData] = useState<AdditionalCost[]>([]);
    const [deletedData, setDeletedData] = useState<DeletedItem[]>([]);
    const [logData, setLogData] = useState<LogEntry[]>([]);
    
    // Modal & selection states
    const [modalState, setModalState] = useState<{ type: 'edit' | 'delete' | 'logs' | 'restore' | null, data: any, entityType?: 'Hour' | 'Material' | 'Cost' }>({ type: null, data: null });

    // Filter states
    const [filters, setFilters] = useState({
        proyecto_id: undefined as number | undefined,
        startDate: '',
        endDate: '',
    });

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            // apiService will handle initialization internally
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
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

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

    const handleConfirmDelete = async () => {
        if (!modalState.data || !modalState.entityType) return;
        const id = modalState.data.transaccion_id || modalState.data.costo_id; // costo_id legacy, might need cleanup
        const userName = user?.nombre || 'Desconocido';

        switch (modalState.entityType) {
            case 'Hour': await apiService.deleteHourTransaction(id, userName); break;
            case 'Material': await apiService.deleteMaterialTransaction(id, userName); break;
            case 'Cost': await apiService.deleteAdditionalCost(id, userName); break;
        }
        setModalState({ type: null, data: null });
        fetchAllData();
    };
    
    const handleConfirmRestore = async () => {
        if (!modalState.data || !modalState.entityType) return;
        const id = modalState.data.transaccion_id || modalState.data.costo_id;
        const userName = user?.nombre || 'Desconocido';

        switch (modalState.entityType) {
            case 'Hour': await apiService.restoreHourTransaction(id, userName); break;
            case 'Material': await apiService.restoreMaterialTransaction(id, userName); break;
            case 'Cost': await apiService.restoreAdditionalCost(id, userName); break;
        }
        setModalState({ type: null, data: null });
        fetchAllData();
    }
    
    const handleSaveEdit = async (editedData: any) => {
        if (!modalState.entityType) return;
        const userName = user?.nombre || 'Desconocido';
        switch (modalState.entityType) {
             case 'Hour': await apiService.updateHourTransaction(editedData, userName); break;
             case 'Material': await apiService.updateMaterialTransaction(editedData, userName); break;
             case 'Cost': await apiService.updateAdditionalCost(editedData, userName); break;
        }
        setModalState({ type: null, data: null });
        fetchAllData();
    }
    
    useEffect(() => {
        if(modalState.type === 'logs' && modalState.entityType && modalState.data) {
            const id = modalState.data.transaccion_id;
            if (id) {
                apiService.getLogsForEntity(id, modalState.entityType).then(setLogData);
            }
        }
    }, [modalState]);


    const formatCurrency = (value: number) => value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    const renderContent = () => {
        if (isLoading && !modalState.type) {
            return <div className="text-center p-8">Cargando datos desde Google Sheets...</div>;
        }

        switch (activeTab) {
            case 'hours': return <HoursTable data={hourData} onAction={handleAction} formatCurrency={formatCurrency} />;
            case 'materials': return <MaterialsTable data={materialData} onAction={handleAction} formatCurrency={formatCurrency} />;
            case 'costs': return <CostsTable data={costData} onAction={handleAction} formatCurrency={formatCurrency} />;
            case 'deleted': return <DeletedItemsTable data={deletedData} onAction={handleAction} formatCurrency={formatCurrency} />;
            default: return null;
        }
    };

    return (
        <div>
            {modalState.type === 'delete' && (
                <ConfirmationDialog
                    title="Confirmar Eliminación"
                    message="¿Está seguro de que desea mover este registro a la papelera? Podrá restaurarlo más tarde desde la pestaña 'Eliminados'."
                    onConfirm={handleConfirmDelete}
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
                <div className="grid grid-cols-1 md:grid-cols-3 md:items-end gap-4">
                    <div className="flex-1">
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
                    <div className="md:col-span-3 text-right">
                        <button onClick={fetchAllData} disabled={isLoading} className="w-full md:w-auto py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sarp-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sarp-blue disabled:bg-gray-400">
                            {isLoading ? 'Buscando...' : 'Buscar'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 px-6" aria-label="Tabs">
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
        <button onClick={() => onAction('logs', item, entityType)} className="text-gray-400 hover:text-sarp-blue" title="Ver Historial"><LogbookIcon size={5}/></button>
        <button onClick={() => onAction('edit', item, entityType)} className="text-sarp-blue hover:text-sarp-blue/80" title="Editar"><EditIcon size={5}/></button>
        <button onClick={() => onAction('delete', item, entityType)} className="text-sarp-red hover:text-sarp-red/80" title="Eliminar"><TrashIcon size={5}/></button>
    </td>
);

const HoursTable: React.FC<{data: HourTransaction[], formatCurrency: (v: number) => string, onAction: Function}> = ({ data, formatCurrency, onAction }) => (
    data.length === 0 ? <p className="text-center text-gray-500 py-4">No hay datos de horas para los filtros seleccionados.</p> :
    <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proyecto</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleado</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Horas</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo/Hr</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Total</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
    </tr></thead><tbody className="bg-white divide-y divide-gray-200">
        {data.map(h => (<tr key={h.transaccion_id}>
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

const MaterialsTable: React.FC<{data: MaterialTransaction[], formatCurrency: (v: number) => string, onAction: Function}> = ({ data, formatCurrency, onAction }) => (
     data.length === 0 ? <p className="text-center text-gray-500 py-4">No hay datos de materiales para los filtros seleccionados.</p> :
    <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proyecto</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Parte</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Unit.</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Total</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
    </tr></thead><tbody className="bg-white divide-y divide-gray-200">
        {data.map(m => (<tr key={m.transaccion_id}>
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

const CostsTable: React.FC<{data: AdditionalCost[], formatCurrency: (v: number) => string, onAction: Function}> = ({ data, formatCurrency, onAction }) => (
    data.length === 0 ? <p className="text-center text-gray-500 py-4">No hay datos de costos adicionales para los filtros seleccionados.</p> :
    <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proyecto</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
    </tr></thead><tbody className="bg-white divide-y divide-gray-200">
        {data.map(c => (
        <tr key={c.transaccion_id}>
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

const DeletedItemsTable: React.FC<{data: DeletedItem[], formatCurrency: (v: number) => string, onAction: Function}> = ({ data, formatCurrency, onAction }) => (
     data.length === 0 ? <p className="text-center text-gray-500 py-4">No hay registros eliminados.</p> :
     <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción Registro</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Eliminación</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eliminado Por</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
     </tr></thead><tbody className="bg-white divide-y divide-gray-200">
        {data.map((d, index) => {
            let id: number | undefined;
            let description = '';

            const typeMap: Record<string, string> = {
                'Hour': 'Horas',
                'Material': 'Materiales',
                'Cost': 'Costos'
            };

            if (d.entity_type === 'Hour' && 'nombre_completo_empleado' in d) {
                id = d.transaccion_id;
                description = `Horas de ${d.nombre_completo_empleado} en ${d.nombre_proyecto}`;
            } else if (d.entity_type === 'Material' && 'descripcion_material' in d) {
                id = d.transaccion_id;
                description = `${d.cantidad}x ${d.descripcion_material} en ${d.nombre_proyecto}`;
            } else if (d.entity_type === 'Cost' && 'monto' in d) {
                id = d.transaccion_id;
                description = `${d.tipo_costo} por ${formatCurrency(d.monto)} en ${d.nombre_proyecto}`;
            }

            return (<tr key={`${d.entity_type}-${id || index}`}>
                <td className="px-4 py-4 text-sm text-gray-500">{typeMap[d.entity_type] || d.entity_type}</td>
                <td className="px-4 py-4 text-sm text-gray-900">{description}</td>
                <td className="px-4 py-4 text-sm text-gray-500">{new Date(d.deleted_at).toLocaleString()}</td>
                <td className="px-4 py-4 text-sm text-gray-500">{d.deleted_by}</td>
                <td className="px-4 py-4 text-sm font-medium text-right">
                    <button onClick={() => onAction('restore', d, d.entity_type)} className="text-green-600 hover:text-green-800 inline-flex items-center" title="Restaurar">
                        <RestoreIcon size={5} className="mr-1"/> Restaurar
                    </button>
                </td>
            </tr>)
        })}
     </tbody></table></div>
);

export default History;
