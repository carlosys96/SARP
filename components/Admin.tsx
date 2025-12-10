
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
    type: 'add' | 'edit' | 'delete' | null;
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

// ... (ConfigView component updated)
const ConfigView: React.FC<{ users: Usuario[] }> = ({ users }) => {
    const { fontFamily, setFontFamily, baseFontSize, setBaseFontSize } = useTheme();
    const { addToast } = useToast();
    const { user } = useAuth();
    
    const fonts: FontFamily[] = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'];
    const [operatingFactor, setOperatingFactor] = useState<string>('');
    const [operatingFactorHistory, setOperatingFactorHistory] = useState<FactorOperativo[]>([]);
    const [isLoadingOpFactors, setIsLoadingOpFactors] = useState(false);
    const [isSavingOpFactor, setIsSavingOpFactor] = useState(false);
    const [manufacturingFactor, setManufacturingFactor] = useState<string>('');
    const [manufacturingFactorHistory, setManufacturingFactorHistory] = useState<FactorOperativo[]>([]);
    const [isLoadingManFactors, setIsLoadingManFactors] = useState(false);
    const [isSavingManFactor, setIsSavingManFactor] = useState(false);

    useEffect(() => { loadFactors(); }, []);

    const loadFactors = async () => {
        setIsLoadingOpFactors(true); setIsLoadingManFactors(true);
        try {
            const safeGetFactor = async (key: string) => { try { return await apiService.getFactorHistory(key); } catch (e) { return []; } };
            const [opHistory, manHistory] = await Promise.all([safeGetFactor('FACTOR_GASTOS_OP'), safeGetFactor('FACTOR_GASTOS_FAB')]);
            setOperatingFactorHistory(opHistory); if (opHistory.length > 0) setOperatingFactor((opHistory[0].valor * 100).toFixed(6));
            setManufacturingFactorHistory(manHistory); if (manHistory.length > 0) setManufacturingFactor((manHistory[0].valor * 100).toFixed(6));
        } catch (error) { console.error("Error loading factors:", error); } finally { setIsLoadingOpFactors(false); setIsLoadingManFactors(false); }
    };

    const handleSaveFactor = async (key: string, valueStr: string, setIsSaving: (v: boolean) => void) => {
        const val = parseFloat(valueStr);
        if (isNaN(val) || val < 0 || val > 100) { addToast('Por favor ingrese un porcentaje válido (0-100).', 'error'); return; }
        
        if (!user) { addToast('No se puede identificar al usuario activo. Por favor inicie sesión nuevamente.', 'error'); return; }
        
        setIsSaving(true);
        try { 
            await apiService.saveFactor(key, val / 100, user.nombre); 
            addToast('Factor actualizado correctamente.', 'success'); 
            loadFactors(); 
        } catch (error) { 
            addToast(`Error al guardar: ${error}`, 'error'); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const renderHistoryTable = (history: FactorOperativo[], loading: boolean) => {
        if (loading) return <p className="text-sm text-gray-500">Cargando historial...</p>;
        return (<div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden max-h-40 overflow-y-auto">{history.length > 0 ? (<table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-100 sticky top-0"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th><th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{history.map((f, idx) => (<tr key={idx} className={idx === 0 ? "bg-blue-50" : ""}><td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">{new Date(f.fecha_registro).toLocaleString()}</td><td className="px-4 py-2 text-xs text-gray-600 font-medium">{f.usuario || 'Sistema'}</td><td className="px-4 py-2 text-sm text-gray-900 font-mono text-right font-bold">{(f.valor * 100).toFixed(6)}%</td></tr>))}</tbody></table>) : (<div className="p-4 text-center text-sm text-gray-500">No hay historial registrado.</div>)}</div>);
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm"><h3 className="text-lg font-bold text-sarp-dark-blue mb-4 border-b pb-2">Apariencia</h3><div className="mb-8"><label className="block text-sm font-medium text-gray-700 mb-3">Familia de Fuente</label><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{fonts.map(font => (<button key={font} onClick={() => setFontFamily(font)} className={`px-4 py-3 border rounded-lg text-sm font-medium transition-all ${fontFamily === font ? 'border-sarp-blue bg-blue-50 text-sarp-blue ring-2 ring-sarp-blue ring-opacity-50' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`} style={{ fontFamily: font }}>{font}</button>))}</div></div><div className="mb-8"><div className="flex justify-between items-center mb-3"><label className="block text-sm font-medium text-gray-700">Tamaño de Texto Base (Escala)</label><span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{baseFontSize}px</span></div><input type="range" min="12" max="20" step="1" value={baseFontSize} onChange={(e) => setBaseFontSize(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sarp-blue"/><div className="flex justify-between text-xs text-gray-500 mt-2"><span>Pequeño (12px)</span><span>Estándar (16px)</span><span>Grande (20px)</span></div></div></div>
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-8">
                <div>
                    <h3 className="text-lg font-bold text-sarp-dark-blue mb-4 border-b pb-2">Parámetros del Sistema</h3>
                    <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-100 flex items-center">
                        <UserIcon className="h-5 w-5 text-sarp-blue mr-2" />
                        <span className="text-sm text-sarp-dark-blue">
                            Modificando como: <strong>{user?.nombre || 'Usuario Desconocido'}</strong>
                        </span>
                    </div>
                </div>
                
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/50"><div className="flex justify-between items-center mb-2"><label className="block text-sm font-bold text-gray-800">Factor de Gastos de Operación (%)</label></div><div className="flex space-x-2 mb-4"><div className="relative rounded-md shadow-sm w-40"><input type="number" value={operatingFactor} onChange={(e) => setOperatingFactor(e.target.value)} className="block w-full pr-8 pl-3 py-2 border border-gray-300 rounded-md focus:ring-sarp-blue focus:border-sarp-blue sm:text-sm bg-white text-gray-900 font-bold" placeholder="0.000000" step="0.000001" min="0" max="100"/><div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><span className="text-gray-500 font-bold sm:text-sm">%</span></div></div><button onClick={() => handleSaveFactor('FACTOR_GASTOS_OP', operatingFactor, setIsSavingOpFactor)} disabled={isSavingOpFactor || isLoadingOpFactors} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sarp-blue hover:bg-opacity-90 focus:outline-none disabled:bg-gray-400 whitespace-nowrap">{isSavingOpFactor ? '...' : 'Actualizar'}</button></div><div><h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historial Operativo</h4>{renderHistoryTable(operatingFactorHistory, isLoadingOpFactors)}</div></div><div className="p-4 border border-gray-200 rounded-lg bg-gray-50/50"><div className="flex justify-between items-center mb-2"><label className="block text-sm font-bold text-gray-800">Factor de Gastos de Fabricación (%)</label></div><div className="flex space-x-2 mb-4"><div className="relative rounded-md shadow-sm w-40"><input type="number" value={manufacturingFactor} onChange={(e) => setManufacturingFactor(e.target.value)} className="block w-full pr-8 pl-3 py-2 border border-gray-300 rounded-md focus:ring-sarp-blue focus:border-sarp-blue sm:text-sm bg-white text-gray-900 font-bold" placeholder="0.000000" step="0.000001" min="0" max="100"/><div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><span className="text-gray-500 font-bold sm:text-sm">%</span></div></div><button onClick={() => handleSaveFactor('FACTOR_GASTOS_FAB', manufacturingFactor, setIsSavingManFactor)} disabled={isSavingManFactor || isLoadingManFactors} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sarp-blue hover:bg-opacity-90 focus:outline-none disabled:bg-gray-400 whitespace-nowrap">{isSavingManFactor ? '...' : 'Actualizar'}</button></div><div><h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historial Fabricación</h4>{renderHistoryTable(manufacturingFactorHistory, isLoadingManFactors)}</div></div></div></div>
    );
};

// ... (useTableLogic, SearchInput, SortableHeader - Assume existing implementation)
function useTableLogic<T>(data: T[], initialSortKey: keyof T) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: 'asc' | 'desc' }>({ key: initialSortKey, direction: 'asc' });
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
    return { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData };
}
const SearchInput: React.FC<{ value: string, onChange: (val: string) => void, placeholder?: string }> = ({ value, onChange, placeholder }) => (<div className="relative mb-4 max-w-md"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg></div><input type="text" className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-sarp-blue focus:ring-1 focus:ring-sarp-blue sm:text-sm" placeholder={placeholder || "Buscar..."} value={value} onChange={(e) => onChange(e.target.value)}/></div>);
const SortableHeader: React.FC<{ label: string, sortKey: string, currentSort: { key: any, direction: 'asc' | 'desc' }, onSort: (key: any) => void, align?: 'left' | 'right' }> = ({ label, sortKey, currentSort, onSort, align = 'left' }) => (<th className={`px-4 py-3 text-${align} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hover:text-gray-700 transition-colors select-none`} onClick={() => onSort(sortKey)}><div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'} space-x-1`}><span>{label}</span>{currentSort.key === sortKey && (<span className="text-sarp-blue font-bold">{currentSort.direction === 'asc' ? '▲' : '▼'}</span>)}{currentSort.key !== sortKey && <span className="text-gray-300">↕</span>}</div></th>);


const Admin: React.FC = () => {
    const { user, refreshSession } = useAuth();

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
        } catch (error) { console.error("Save error", error); } finally { handleCloseModal(); fetchData(); }
    };
    
    const handleDelete = async () => {
        const { entity, data } = modalState;
        if (!entity || !data) return;
        try {
            if (entity === 'projects') await apiService.deleteProject(data.proyecto_id);
            else if (entity === 'employees') await apiService.deleteEmployee(data.empleado_id);
            else if (entity === 'users') await apiService.deleteUser(data.usuario_id);
            else if (entity === 'teams') await apiService.deleteEquipo(data.equipo_id);
            else if (entity === 'clients') await apiService.deleteClient(data.cliente_id);
        } catch (error) { console.error("Error al eliminar:", error); } finally { handleCloseModal(); fetchData(); }
    };

    const renderContent = () => {
        if (activeTab === 'config') return <ConfigView users={users} />;
        if (isLoading) return <div className="text-center p-8">Cargando...</div>;

        switch (activeTab) {
            case 'projects': return <ProjectsTable projects={projects} clients={clients} onEdit={(p) => handleOpenModal('edit', 'projects', p)} onDelete={(p) => handleOpenDeleteDialog('projects', p)} canEdit={true} />;
            case 'employees': return <EmployeesTable employees={employees} onEdit={(e) => handleOpenModal('edit', 'employees', e)} onDelete={(e) => handleOpenDeleteDialog('employees', e)} canEdit={true} />;
            case 'users': return <UsersTable users={users} onEdit={(u) => handleOpenModal('edit', 'users', u)} onDelete={(u) => handleOpenDeleteDialog('users', u)} canEdit={true} />;
             case 'teams': return <TeamsManagementView teams={teams} employees={employees} onEdit={(t) => handleOpenModal('edit', 'teams', t)} onDelete={(t) => handleOpenDeleteDialog('teams', t)} canEdit={true} />;
             case 'clients': return <ClientsTable clients={clients} onEdit={(c) => handleOpenModal('edit', 'clients', c)} onDelete={(c) => handleOpenDeleteDialog('clients', c)} canEdit={true} />;
            default: return null;
        }
    };

    return (
        <div>
            {/* ... (Modals rendering logic same as before) ... */}
            {modalState.type && modalState.type !== 'delete' && (
                <>
                    {modalState.entity === 'projects' && <ProjectModal isOpen={true} onClose={handleCloseModal} onSave={handleSave} project={modalState.data} projects={projects} clients={clients} />}
                    {modalState.entity === 'employees' && <EmployeeModal isOpen={true} onClose={handleCloseModal} onSave={handleSave} employee={modalState.data} teams={teams} />}
                    {modalState.entity === 'users' && <UserModal isOpen={true} onClose={handleCloseModal} onSave={handleSave} user={modalState.data} />}
                    {modalState.entity === 'teams' && <TeamModal isOpen={true} onClose={handleCloseModal} onSave={handleSave} team={modalState.data} employees={employees} />}
                    {modalState.entity === 'clients' && <ClientModal isOpen={true} onClose={handleCloseModal} onSave={handleSave} client={modalState.data} />}
                </>
            )}
            {modalState.type === 'delete' && <ConfirmationDialog title="Confirmar Eliminación" message="¿Está seguro?" onConfirm={handleDelete} onCancel={handleCloseModal} />}

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

// ... (Updated Table Components - same as before)

const ActionButtons: React.FC<{ onEdit: () => void, onDelete: () => void }> = ({ onEdit, onDelete }) => (
    <td className="px-4 py-4 text-sm font-medium text-right space-x-3">
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-sarp-blue hover:text-sarp-blue/80" title="Editar"><EditIcon size={5} /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-sarp-red hover:text-sarp-red/80" title="Eliminar"><TrashIcon size={5} /></button>
    </td>
);

const ProjectsTable: React.FC<{ projects: Proyecto[], clients: Cliente[], onEdit: (p: Proyecto) => void, onDelete: (p: Proyecto) => void, canEdit: boolean }> = ({ projects, clients, onEdit, onDelete, canEdit }) => {
    const tableData = useMemo(() => projects.map(p => { const client = clients.find(c => c.cliente_id === p.cliente_id); return { ...p, nombre_cliente_display: client ? client.nombre_cliente : (p.cliente_id ? `ID: ${p.cliente_id}` : '-') }; }), [projects, clients]);
    const { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData } = useTableLogic(tableData, 'nombre_proyecto');
    const getRowColor = (estatus: string) => { /* ... color logic ... */ return ''; }; 
    const getStatusBadge = (estatus: string) => <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{estatus}</span>;

    return (
        <div>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar proyectos..." />
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableHeader label="Nombre" sortKey="nombre_proyecto" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Cliente" sortKey="nombre_cliente_display" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Clave SAE" sortKey="nueva_sae" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Estatus" sortKey="estatus" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Fecha OC" sortKey="fecha_pedido_oc" currentSort={sortConfig} onSort={requestSort} />
                            {canEdit && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedData.length > 0 ? sortedData.map(p => (
                            <tr key={p.proyecto_id} className={`transition-colors duration-150 ${getRowColor(p.estatus)}`}>
                                <td className="px-4 py-4 text-sm text-gray-900 font-medium">{p.nombre_proyecto}</td>
                                <td className="px-4 py-4 text-sm text-gray-700 font-medium">{p.nombre_cliente_display}</td>
                                <td className="px-4 py-4 text-sm text-gray-600 font-mono">{p.nueva_sae}</td>
                                <td className="px-4 py-4 text-sm">{getStatusBadge(p.estatus)}</td>
                                <td className="px-4 py-4 text-sm text-gray-600">{p.fecha_pedido_oc}</td>
                                {canEdit && <ActionButtons onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} />}
                            </tr>
                        )) : <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No se encontraron proyectos.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const EmployeesTable: React.FC<{ employees: Empleado[], onEdit: (e: Empleado) => void, onDelete: (e: Empleado) => void, canEdit: boolean }> = ({ employees, onEdit, onDelete, canEdit }) => {
    const { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData } = useTableLogic(employees, 'nombre_completo');
    const formatCurrency = (value: number | undefined | null) => value ? value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '$0.00';

    return (
        <div>
             <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar empleados..." />
             <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableHeader label="ID" sortKey="empleado_id" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Nombre Completo" sortKey="nombre_completo" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Puesto" sortKey="puesto" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Equipo" sortKey="equipo" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Costo/Hr" sortKey="costo_hora" currentSort={sortConfig} onSort={requestSort} align="right" />
                            {canEdit && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedData.length > 0 ? sortedData.map(e => (
                            <tr key={e.empleado_id} className="hover:bg-gray-50">
                                <td className="px-4 py-4 text-sm text-gray-500 font-mono">{e.empleado_id}</td>
                                <td className="px-4 py-4 text-sm text-gray-900 font-medium">{e.nombre_completo}</td>
                                <td className="px-4 py-4 text-sm text-gray-500">{e.puesto}</td>
                                <td className="px-4 py-4 text-sm text-gray-500">{e.equipo}</td>
                                <td className="px-4 py-4 text-sm text-gray-500 text-right">{formatCurrency(e.costo_hora)}</td>
                                {canEdit && <ActionButtons onEdit={() => onEdit(e)} onDelete={() => onDelete(e)} />}
                            </tr>
                        )) : <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No se encontraron empleados.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ... Similar updates for UsersTable, TeamsManagementView, ClientsTable to accept and use `canEdit`
const UsersTable: React.FC<{ users: Usuario[], onEdit: (u: Usuario) => void, onDelete: (u: Usuario) => void, canEdit: boolean }> = ({ users, onEdit, onDelete, canEdit }) => {
    const { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData } = useTableLogic(users, 'nombre');
    return (
        <div>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar usuarios..." />
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><SortableHeader label="Nombre" sortKey="nombre" currentSort={sortConfig} onSort={requestSort} /><SortableHeader label="Email" sortKey="email" currentSort={sortConfig} onSort={requestSort} />{canEdit && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>}</tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">{sortedData.length > 0 ? sortedData.map(u => (<tr key={u.usuario_id} className="hover:bg-gray-50"><td className="px-4 py-4 text-sm text-gray-900 font-medium">{u.nombre}</td><td className="px-4 py-4 text-sm text-gray-500">{u.email}</td>{canEdit && <ActionButtons onEdit={() => onEdit(u)} onDelete={() => onDelete(u)} />}</tr>)) : <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No se encontraron usuarios.</td></tr>}</tbody>
                </table>
            </div>
        </div>
    );
};

const TeamsManagementView: React.FC<{ teams: Equipo[], employees: Empleado[], onEdit: (t: Equipo) => void, onDelete: (t: Equipo) => void, canEdit: boolean }> = ({ teams, employees, onEdit, onDelete, canEdit }) => {
    const { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData } = useTableLogic<Equipo>(teams, 'nombre_equipo');
    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-4"><SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar equipos..." /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{sortedData.length > 0 ? sortedData.map(team => (<div key={team.equipo_id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 flex flex-col hover:shadow-md transition-shadow"><div className="flex-grow"><div className="flex justify-between items-start"><h3 className="text-xl font-bold text-sarp-dark-blue">{team.nombre_equipo}</h3>{canEdit && (<div className="flex items-center space-x-2"><button onClick={() => onEdit(team)} className="text-sarp-blue hover:text-sarp-blue/80"><EditIcon size={4} /></button><button onClick={() => onDelete(team)} className="text-sarp-red hover:text-sarp-red/80"><TrashIcon size={4} /></button></div>)}</div><div className="mt-2"><p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Encargado</p><p className="text-sm text-gray-800 font-medium">{team.nombre_encargado}</p></div></div></div>)) : <div className="col-span-full text-center">No hay equipos.</div>}</div>
        </div>
    );
};

const ClientsTable: React.FC<{ clients: Cliente[], onEdit: (c: Cliente) => void, onDelete: (c: Cliente) => void, canEdit: boolean }> = ({ clients, onEdit, onDelete, canEdit }) => {
    const { searchTerm, setSearchTerm, sortConfig, requestSort, sortedData } = useTableLogic(clients, 'nombre_cliente');
    return (
        <div>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar clientes..." />
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><SortableHeader label="Nombre Cliente" sortKey="nombre_cliente" currentSort={sortConfig} onSort={requestSort} /><SortableHeader label="Contacto" sortKey="contacto" currentSort={sortConfig} onSort={requestSort} />{canEdit && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>}</tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">{sortedData.length > 0 ? sortedData.map(c => (<tr key={c.cliente_id} className="hover:bg-gray-50"><td className="px-4 py-4 text-sm text-gray-900 font-medium">{c.nombre_cliente}</td><td className="px-4 py-4 text-sm text-gray-500">{c.contacto || '-'}</td>{canEdit && <ActionButtons onEdit={() => onEdit(c)} onDelete={() => onDelete(c)} />}</tr>)) : <tr><td colSpan={3} className="px-4 py-8 text-center">No se encontraron clientes.</td></tr>}</tbody>
                </table>
            </div>
        </div>
    );
};

export default Admin;
