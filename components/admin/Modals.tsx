
import React, { useState, useEffect } from 'react';
import type { Usuario, Empleado, Proyecto, Equipo, Cliente, UserPermissions } from '../../types';
import { CloseIcon, CalendarIcon, LockIcon } from '../icons/Icons';

const baseInputClasses = "mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-base text-gray-900 shadow-sm focus:outline-none focus:ring-sarp-blue focus:border-sarp-blue sm:text-sm";
const baseSelectClasses = `${baseInputClasses} pl-3 pr-10`;
const datePickerInputClasses = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sarp-blue focus:border-sarp-blue block w-full pl-10 p-2.5";

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; }> = ({ isOpen, onClose, title, children, footer }) => {
    if (!isOpen) return null;
    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Intentar encontrar y hacer click en el botón submit del footer para soportar la tecla Enter
        if (footer && React.isValidElement(footer)) {
            const footerChildren = React.Children.toArray((footer.props as any).children);
            const submitButton: any = footerChildren.find(
                (child: any) => React.isValidElement(child) && (child.props as any).type === 'submit'
            );
            if (submitButton && submitButton.props.onClick && !submitButton.props.disabled) {
                submitButton.props.onClick();
            }
        }
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-sarp-gray">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><CloseIcon /></button>
                </header>
                <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <main className="flex-1 p-6 overflow-y-auto">{children}</main>
                    {footer && <footer className="flex-shrink-0 flex justify-end items-center p-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">{footer}</footer>}
                </form>
            </div>
        </div>
    );
};

// --- Project Modal ---
export const ProjectModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (p: Proyecto) => void; project?: Proyecto; projects: Proyecto[]; clients: Cliente[] }> = ({ isOpen, onClose, onSave, project, clients }) => {
    const emptyProject: Omit<Proyecto, 'proyecto_id' | '_row'> = {
        nombre_proyecto: '',
        cliente: undefined,
        estacion: '',
        precio_fabricacion: 0,
        precio_instalacion: 0,
        precio_flete: 0,
        precio_servicios: 0,
        estatus: 'Abierto',
        fecha_pedido_oc: '',
        odc_po: '',
        nueva_sae: ''
    };

    const [formData, setFormData] = useState(project || emptyProject);
    
    useEffect(() => {
        setFormData(project || emptyProject);
    }, [project, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value;
        setFormData({ ...formData, [name]: val });
    };

    const handleSave = () => {
        onSave(formData as Proyecto);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={project ? "Editar Proyecto" : "Nuevo Proyecto"} footer={
            <>
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Cancelar</button>
                <button type="submit" onClick={handleSave} className="ml-3 px-4 py-2 rounded-md text-sm font-medium text-white bg-sarp-blue hover:bg-opacity-90">Guardar</button>
            </>
        }>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Nombre del Proyecto</label>
                    <input type="text" name="nombre_proyecto" value={formData.nombre_proyecto} onChange={handleChange} className={baseInputClasses} required />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700">Cliente</label>
                    <select name="cliente" value={formData.cliente || ''} onChange={(e) => setFormData({...formData, cliente: Number(e.target.value)})} className={baseSelectClasses} required>
                        <option value="">Seleccionar Cliente</option>
                        {clients.map(c => <option key={c.cliente_id} value={c.cliente_id}>{c.nombre_cliente}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Clave SAE (Materiales)</label>
                    <input type="text" name="nueva_sae" value={formData.nueva_sae} onChange={handleChange} className={baseInputClasses} placeholder="Ej. PR-123" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">ODC / PO</label>
                    <input type="text" name="odc_po" value={formData.odc_po} onChange={handleChange} className={baseInputClasses} />
                </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700">Estación</label>
                    <input type="text" name="estacion" value={formData.estacion} onChange={handleChange} className={baseInputClasses} />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Estatus</label>
                    <select name="estatus" value={formData.estatus} onChange={handleChange} className={baseSelectClasses}>
                        <option value="Abierto">Abierto</option>
                        <option value="Proceso">En Proceso</option>
                        <option value="Terminado">Terminado</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha Pedido / OC</label>
                     <div className="relative mt-1">
                        <div className="absolute inset-y-0 start-0 flex items-center pl-3.5 pointer-events-none"><CalendarIcon className="text-gray-500 h-4 w-4" /></div>
                        <input type="date" name="fecha_pedido_oc" value={formData.fecha_pedido_oc} onChange={handleChange} className={datePickerInputClasses} />
                    </div>
                </div>

                <div className="md:col-span-2 mt-4 border-t pt-4">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">Precios Pactados (Venta)</h4>
                </div>
                <div><label className="block text-sm font-medium text-gray-700">Precio Mobiliario</label><input type="number" name="precio_fabricacion" value={formData.precio_fabricacion} onChange={handleChange} className={baseInputClasses} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Precio Instalación</label><input type="number" name="precio_instalacion" value={formData.precio_instalacion} onChange={handleChange} className={baseInputClasses} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Precio Flete</label><input type="number" name="precio_flete" value={formData.precio_flete} onChange={handleChange} className={baseInputClasses} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Precio Servicios</label><input type="number" name="precio_servicios" value={formData.precio_servicios} onChange={handleChange} className={baseInputClasses} /></div>
            </div>
        </Modal>
    );
};

// --- Employee Modal ---
export const EmployeeModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (e: Empleado) => void; employee?: Empleado; teams: Equipo[] }> = ({ isOpen, onClose, onSave, employee, teams }) => {
     const emptyEmployee: Omit<Empleado, '_row'> = {
        empleado_id: '',
        nombre_completo: '',
        puesto: '',
        equipo_id: '',
        costo_hora: 0,
        costo_hora_extra: 0,
        activo: true
    };
    
    const [formData, setFormData] = useState(employee || emptyEmployee);
    useEffect(() => setFormData(employee || emptyEmployee), [employee, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        // @ts-ignore
        const val = type === 'number' ? (value === '' ? 0 : parseFloat(value)) : type === 'checkbox' ? e.target.checked : value;
        setFormData({ ...formData, [name]: val });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={employee ? "Editar Empleado" : "Nuevo Empleado"} footer={
            <>
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Cancelar</button>
                <button type="submit" onClick={() => onSave(formData as Empleado)} className="ml-3 px-4 py-2 rounded-md text-sm font-medium text-white bg-sarp-blue hover:bg-opacity-90">Guardar</button>
            </>
        }>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">ID Empleado (Nómina)</label>
                    <input type="text" name="empleado_id" value={formData.empleado_id} onChange={handleChange} className={baseInputClasses} required disabled={!!employee} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                    <input type="text" name="nombre_completo" value={formData.nombre_completo} onChange={handleChange} className={baseInputClasses} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Puesto</label>
                    <input type="text" name="puesto" value={formData.puesto} onChange={handleChange} className={baseInputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Equipo / Cuadrilla</label>
                    <select name="equipo_id" value={formData.equipo_id} onChange={handleChange} className={baseSelectClasses}>
                        <option value="">Sin Equipo</option>
                        {teams.map(t => <option key={t.equipo_id} value={t.equipo_id}>{t.nombre_equipo}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Costo Hora Normal</label>
                    <input type="number" name="costo_hora" value={formData.costo_hora} onChange={handleChange} className={baseInputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Costo Hora Extra</label>
                    <input type="number" name="costo_hora_extra" value={formData.costo_hora_extra} onChange={handleChange} className={baseInputClasses} />
                </div>
                <div className="md:col-span-2 flex items-center mt-2">
                    <input type="checkbox" name="activo" checked={formData.activo} onChange={handleChange} className="h-4 w-4 text-sarp-blue focus:ring-sarp-blue border-gray-300 rounded" />
                    <label className="ml-2 block text-sm text-gray-900">Empleado Activo</label>
                </div>
            </div>
        </Modal>
    );
};

// --- Team Modal ---
export const TeamModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (t: Equipo) => void; team?: Equipo; employees: Empleado[] }> = ({ isOpen, onClose, onSave, team, employees }) => {
    const emptyTeam: Omit<Equipo, 'equipo_id' | '_row'> = { nombre_equipo: '', encargado_empleado_id: '' };
    const [formData, setFormData] = useState(team || emptyTeam);
    useEffect(() => setFormData(team || emptyTeam), [team, isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={team ? "Editar Equipo" : "Nuevo Equipo"} footer={
            <>
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Cancelar</button>
                <button type="submit" onClick={() => onSave(formData as Equipo)} className="ml-3 px-4 py-2 rounded-md text-sm font-medium text-white bg-sarp-blue hover:bg-opacity-90">Guardar</button>
            </>
        }>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre del Equipo</label>
                    <input type="text" value={formData.nombre_equipo} onChange={e => setFormData({...formData, nombre_equipo: e.target.value})} className={baseInputClasses} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Encargado / Líder</label>
                    <select value={formData.encargado_empleado_id} onChange={e => setFormData({...formData, encargado_empleado_id: e.target.value})} className={baseSelectClasses}>
                        <option value="">Seleccionar Encargado</option>
                        {employees.map(e => <option key={e.empleado_id} value={e.empleado_id}>{e.nombre_completo}</option>)}
                    </select>
                </div>
            </div>
        </Modal>
    );
};


// --- Client Modal ---
export const ClientModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (c: Cliente) => void; client?: Cliente }> = ({ isOpen, onClose, onSave, client }) => {
    const emptyClient: Omit<Cliente, 'cliente_id' | '_row'> = { nombre_cliente: '', contacto: '', email_contacto: '' };
    const [formData, setFormData] = useState(client || emptyClient);
    useEffect(() => setFormData(client || emptyClient), [client, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={client ? "Editar Cliente" : "Nuevo Cliente"} footer={
            <>
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Cancelar</button>
                <button type="submit" onClick={() => onSave(formData as Cliente)} className="ml-3 px-4 py-2 rounded-md text-sm font-medium text-white bg-sarp-blue hover:bg-opacity-90">Guardar</button>
            </>
        }>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre Cliente / Razón Social</label>
                    <input type="text" name="nombre_cliente" value={formData.nombre_cliente} onChange={handleChange} className={baseInputClasses} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre Contacto</label>
                    <input type="text" name="contacto" value={formData.contacto} onChange={handleChange} className={baseInputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Email Contacto</label>
                    <input type="email" name="email_contacto" value={formData.email_contacto} onChange={handleChange} className={baseInputClasses} />
                </div>
            </div>
        </Modal>
    );
};

// --- User Modal ---
const defaultPermissions: UserPermissions = {
    upload_hours: false, upload_sae: false, upload_costs: false,
    view_reports: false, view_history: false,
    view_admin_projects: false, manage_admin_projects: false,
    view_admin_clients: false, manage_admin_clients: false,
    view_admin_teams: false, manage_admin_teams: false,
    view_admin_employees: false, manage_admin_employees: false,
    view_admin_users: false, manage_admin_users: false
};

const emptyUser: Omit<Usuario, 'usuario_id' | '_row'> = { 
    nombre: '', 
    email: '', 
    password: '',
    permisos: defaultPermissions,
    rol: 'Admin' 
};

export const UserModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (u: Usuario) => void; user?: Usuario }> = ({ isOpen, onClose, onSave, user }) => {
    const [formData, setFormData] = useState(user || emptyUser);
    const [isFormValid, setIsFormValid] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                ...emptyUser,
                ...user,
                permisos: { ...defaultPermissions, ...(user.permisos || {}) }
            });
        } else {
            setFormData(emptyUser);
        }
    }, [user, isOpen]);

    useEffect(() => {
        const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const isValid = !!formData.nombre && formData.nombre.trim() !== '' && !!formData.email && isValidEmail(formData.email);
        setIsFormValid(isValid);
    }, [formData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSave = () => {
        onSave(formData as Usuario);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={user ? "Editar Usuario" : "Agregar Usuario"} footer={
            <>
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Cancelar</button>
                <button type="submit" onClick={handleSave} disabled={!isFormValid} className="ml-3 px-4 py-2 rounded-md text-sm font-medium text-white bg-sarp-blue hover:bg-opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed">Guardar</button>
            </>
        }>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2"><h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1 mb-3">Información General</h4></div>
                    <div><label className="block text-sm font-medium text-gray-700">Nombre <span className="text-sarp-red">*</span></label><input type="text" name="nombre" value={formData.nombre} onChange={handleChange} className={baseInputClasses} required /></div>
                    <div><label className="block text-sm font-medium text-gray-700">Email <span className="text-sarp-red">*</span></label><input type="email" name="email" value={formData.email} onChange={handleChange} className={baseInputClasses} required /></div>
                    
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Contraseña {user && <span className="text-xs text-gray-400 font-normal">(Dejar en blanco para mantener)</span>}</label>
                        <div className="relative mt-1"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><LockIcon className="h-4 w-4"/></div><input type="password" name="password" value={formData.password || ''} onChange={handleChange} className={`${baseInputClasses} pl-10`} placeholder="Contraseña..." /></div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
