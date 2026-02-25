
// ... (Imports stay the same)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../services/api';
import type { Usuario, Empleado, Proyecto, Equipo, FactorOperativo, Cliente } from '../types';
import { PlusIcon, EditIcon, TrashIcon, UserIcon } from './icons/Icons';
import { UserModal, EmployeeModal, ProjectModal, TeamModal, ClientModal } from './admin/Modals';
import { ConfirmationDialog } from './history/Modals';
import { useTheme, FontFamily } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

// ... (Types and TabButton stay the same)
type AdminTab = 'projects' | 'employees' | 'users' | 'teams' | 'clients' | 'config';
type ModalState = {
    type: 'add' | 'edit' | 'delete' | 'delete-bulk' | null;
    entity: AdminTab | null;
    data?: any;
};

const TabButton: React.FC<{ name: string, isActive: boolean, onClick: () => void }> = ({ name, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`${isActive ? 'border-sarp-blue text-sarp-blue' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
    >
        {name}
    </button>
);

// ... (ConfigView component remains unchanged)
const ConfigView: React.FC<{ users: Usuario[] }> = () => {
    const { fontFamily, setFontFamily, baseFontSize, setBaseFontSize } = useTheme();
    const { addToast } = useToast();
    const { user } = useAuth();
    
    const fonts: FontFamily[] = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'];
    
    // State for new factors
    const [newOpFactor, setNewOpFactor] = useState({ value: '', year: '' });
    const [newManFactor, setNewManFactor] = useState({ value: '', year: '' });

    // State for history
    const [operatingFactorHistory, setOperatingFactorHistory] = useState<FactorOperativo[]>([]);
    const [manufacturingFactorHistory, setManufacturingFactorHistory] = useState<FactorOperativo[]>([]);
    
    const [isLoading, setIsLoading] = useState({ op: false, man: false });
    const [isSaving, setIsSaving] = useState({ op: false, man: false });

    const loadFactors = useCallback(async () => {
        setIsLoading({ op: true, man: true });
        try {
            const [opHistory, manHistory] = await Promise.all([
                apiService.getFactorHistory('FACTOR_GASTOS_OP'),
                apiService.getFactorHistory('FACTOR_GASTOS_FAB')
            ]);
            setOperatingFactorHistory(opHistory);
            setManufacturingFactorHistory(manHistory);
        } catch (error) {
            addToast("Error al cargar el historial de factores.", 'error');
            console.error("Error loading factors:", error);
        } finally {
            setIsLoading({ op: false, man: false });
        }
    }, [addToast]);
    
    useEffect(() => { loadFactors(); }, [loadFactors]);

    const handleSaveFactor = async (key: 'op' | 'man') => {
        const factorState = key === 'op' ? newOpFactor : newManFactor;
        const value = parseFloat(factorState.value);
        const year = factorState.year ? parseInt(factorState.year) : undefined;
        
        if (isNaN(value) || value < 0) {
            addToast('Por favor ingrese un valor de factor válido y positivo.', 'error');
            return;
        }
        if (factorState.year && (isNaN(year!) || year! < 2020 || year! > 2100)) {
            addToast('Por favor ingrese un año válido (ej. 2024).', 'error');
            return;
        }
        if (!user) {
            addToast('No se puede identificar al usuario. Intente recargar.', 'error');
            return;
        }

        setIsSaving(prev => ({ ...prev, [key]: true }));
        try {
            await apiService.saveFactor(key === 'op' ? 'FACTOR_GASTOS_OP' : 'FACTOR_GASTOS_FAB', value / 100, user.nombre, year);
            addToast(`Factor para ${year || 'General'} guardado.`, 'success');
            if (key === 'op') setNewOpFactor({ value: '', year: '' });
            else setNewManFactor({ value: '', year: '' });
            await loadFactors();
        } catch (error) {
            addToast(`Error al guardar: ${error instanceof Error ? error.message : String(error)}`, 'error');
        } finally {
            setIsSaving(prev => ({ ...prev, [key]: false }));
        }
    };
    
    const renderFactorSection = (
        title: string, 
        factorKey: 'op' | 'man',
        state: { value: string, year: string }, 
        setState: React.Dispatch<React.SetStateAction<{ value: string, year: string }>>,
        history: FactorOperativo[],
    ) => (
        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/50">
            <label className="block text-sm font-bold text-gray-800 mb-2">{title}</label>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="relative rounded-md shadow-sm flex-grow">
                    <input type="number" value={state.value} onChange={(e) => setState(s => ({ ...s, value: e.target.value }))} className="block w-full pr-8 pl-3 py-2 border border-gray-300 rounded-md focus:ring-sarp-blue focus:border-sarp-blue sm:text-sm bg-white text-gray-900 font-bold" placeholder="Nuevo %" step="0.0001" min="0"/>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><span className="text-gray-500 font-bold sm:text-sm">%</span></div>
                </div>
                 <div className="relative rounded-md shadow-sm w-full sm:w-32">
                    <input type="number" value={state.year} onChange={(e) => setState(s => ({ ...s, year: e.target.value }))} className="block w-full pl-3 py-2 border border-gray-300 rounded-md focus:ring-sarp-blue focus:border-sarp-blue sm:text-sm bg-white text-gray-900 font-bold" placeholder="Año (Opcional)" min="2020"/>
                </div>
                <button onClick={() => handleSaveFactor(factorKey)} disabled={isSaving[factorKey] || isLoading[factorKey]} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sarp-blue hover:bg-opacity-90 focus:outline-none disabled:bg-gray-400 whitespace-nowrap">
                    {isSaving[factorKey] ? 'Guardando...' : 'Guardar Factor'}
                </button>
            </div>
            <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historial</h4>
                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden max-h-40 overflow-y-auto">
                    {isLoading[factorKey] ? <p className="text-xs p-4 text-center">Cargando...</p> : history.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100 sticky top-0"><tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Año Aplic.</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha Reg.</th>
                            </tr></thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {history.map((f, idx) => (
                                    <tr key={idx} className={idx === 0 ? "bg-blue-50" : ""}>
                                        <td className="px-4 py-2 text-sm text-gray-900 font-bold">{f.ejercicio || <span className="text-gray-400 italic">General</span>}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900 font-mono font-bold">{(f.valor * 100).toFixed(4)}%</td>
                                        <td className="px-4 py-2 text-xs text-gray-600 font-medium">{f.usuario || 'Sistema'}</td>
                                        <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">{new Date(f.fecha_registro).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="text-xs p-4 text-center text-gray-500">No hay historial.</p>}
                </div>
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm"><h3 className="text-lg font-bold text-sarp-dark-blue mb-4 border-b pb-2">Apariencia</h3><div className="mb-8"><label className="block text-sm font-medium text-gray-700 mb-3">Familia de Fuente</label><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{fonts.map(font => (<button key={font} onClick={() => setFontFamily(font)} className={`px-4 py-3 border rounded-lg text-sm font-medium transition-all ${fontFamily === font ? 'border-sarp-blue bg-blue-50 text-sarp-blue ring-2 ring-sarp-blue ring-opacity-50' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`} style={{ fontFamily: font }}>{font}</button>))}</div></div><div className="mb-8"><div className="flex justify-between items-center mb-3"><label className="block text-sm font-medium text-gray-700">Tamaño de Texto Base (Escala)</label><span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{baseFontSize}px</span></div><input type="range" min="12" max="20" step="1" value={baseFontSize} onChange={(e) => setBaseFontSize(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sarp-blue"/><div className="flex justify-between text-xs text-gray-500 mt-2"><span>Pequeño (12px)</span><span>Estándar (16px)</span><span>Grande (20px)</span></div></div></div>
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-8">
                <div>
                    <h3 className="text-lg font-bold text-sarp-dark-blue mb-4 border-b pb-2">Parámetros del Sistema</h3>
                     <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-100 flex items-center">
                        <UserIcon className="h-5 w-5 text-sarp-blue mr-2" />
                        <span className="text-sm text-sarp-dark-blue">Modificando como: <strong>{user?.nombre || 'Desconocido'}</strong></span>
                    </div>
                </div>
                {renderFactorSection('Factor de Gastos de Operación', 'op', newOpFactor, setNewOpFactor, operatingFactorHistory)}
                {renderFactorSection('Factor de Gastos de Fabricación', 'man', newManFactor, setNewManFactor, manufacturingFactorHistory)}
            </div>
        </div>
    );
};

// ... (useTableLogic, SearchInput, SortableHeader, Checkbox, BulkActionBar components remain unchanged)
function useTableLogic<T>(data: T[], initialSortKey: keyof T, idKey: keyof T) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: 'asc' | 'desc' }>({ key: initialSortKey, direction: 'asc' });
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

    // Sync selectedIds with data: Remove IDs that are no longer in the data array
    useEffect(() => {
        const currentIds = new Set(data.map(item => item[idKey] as unknown as string | number));
        setSelectedIds(prev => {
            const next = new Set<string | number>();
            prev.forEach(id => {
                if (currentIds.has(id)) {
                    next.add(id);
                }
            });
            // Only update state if sizes differ to avoid loops (though Set iteration order might trigger update if not careful, size check is usually safe enough for this purpose)
            if (next.size !== prev.size) return next;
            return prev;
        });
    }, [data, idKey]);

    // Reset selection when search changes to avoid confusion
    useEffect(() => {
        setSelectedIds(new Set());
    }, [searchTerm]);

    const sortedData = useMemo(() => {
        let sortableItems = [...data];
        if (searchTerm) {
            sortableItems = sortableItems.filter(item => Object.values(item as any).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase())));
        }
        return sortableItems.sort((a, b) => {
            const aValue = a[sortConfig.key] ?? '';
            const bValue = b[sortConfig.key] ?? '';
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, searchTerm, sortConfig]);

    const requestSort = (key: keyof T) => { setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' }); };

    const toggleSelection = (id: string | number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === sortedData.length && sortedData.length > 0) {
            setSelectedIds(new Set());
        } else {
            // @ts-ignore
            setSelectedIds(new Set(sortedData.map(item => item[idKey])));
        }
    };

    return { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData, selectedIds, toggleSelection, toggleAll };
}

const SearchInput: React.FC<{ value: string, onChange: (val: string) => void, placeholder?: string }> = ({ value, onChange, placeholder }) => (<div className="relative mb-4 max-w-md"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg></div><input type="text" className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-sarp-blue focus:ring-1 focus:ring-sarp-blue sm:text-sm" placeholder={placeholder || "Buscar..."} value={value} onChange={(e) => onChange(e.target.value)}/></div>);
const SortableHeader: React.FC<{ label: string, sortKey: string, currentSort: { key: any, direction: 'asc' | 'desc' }, onSort: (key: any) => void, align?: 'left' | 'right' }> = ({ label, sortKey, currentSort, onSort, align = 'left' }) => (<th className={`px-4 py-3 text-${align} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hover:text-gray-700 transition-colors select-none`} onClick={() => onSort(sortKey)}><div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'} space-x-1`}><span>{label}</span>{currentSort.key === sortKey && (<span className="text-sarp-blue font-bold">{currentSort.direction === 'asc' ? '▲' : '▼'}</span>)}{currentSort.key !== sortKey && <span className="text-gray-300">↕</span>}</div></th>);

// Reusable Checkbox
const Checkbox: React.FC<{ checked: boolean, onChange: () => void }> = ({ checked, onChange }) => (
    <div onClick={(e) => { e.stopPropagation(); onChange(); }} className="flex items-center justify-center cursor-pointer p-1">
        <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${checked ? 'bg-sarp-blue border-sarp-blue' : 'bg-white border-gray-300 hover:border-gray-400'}`}>
            {checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
        </div>
    </div>
);

// Bulk Action Bar
const BulkActionBar: React.FC<{ count: number, onDelete: () => void }> = ({ count, onDelete }) => (
    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3 px-4 animate-fade-in">
        <span className="text-sm font-semibold text-sarp-blue">{count} elementos seleccionados</span>
        <button onClick={onDelete} className="flex items-center px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-md text-sm font-bold hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm">
            <TrashIcon size={4} className="mr-2" /> Eliminar Selección
        </button>
    </div>
);

const Admin: React.FC = () => {
    const { user, refreshSession } = useAuth();
    const { addToast } = useToast();

    const [activeTab, setActiveTab] = useState<AdminTab>('projects');
    const [isLoading, setIsLoading] = useState(false);
    // ... Data States ...
    const [projects, setProjects] = useState<Proyecto[]>([]);
    const [employees, setEmployees] = useState<Empleado[]>([]);
    const [users, setUsers] = useState<Usuario[]>([]);
    const [teams, setTeams] = useState<Equipo[]>([]);
    const [clients, setClients] = useState<Cliente[]>([]);
    const [modalState, setModalState] = useState<ModalState>({ type: null, entity: null });

    const availableTabs: { id: AdminTab, name: string }[] = [
        { id: 'projects', name: 'Proyectos' },
        { id: 'clients', name: 'Clientes' },
        { id: 'teams', name: 'Equipos' },
        { id: 'employees', name: 'Empleados' },
        { id: 'users', name: 'Usuarios' },
        { id: 'config', name: 'Configuración' }
    ];

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [projData, empData, userData, teamData, clientData] = await Promise.all([
                apiService.getProjects(), apiService.getEmployees(), apiService.getUsers(), apiService.getEquipos(), apiService.getClients()
            ]);
            setProjects(projData); setEmployees(empData); setUsers(userData); setTeams(teamData); setClients(clientData);
        } catch (error) { console.error("Critical error in Admin fetch", error); } finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleOpenModal = (type: 'add' | 'edit', entity: AdminTab, data?: any) => { setModalState({ type, entity, data }); };
    const handleOpenDeleteDialog = (entity: AdminTab, data: any) => { setModalState({ type: 'delete', entity, data }); };
    const handleOpenBulkDeleteDialog = (entity: AdminTab, ids: any[]) => { setModalState({ type: 'delete-bulk', entity, data: ids }); };
    const handleCloseModal = () => { setModalState({ type: null, entity: null }); };

    const handleSave = async (data: any) => {
        const { entity, type } = modalState;
        if (!entity || !type) return;
        try {
            if (entity === 'projects') type === 'add' ? await apiService.addProject(data) : await apiService.updateProject(data);
            else if (entity === 'employees') type === 'add' ? await apiService.addEmployee(data) : await apiService.updateEmployee(data);
            else if (entity === 'users') { type === 'add' ? await apiService.addUser(data) : await apiService.updateUser(data); if (data.usuario_id && user && data.usuario_id === user.usuario_id) await refreshSession(); }
            else if (entity === 'teams') type === 'add' ? await apiService.addEquipo(data) : await apiService.updateEquipo(data);
            else if (entity === 'clients') type === 'add' ? await apiService.addClient(data) : await apiService.updateClient(data);
            addToast('Registro guardado exitosamente.', 'success');
        } catch (error) { 
            console.error("Save error", error); 
            addToast("Error al guardar el registro.", 'error');
        } finally { handleCloseModal(); fetchData(); }
    };
    
    const handleDelete = async () => {
        const { entity, data, type } = modalState;
        if (!entity || !data) return;
        
        // Handle Single Delete
        if (type === 'delete') {
            try {
                if (entity === 'projects') await apiService.deleteProject(data.proyecto_id);
                else if (entity === 'employees') await apiService.deleteEmployee(data.empleado_id);
                else if (entity === 'users') await apiService.deleteUser(data.usuario_id);
                else if (entity === 'teams') await apiService.deleteEquipo(data.equipo_id);
                else if (entity === 'clients') await apiService.deleteClient(data.cliente_id);
                addToast('Registro eliminado.', 'success');
            } catch (error) { 
                console.error("Error al eliminar:", error); 
                addToast("Error al eliminar el registro.", 'error');
            }
        } 
        // Handle Bulk Delete
        else if (type === 'delete-bulk') {
            const ids = data as any[]; // Array of IDs
            try {
                setIsLoading(true);
                let successCount = 0;
                let failCount = 0;

                // Process individually to tolerate partial failures
                const promises = ids.map(async (id) => {
                    try {
                        if (entity === 'projects') await apiService.deleteProject(id);
                        else if (entity === 'employees') await apiService.deleteEmployee(id);
                        else if (entity === 'users') await apiService.deleteUser(id);
                        else if (entity === 'teams') await apiService.deleteEquipo(id);
                        else if (entity === 'clients') await apiService.deleteClient(id);
                        successCount++;
                    } catch (e) {
                        console.warn(`Failed to delete ${entity} id ${id}`, e);
                        failCount++;
                    }
                });
                
                await Promise.all(promises);
                
                if (successCount > 0) addToast(`${successCount} registros eliminados.`, 'success');
                if (failCount > 0) addToast(`No se pudieron eliminar ${failCount} registros.`, 'error');

            } catch (error) {
                console.error("Error en eliminación masiva:", error);
                addToast("Hubo un error crítico al procesar la eliminación.", 'error');
            } finally {
                setIsLoading(false);
            }
        }

        handleCloseModal(); 
        fetchData();
    };

    const renderContent = () => {
        if (activeTab === 'config') return <ConfigView users={users} />;
        if (isLoading) return <div className="text-center p-8">Cargando...</div>;

        switch (activeTab) {
            case 'projects': return <ProjectsTable projects={projects} clients={clients} onEdit={(p) => handleOpenModal('edit', 'projects', p)} onDelete={(p) => handleOpenDeleteDialog('projects', p)} onBulkDelete={(ids) => handleOpenBulkDeleteDialog('projects', ids)} canEdit={true} />;
            case 'employees': return <EmployeesTable employees={employees} onEdit={(e) => handleOpenModal('edit', 'employees', e)} onDelete={(e) => handleOpenDeleteDialog('employees', e)} onBulkDelete={(ids) => handleOpenBulkDeleteDialog('employees', ids)} canEdit={true} />;
            case 'users': return <UsersTable users={users} onEdit={(u) => handleOpenModal('edit', 'users', u)} onDelete={(u) => handleOpenDeleteDialog('users', u)} onBulkDelete={(ids) => handleOpenBulkDeleteDialog('users', ids)} canEdit={true} />;
             case 'teams': return <TeamsManagementView teams={teams} employees={employees} onEdit={(t) => handleOpenModal('edit', 'teams', t)} onDelete={(t) => handleOpenDeleteDialog('teams', t)} onBulkDelete={(ids) => handleOpenBulkDeleteDialog('teams', ids)} canEdit={true} />;
             case 'clients': return <ClientsTable clients={clients} onEdit={(c) => handleOpenModal('edit', 'clients', c)} onDelete={(c) => handleOpenDeleteDialog('clients', c)} onBulkDelete={(ids) => handleOpenBulkDeleteDialog('clients', ids)} canEdit={true} />;
            default: return null;
        }
    };

    return (
        <div>
            {/* ... (Modals rendering logic same as before) ... */}
            {modalState.type && modalState.type !== 'delete' && modalState.type !== 'delete-bulk' && (
                <>
                    {modalState.entity === 'projects' && <ProjectModal isOpen={true} onClose={handleCloseModal} onSave={handleSave} project={modalState.data} projects={projects} clients={clients} />}
                    {modalState.entity === 'employees' && <EmployeeModal isOpen={true} onClose={handleCloseModal} onSave={handleSave} employee={modalState.data} teams={teams} />}
                    {modalState.entity === 'users' && <UserModal isOpen={true} onClose={handleCloseModal} onSave={handleSave} user={modalState.data} />}
                    {modalState.entity === 'teams' && <TeamModal isOpen={true} onClose={handleCloseModal} onSave={handleSave} team={modalState.data} employees={employees} />}
                    {modalState.entity === 'clients' && <ClientModal isOpen={true} onClose={handleCloseModal} onSave={handleSave} client={modalState.data} />}
                </>
            )}
            {modalState.type === 'delete' && <ConfirmationDialog title="Confirmar Eliminación" message="¿Está seguro de que desea eliminar este registro?" onConfirm={handleDelete} onCancel={handleCloseModal} />}
            {modalState.type === 'delete-bulk' && <ConfirmationDialog title="Confirmar Eliminación Masiva" message={`¿Está seguro de que desea eliminar los ${modalState.data?.length} registros seleccionados? Esta acción no se puede deshacer fácilmente.`} onConfirm={handleDelete} onCancel={handleCloseModal} />}

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-sarp-gray">Administración de Catálogos</h1>
                {activeTab !== 'config' && (
                    <button onClick={() => handleOpenModal('add', activeTab as any)} className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sarp-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sarp-blue">
                        <PlusIcon size={5} className="mr-2" /> {activeTab === 'teams' ? 'Nuevo Equipo' : 'Agregar Nuevo'}
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-lg">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 px-6 overflow-x-auto" aria-label="Tabs">
                        {availableTabs.map(tab => (<TabButton key={tab.id} name={tab.name} isActive={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />))}
                    </nav>
                </div>
                <div className="p-4 sm:p-6">{renderContent()}</div>
            </div>
        </div>
    );
};

// ... (Updated Table Components)

const ActionButtons: React.FC<{ onEdit: () => void, onDelete: () => void }> = ({ onEdit, onDelete }) => (
    <td className="px-4 py-4 text-sm font-medium text-right space-x-3">
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-sarp-blue hover:text-sarp-blue/80" title="Editar"><EditIcon size={5} /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-sarp-red hover:text-sarp-red/80" title="Eliminar"><TrashIcon size={5} /></button>
    </td>
);

const ProjectsTable: React.FC<{ projects: Proyecto[], clients: Cliente[], onEdit: (p: Proyecto) => void, onDelete: (p: Proyecto) => void, onBulkDelete: (ids: any[]) => void, canEdit: boolean }> = ({ projects, clients, onEdit, onDelete, onBulkDelete, canEdit }) => {
    const tableData = useMemo(() => projects.map(p => { const client = clients.find(c => c.cliente_id === p.cliente); return { ...p, nombre_cliente_display: client ? client.nombre_cliente : (p.cliente ? `ID: ${p.cliente}` : '-') }; }), [projects, clients]);
    const { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData, selectedIds, toggleSelection, toggleAll } = useTableLogic(tableData, 'nombre_proyecto', 'proyecto_id');
    const getRowColor = (estatus: string) => { /* ... color logic ... */ return ''; }; 
    const getStatusBadge = (estatus: string) => <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{estatus}</span>;

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar proyectos..." />
            </div>
            {selectedIds.size > 0 && <BulkActionBar count={selectedIds.size} onDelete={() => onBulkDelete(Array.from(selectedIds))} />}
            
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center">
                                <Checkbox checked={selectedIds.size > 0 && selectedIds.size === sortedData.length} onChange={toggleAll} />
                            </th>
                            <SortableHeader label="Nombre" sortKey="nombre_proyecto" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Cliente" sortKey="nombre_cliente_display" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Clave SAE" sortKey="nueva_sae" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Estación" sortKey="estacion" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Estatus" sortKey="estatus" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Fecha OC" sortKey="fecha_pedido_oc" currentSort={sortConfig} onSort={requestSort} />
                            {canEdit && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedData.length > 0 ? sortedData.map(p => (
                            <tr key={p.proyecto_id} className={`transition-colors duration-150 ${getRowColor(p.estatus)} ${selectedIds.has(p.proyecto_id!) ? 'bg-blue-50' : ''}`} onClick={() => toggleSelection(p.proyecto_id!)}>
                                <td className="px-4 py-4 text-center">
                                    <Checkbox checked={selectedIds.has(p.proyecto_id!)} onChange={() => toggleSelection(p.proyecto_id!)} />
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-900 font-medium">{p.nombre_proyecto}</td>
                                <td className="px-4 py-4 text-sm text-gray-700 font-medium">{p.nombre_cliente_display}</td>
                                <td className="px-4 py-4 text-sm text-gray-600 font-mono">{p.nueva_sae}</td>
                                <td className="px-4 py-4 text-sm text-gray-600">{p.estacion || '-'}</td>
                                <td className="px-4 py-4 text-sm">{getStatusBadge(p.estatus)}</td>
                                <td className="px-4 py-4 text-sm text-gray-600">{p.fecha_pedido_oc}</td>
                                {canEdit && <ActionButtons onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} />}
                            </tr>
                        )) : <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No se encontraron proyectos.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const EmployeesTable: React.FC<{ employees: Empleado[], onEdit: (e: Empleado) => void, onDelete: (e: Empleado) => void, onBulkDelete: (ids: any[]) => void, canEdit: boolean }> = ({ employees, onEdit, onDelete, onBulkDelete, canEdit }) => {
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    const filteredByStatus = useMemo(() => {
        if (statusFilter === 'all') return employees;
        return employees.filter(e => statusFilter === 'active' ? e.activo : !e.activo);
    }, [employees, statusFilter]);
    
    const { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData, selectedIds, toggleSelection, toggleAll } = useTableLogic(filteredByStatus, 'nombre_completo', 'empleado_id');
    const formatCurrency = (value: number | undefined | null) => value ? value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '$0.00';

    const FilterButton: React.FC<{ label: string, filter: 'all' | 'active' | 'inactive' }> = ({ label, filter }) => (
        <button
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${statusFilter === filter ? 'bg-sarp-blue text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
            {label}
        </button>
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar empleados..." />
                <div className="flex items-center space-x-2 bg-gray-50 p-1 rounded-full border">
                    <FilterButton label="Todos" filter="all" />
                    <FilterButton label="Activos" filter="active" />
                    <FilterButton label="Inactivos" filter="inactive" />
                </div>
            </div>

            {selectedIds.size > 0 && <BulkActionBar count={selectedIds.size} onDelete={() => onBulkDelete(Array.from(selectedIds))} />}
             <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center">
                                <Checkbox checked={selectedIds.size > 0 && selectedIds.size === sortedData.length} onChange={toggleAll} />
                            </th>
                            <SortableHeader label="ID" sortKey="empleado_id" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Nombre Completo" sortKey="nombre_completo" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Puesto" sortKey="puesto" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Equipo" sortKey="equipo" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Costo/Hr" sortKey="costo_hora" currentSort={sortConfig} onSort={requestSort} align="right" />
                            <SortableHeader label="Activo" sortKey="activo" currentSort={sortConfig} onSort={requestSort} />
                            {canEdit && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedData.length > 0 ? sortedData.map(e => (
                            <tr key={e.empleado_id} className={`hover:bg-gray-50 cursor-pointer ${selectedIds.has(e.empleado_id!) ? 'bg-blue-50' : ''}`} onClick={() => toggleSelection(e.empleado_id!)}>
                                <td className="px-4 py-4 text-center">
                                    <Checkbox checked={selectedIds.has(e.empleado_id!)} onChange={() => toggleSelection(e.empleado_id!)} />
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-500 font-mono">{e.empleado_id}</td>
                                <td className="px-4 py-4 text-sm text-gray-900 font-medium">{e.nombre_completo}</td>
                                <td className="px-4 py-4 text-sm text-gray-500">{e.puesto}</td>
                                <td className="px-4 py-4 text-sm text-gray-500">{e.equipo}</td>
                                <td className="px-4 py-4 text-sm text-gray-500 text-right">{formatCurrency(e.costo_hora)}</td>
                                <td className="px-4 py-4 text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${e.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {e.activo ? 'Sí' : 'No'}
                                    </span>
                                </td>
                                {canEdit && <ActionButtons onEdit={() => onEdit(e)} onDelete={() => onDelete(e)} />}
                            </tr>
                        )) : <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No se encontraron empleados.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const UsersTable: React.FC<{ users: Usuario[], onEdit: (u: Usuario) => void, onDelete: (u: Usuario) => void, onBulkDelete: (ids: any[]) => void, canEdit: boolean }> = ({ users, onEdit, onDelete, onBulkDelete, canEdit }) => {
    const { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData, selectedIds, toggleSelection, toggleAll } = useTableLogic(users, 'nombre', 'usuario_id');
    return (
        <div>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar usuarios..." />
            {selectedIds.size > 0 && <BulkActionBar count={selectedIds.size} onDelete={() => onBulkDelete(Array.from(selectedIds))} />}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><th className="px-4 py-3 w-10 text-center"><Checkbox checked={selectedIds.size > 0 && selectedIds.size === sortedData.length} onChange={toggleAll} /></th><SortableHeader label="Nombre" sortKey="nombre" currentSort={sortConfig} onSort={requestSort} /><SortableHeader label="Email" sortKey="email" currentSort={sortConfig} onSort={requestSort} />{canEdit && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>}</tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">{sortedData.length > 0 ? sortedData.map(u => (<tr key={u.usuario_id} className={`hover:bg-gray-50 cursor-pointer ${selectedIds.has(u.usuario_id!) ? 'bg-blue-50' : ''}`} onClick={() => toggleSelection(u.usuario_id!)}><td className="px-4 py-4 text-center"><Checkbox checked={selectedIds.has(u.usuario_id!)} onChange={() => toggleSelection(u.usuario_id!)} /></td><td className="px-4 py-4 text-sm text-gray-900 font-medium">{u.nombre}</td><td className="px-4 py-4 text-sm text-gray-500">{u.email}</td>{canEdit && <ActionButtons onEdit={() => onEdit(u)} onDelete={() => onDelete(u)} />}</tr>)) : <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No se encontraron usuarios.</td></tr>}</tbody>
                </table>
            </div>
        </div>
    );
};

const TeamsManagementView: React.FC<{ teams: Equipo[], employees: Empleado[], onEdit: (t: Equipo) => void, onDelete: (t: Equipo) => void, onBulkDelete: (ids: any[]) => void, canEdit: boolean }> = ({ teams, employees, onEdit, onDelete, onBulkDelete, canEdit }) => {
    const { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData, selectedIds, toggleSelection, toggleAll } = useTableLogic<Equipo>(teams, 'nombre_equipo', 'equipo_id');
    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-4"><SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar equipos..." /></div>
            {selectedIds.size > 0 && <BulkActionBar count={selectedIds.size} onDelete={() => onBulkDelete(Array.from(selectedIds))} />}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{sortedData.length > 0 ? sortedData.map(team => (
                <div key={team.equipo_id} className={`bg-white border rounded-lg shadow-sm p-5 flex flex-col hover:shadow-md transition-all relative ${selectedIds.has(team.equipo_id!) ? 'border-sarp-blue ring-1 ring-sarp-blue bg-blue-50' : 'border-gray-200'}`} onClick={() => toggleSelection(team.equipo_id!)}>
                    <div className="absolute top-4 right-4">
                        <Checkbox checked={selectedIds.has(team.equipo_id!)} onChange={() => toggleSelection(team.equipo_id!)} />
                    </div>
                    <div className="flex-grow pr-8">
                        <div className="flex justify-between items-start">
                            <h3 className="text-xl font-bold text-sarp-dark-blue">{team.nombre_equipo}</h3>
                        </div>
                        <div className="mt-2"><p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Encargado</p><p className="text-sm text-gray-800 font-medium">{team.nombre_encargado}</p></div>
                    </div>
                    {canEdit && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end space-x-2">
                            <button onClick={(e) => { e.stopPropagation(); onEdit(team); }} className="text-sarp-blue hover:text-sarp-blue/80 p-1"><EditIcon size={4} /></button>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(team); }} className="text-sarp-red hover:text-sarp-red/80 p-1"><TrashIcon size={4} /></button>
                        </div>
                    )}
                </div>
            )) : <div className="col-span-full text-center">No hay equipos.</div>}</div>
        </div>
    );
};

const ClientsTable: React.FC<{ clients: Cliente[], onEdit: (c: Cliente) => void, onDelete: (c: Cliente) => void, onBulkDelete: (ids: any[]) => void, canEdit: boolean }> = ({ clients, onEdit, onDelete, onBulkDelete, canEdit }) => {
    const { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData, selectedIds, toggleSelection, toggleAll } = useTableLogic(clients, 'nombre_cliente', 'cliente_id');
    return (
        <div>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar clientes..." />
            {selectedIds.size > 0 && <BulkActionBar count={selectedIds.size} onDelete={() => onBulkDelete(Array.from(selectedIds))} />}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><th className="px-4 py-3 w-10 text-center"><Checkbox checked={selectedIds.size > 0 && selectedIds.size === sortedData.length} onChange={toggleAll} /></th><SortableHeader label="Nombre Cliente" sortKey="nombre_cliente" currentSort={sortConfig} onSort={requestSort} /><SortableHeader label="Contacto" sortKey="contacto" currentSort={sortConfig} onSort={requestSort} />{canEdit && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>}</tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">{sortedData.length > 0 ? sortedData.map(c => (<tr key={c.cliente_id} className={`hover:bg-gray-50 cursor-pointer ${selectedIds.has(c.cliente_id!) ? 'bg-blue-50' : ''}`} onClick={() => toggleSelection(c.cliente_id!)}><td className="px-4 py-4 text-center"><Checkbox checked={selectedIds.has(c.cliente_id!)} onChange={() => toggleSelection(c.cliente_id!)} /></td><td className="px-4 py-4 text-sm text-gray-900 font-medium">{c.nombre_cliente}</td><td className="px-4 py-4 text-sm text-gray-500">{c.contacto || '-'}</td>{canEdit && <ActionButtons onEdit={() => onEdit(c)} onDelete={() => onDelete(c)} />}</tr>)) : <tr><td colSpan={4} className="px-4 py-8 text-center">No se encontraron clientes.</td></tr>}</tbody>
                </table>
            </div>
        </div>
    );
};

export default Admin;