
export interface UserPermissions {
    // Carga de Datos
    upload_hours: boolean;
    upload_sae: boolean;
    upload_costs: boolean;
    
    // Reportes y Consultas
    view_reports: boolean;
    view_history: boolean;

    // Administración (Ver vs Gestionar)
    view_admin_projects: boolean;
    manage_admin_projects: boolean;

    view_admin_clients: boolean;
    manage_admin_clients: boolean;

    view_admin_teams: boolean;
    manage_admin_teams: boolean;

    view_admin_employees: boolean;
    manage_admin_employees: boolean;

    view_admin_users: boolean;
    manage_admin_users: boolean;
}

export interface Usuario {
    _row?: number;
    usuario_id?: number;
    nombre: string;
    email: string;
    password?: string; 
    permisos: UserPermissions; 
    rol?: 'Admin' | 'User'; 
    is_deleted?: boolean;
}

export interface Cliente {
    _row?: number;
    cliente_id?: number;
    nombre_cliente: string;
    contacto?: string;
    email_contacto?: string;
    is_deleted?: boolean;
}

export interface Empleado {
    _row?: number;
    empleado_id?: string;
    nombre_completo: string;
    puesto: string;
    equipo_id: string;
    equipo?: string; 
    costo_hora: number;
    costo_hora_extra: number;
    activo: boolean;
    is_deleted?: boolean;
}

export enum View {
    Dashboard = 'Dashboard',
    Upload = 'Carga de Datos',
    Admin = 'Administración',
    Report = 'Reportes',
    History = 'Históricos',
}

export interface Proyecto {
    _row?: number;
    proyecto_id?: number;
    nombre_proyecto: string; 
    cliente_id?: number;
    tienda?: string;
    pais?: string;
    ciudad?: string;
    precio_fabricacion: number;
    precio_instalacion: number;
    precio_flete: number;
    precio_servicios: number;
    estatus: 'Abierto' | 'Proceso' | 'Terminado';
    fecha_pedido_oc?: string;
    clave_interna?: string;
    odc_po?: string;
    nueva_sae?: string;
    is_deleted?: boolean;
}

export interface Equipo {
    _row?: number;
    equipo_id?: string;
    nombre_equipo: string;
    encargado_empleado_id: string;
    nombre_encargado?: string; 
    is_deleted?: boolean;
}

export enum CostType {
    Flete = 'Flete',
    Montaje = 'Montaje',
    Viaticos = 'Viáticos',
    MaterialesExtra = 'Materiales Extra',
    ServiciosExternos = 'Servicios Externos',
    CostoFinanciero = 'Costo Financiero',
    Otros = 'Otros',
}

export interface AdditionalCost {
    _row?: number;
    transaccion_id?: number;
    proyecto_id: number;
    nombre_proyecto?: string;
    tipo_costo: CostType;
    descripcion: string;
    monto: number;
    fecha: string;
    otro_concepto?: string;
    is_deleted?: boolean;
}

export interface HourTransaction {
    _row?: number;
    transaccion_id: number;
    proyecto_id: number;
    nombre_proyecto: string;
    empleado_id: string;
    nombre_completo_empleado: string;
    fecha_registro: string;
    semana_del_anio: number;
    horas_registradas: number;
    costo_hora_real: number;
    costo_total_mo: number;
    is_deleted?: boolean;
    tipo_hora?: 'Normal' | 'Extra';
}

export interface MaterialTransaction {
    _row?: number;
    transaccion_id: number;
    proyecto_id: number;
    nombre_proyecto: string;
    numero_parte_sae: string;
    descripcion_material: string;
    cantidad: number;
    costo_unitario: number;
    costo_total_material: number;
    fecha_movimiento_sae: string;
    origen_dato?: string;
    is_deleted?: boolean;
}

export interface ProfitabilityReport {
    proyecto_id: number;
    nombre_proyecto: string;
    nueva_sae?: string;
    precio_fabricacion: number;
    precio_instalacion: number;
    precio_flete: number;
    precio_servicios: number;
    ejercicio: number; 
    monto_venta_pactado: number;
    costo_total_mano_obra: number;
    costo_total_materiales: number;
    costo_total_adicionales: number;
    costo_total_proyecto: number;
    margen_operativo: number;
    porcentaje_margen: number;
    equipos_involucrados: { equipo: string; horas: number }[];
    detalles_mano_obra: HourTransaction[];
    detalles_materiales: MaterialTransaction[];
    detalles_adicionales: AdditionalCost[];
}

export interface FactorOperativo {
    _row?: number;
    config_id?: number;
    clave: string;
    valor: number;
    fecha_registro: string;
    usuario?: string;
}

export interface LogEntry {
  log_id: number;
  entity_id: number;
  entity_type: 'Hour' | 'Material' | 'Cost';
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  changes?: { field: string; oldValue: any; newValue: any }[];
  user_name: string;
  timestamp: string;
}

export type DeletedItem = (HourTransaction | MaterialTransaction | AdditionalCost) & { 
    entity_type: 'Hour' | 'Material' | 'Cost';
    deleted_by: string;
    deleted_at: string;
};

export interface Mismatch {
    rowIndex: number;
    type: 'employee' | 'project' | 'project-finished';
    value: string;
    originalProjectIdentifier: string;
    employeeIdentifier?: string;
    weekNum?: number;
    hours?: number;
    date?: string;
    amount?: number;
    sheetName?: string;
}
