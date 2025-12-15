
// FIX: Add type declaration for gapi to fix TypeScript errors.
declare const gapi: any;

import * as XLSX from 'xlsx';
import { SPREADSHEET_ID, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, IS_CONFIGURED } from '../config';
import type {
    Usuario,
    Empleado,
    Proyecto,
    AdditionalCost,
    HourTransaction,
    MaterialTransaction,
    ProfitabilityReport,
    DeletedItem,
    LogEntry,
    Equipo,
    Mismatch,
    FactorOperativo,
    Cliente,
    UserPermissions
} from '../types';

// Helper function to normalize header keys (remove accents, lowercase, spaces to underscores)
const normalizeKey = (header: any): string => {
    if (!header) return '';
    return String(header)
        .trim()
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/\s+/g, '_'); // Replace spaces with underscores
};

const sheetValuesToObjectArray = <T>(values: any[][]): T[] => {
    if (!values || values.length < 2) return []; 
    const [header, ...rows] = values;
    const normalizedHeader = header.map(normalizeKey);

    const data = rows.map((row, index) => {
        const obj: any = { _row: index + 2 }; 
        normalizedHeader.forEach((key, i) => {
            if (key) { 
                const value = row[i];
                if (value === 'TRUE') {
                    obj[key] = true;
                } else if (value === 'FALSE') {
                    obj[key] = false;
                } else {
                    obj[key] = value;
                }
            }
        });
        return obj as T;
    });

    const idKey = normalizedHeader[0];
    if (!idKey) return [];

    return data.filter(obj => {
        // @ts-ignore
        const idValue = obj[idKey];
        return idValue !== null && idValue !== undefined && String(idValue).trim() !== '';
    });
};

const objectToSheetValues = (obj: any, headers: string[]): any[] => {
    return headers.map(header => {
        const key = normalizeKey(header);
        const value = obj[key];
        if (value === undefined || value === null) return '';
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        return value;
    });
};

class ApiService {
    private accessToken: string | null = null;
    private tokenExpiry: number | null = null;
    private discoveryDocs = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];
    private sheetHeaders: Record<string, string[]> = {};
    private gapiInitPromise: Promise<void> | null = null;
    
    // Cache and Request Deduplication
    private pendingRequests: Map<string, Promise<any>> = new Map();
    private cache: Map<string, { data: any[], timestamp: number }> = new Map();
    private CACHE_TTL = 5000; // 5 seconds cache to handle bursts

    private sheetNames = {
        projects: 'Proyectos',
        employees: 'Empleados',
        users: 'Usuarios',
        teams: 'Equipos',
        clients: 'Clientes',
        hourTransactions: 'Horas',
        materialTransactions: 'Materiales',
        additionalCosts: 'CostosAdicionales',
        deletedItems: 'Papelera', 
        logs: 'Logs',
        config: 'Configuracion',
    };

    // Define schema for auto-initialization
    private defaultHeaders: Record<string, string[]> = {
        'Proyectos': ['proyecto_id', 'nombre_proyecto', 'cliente_id', 'tienda', 'pais', 'ciudad', 'estatus', 'precio_fabricacion', 'precio_instalacion', 'precio_flete', 'precio_servicios', 'fecha_pedido_oc', 'clave_interna', 'odc_po', 'nueva_sae', 'is_deleted'],
        'Empleados': ['empleado_id', 'nombre_completo', 'puesto', 'equipo_id', 'costo_hora', 'costo_hora_extra', 'activo', 'is_deleted'],
        'Usuarios': ['usuario_id', 'nombre', 'email', 'password', 'permisos', 'rol', 'is_deleted'],
        'Equipos': ['equipo_id', 'nombre_equipo', 'encargado_empleado_id', 'is_deleted'],
        'Clientes': ['cliente_id', 'nombre_cliente', 'contacto', 'email_contacto', 'is_deleted'],
        'Horas': ['transaccion_id', 'proyecto_id', 'empleado_id', 'fecha_registro', 'semana_del_anio', 'horas_registradas', 'costo_hora_real', 'costo_total_mo', 'tipo_hora', 'is_deleted'],
        'Materiales': ['transaccion_id', 'proyecto_id', 'numero_parte_sae', 'descripcion_material', 'cantidad', 'costo_unitario', 'costo_total_material', 'fecha_movimiento_sae', 'origen_dato', 'is_deleted'],
        'CostosAdicionales': ['transaccion_id', 'proyecto_id', 'tipo_costo', 'descripcion', 'monto', 'fecha', 'otro_concepto', 'is_deleted'],
        'Logs': ['log_id', 'entity_id', 'entity_type', 'action', 'changes', 'user_name', 'timestamp'],
        'Configuracion': ['config_id', 'clave', 'valor', 'fecha_registro', 'usuario'],
        // 'Papelera' unused in logic but kept in map
    };
    
    public get isMockMode() {
        return false;
    }

    private getErrorMessage(error: any): string {
        if (!error) return 'Error desconocido';
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message;
        
        // 1. Try GAPI error structure (Detailed)
        if (error.result?.error) {
            const { message, code, status } = error.result.error;
            return `GAPI Error (${code} ${status}): ${message}`;
        }
        
        // 2. Try HTTP Status
        if (error.status && error.statusText) {
             return `HTTP Error: ${error.status} ${error.statusText}`;
        }

        // 3. Fallback to common properties
        if (error.message) return error.message;

        // 4. Fallback to JSON stringify, avoiding empty objects
        try {
            const json = JSON.stringify(error, null, 2);
            if (json === '{}' || json === '[]') {
                const str = String(error);
                return str === '[object Object]' ? 'Error desconocido (Sin detalles)' : str;
            }
            return json;
        } catch (e) {
            return String(error);
        }
    }

    public async initialize() {
        if (!IS_CONFIGURED) {
            throw new Error("Credenciales incompletas en config.ts (CLIENT_ID, SECRET, REFRESH_TOKEN o SPREADSHEET_ID faltantes).");
        }

        try {
            console.log("Iniciando conexión con Google Sheets...");
            await this.waitForGapiClient();
            
            console.log("GAPI cargado. Validando credenciales...");
            await this.refreshAccessToken();
            
            console.log("Token obtenido. Verificando acceso a la hoja...");
            await this.ensureSheetsExist();
            
            console.log("ApiService inicializado correctamente.");
        } catch (error: any) {
             const errorMsg = this.getErrorMessage(error);
             console.error("Error crítico de inicialización:", errorMsg);
             throw new Error(errorMsg); 
        }
    }

    private waitForGapiClient(): Promise<void> {
        if (!this.gapiInitPromise) {
            this.gapiInitPromise = new Promise((resolve, reject) => {
                 let attempts = 0;
                 const checkGapi = () => {
                    attempts++;
                    if (typeof gapi !== 'undefined') {
                        gapi.load('client', async () => {
                            try {
                                await gapi.client.init({ discoveryDocs: this.discoveryDocs });
                                resolve();
                            } catch (e) {
                                reject(e);
                            }
                        });
                    } else {
                        if (attempts > 100) { // 10 seconds timeout
                            reject(new Error("Timeout esperando carga de Google API script. Verifique su conexión o <script> en index.html."));
                            return;
                        }
                        setTimeout(checkGapi, 100);
                    }
                };
                checkGapi();
            });
        }
        return this.gapiInitPromise;
    }

    private async refreshAccessToken() {
        try {
            await this.waitForGapiClient(); // Ensure gapi is ready before setting token
            
            if (!REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
                throw new Error("Faltan constantes de configuración (CLIENT_ID, SECRET o REFRESH_TOKEN).");
            }

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: CLIENT_ID.trim(),
                    client_secret: CLIENT_SECRET.trim(),
                    refresh_token: REFRESH_TOKEN.trim(),
                    grant_type: 'refresh_token',
                }),
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.error("Token refresh failed:", JSON.stringify(data, null, 2));
                if (data.error === 'invalid_client') {
                    throw new Error("Credenciales de Cliente (ID/Secret) inválidas.");
                }
                if (data.error === 'invalid_grant') {
                    throw new Error("Refresh Token inválido o expirado. Genere uno nuevo.");
                }
                const serverMsg = data.error_description || data.error || "Error desconocido";
                throw new Error(`Error obteniendo token: ${serverMsg}`);
            }
            
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + data.expires_in * 1000;
            
            if (gapi.client) {
                gapi.client.setToken({ access_token: this.accessToken });
            }

        } catch (error: any) {
            // Re-throw if it's already a specific error we created
            if (error instanceof Error && (error.message.includes('Credenciales') || error.message.includes('Token') || error.message.includes('configuración'))) {
                throw error;
            }
            console.error("Error refreshing access token (Details):", error);
            throw new Error(`Fallo en autenticación Google: ${this.getErrorMessage(error)}`);
        }
    }

    private async getAccessToken(): Promise<string> {
        if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry < Date.now() + 60000) {
            await this.refreshAccessToken();
        }
        return this.accessToken!;
    }

    // --- SHEET AUTO-INITIALIZATION ---
    private async ensureSheetsExist() {
        // Need token to call API
        await this.getAccessToken(); 
        
        let response;
        try {
            response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: SPREADSHEET_ID,
                fields: 'sheets.properties.title'
            });
        } catch (error: any) {
            console.error("Error accessing spreadsheet:", error);
            const status = error.status || error.result?.error?.code;
            
            if (status === 403) {
                throw new Error(`Acceso Denegado (403). La cuenta no tiene permiso para ver el Spreadsheet '${SPREADSHEET_ID}'.\nSolución: Comparta la hoja de Google con el email del Service Account o Usuario que está utilizando.`);
            }
            if (status === 404) {
                throw new Error(`Hoja de cálculo no encontrada (404). Verifique el ID: ${SPREADSHEET_ID}`);
            }
            throw error;
        }

        const existingSheets = response.result.sheets.map((s: any) => s.properties.title);
        const requiredSheetsMap = this.defaultHeaders;
        const missingSheets = Object.keys(requiredSheetsMap).filter(name => !existingSheets.includes(name));

        if (missingSheets.length > 0) {
            console.info(`S.A.R.P. Initialization: Creating missing sheets: ${missingSheets.join(', ')}`);
            
            // 1. Create Sheets
            const requests = missingSheets.map(title => ({
                addSheet: { properties: { title } }
            }));
            
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: { requests }
            });

            // 2. Add Headers (Sequentially to be safe)
            for (const sheetName of missingSheets) {
                const headers = requiredSheetsMap[sheetName];
                if (headers && headers.length > 0) {
                    await gapi.client.sheets.spreadsheets.values.update({
                        spreadsheetId: SPREADSHEET_ID,
                        range: `${sheetName}!A1`,
                        valueInputOption: 'USER_ENTERED',
                        resource: { values: [headers] }
                    });
                }
            }
            
            // 3. Create Default Admin if Users table was missing
            if (missingSheets.includes('Usuarios')) {
                    console.info("Creating default Admin user...");
                    await this.addUser({
                    nombre: 'Admin System',
                    email: 'admin@sarp.com',
                    password: 'admin',
                    rol: 'Admin',
                    permisos: {
                        upload_hours: true, upload_sae: true, upload_costs: true,
                        view_reports: true, view_history: true,
                        view_admin_projects: true, manage_admin_projects: true,
                        view_admin_clients: true, manage_admin_clients: true,
                        view_admin_teams: true, manage_admin_teams: true,
                        view_admin_employees: true, manage_admin_employees: true,
                        view_admin_users: true, manage_admin_users: true
                    }
                    });
            }
        }
    }
    
    // GENERIC DATA OPERATIONS

    private clearCache(sheetNameKey: keyof typeof this.sheetNames) {
         const sheetName = this.sheetNames[sheetNameKey];
         this.cache.delete(`${sheetName}-true`);
         this.cache.delete(`${sheetName}-false`);
    }

    private async fetchWithRetry(apiCall: () => Promise<any>, retries = 3, delay = 1000): Promise<any> {
        try {
            return await apiCall();
        } catch (error: any) {
            // Retry on Quota Exceeded (429) or generic 403 quota errors
            if (retries > 0 && (error.status === 429 || (error.result?.error?.message && error.result.error.message.includes('Quota exceeded')))) {
                // console.warn(`Quota exceeded. Retrying in ${delay}ms... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.fetchWithRetry(apiCall, retries - 1, delay * 2);
            }
            throw error;
        }
    }
    
    private async getSheetData<T>(sheetName: string, filterDeleted = true): Promise<T[]> {
        const cacheKey = `${sheetName}-${filterDeleted}`;

        // 1. Check Memory Cache
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
            return cached.data;
        }

        // 2. Check Pending Requests (Request Coalescing)
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey) as Promise<T[]>;
        }

        await this.getAccessToken();

        // 3. Perform Request
        const fetchPromise = (async () => {
            try {
                const response = await this.fetchWithRetry(() => gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${sheetName}!A:Z`,
                    valueRenderOption: 'UNFORMATTED_VALUE',
                    dateTimeRenderOption: 'FORMATTED_STRING'
                }));

                const values = response.result.values;
                if (!values || values.length === 0) {
                    this.sheetHeaders[sheetName] = [];
                    return [];
                }
                this.sheetHeaders[sheetName] = values[0];
                const data = sheetValuesToObjectArray<T>(values);

                let result = data;
                if(filterDeleted) {
                    // @ts-ignore
                    result = data.filter(item => !item.is_deleted);
                }

                // Update Cache
                this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
                return result;

            } catch (error: any) {
                const errorMsg = this.getErrorMessage(error);
                console.error(`Error fetching data from sheet ${sheetName}:`, errorMsg);
                throw new Error(`No se pudo leer la hoja '${sheetName}'. Verifique que exista, que tenga cabeceras y que la API tenga permisos. Detalles: ${errorMsg}`);
            } finally {
                this.pendingRequests.delete(cacheKey);
            }
        })();

        this.pendingRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    }

    private async addSheetRow(sheetNameKey: keyof typeof this.sheetNames, data: any, idField: string) {
        await this.getAccessToken();
        const sheetName = this.sheetNames[sheetNameKey];
        
        if (!this.sheetHeaders[sheetName]) await this.getSheetData(sheetName);
        const headers = this.sheetHeaders[sheetName];
        if (!headers || headers.length === 0) throw new Error(`No se encontraron cabeceras en la hoja ${sheetName}. No se puede agregar la fila.`);

        const fullData = { ...data };
        if (!fullData[idField]) {
            const nextId = String(Date.now());
            fullData[idField] = nextId;
        }

        const values = [objectToSheetValues(fullData, headers)];
        
        try {
            await this.fetchWithRetry(() => gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:A`,
                valueInputOption: 'USER_ENTERED',
                resource: { values },
            }));
            this.clearCache(sheetNameKey);
            return { success: true, message: 'Registro agregado exitosamente.' };
        } catch (error: any) {
            const errorMsg = this.getErrorMessage(error);
            console.error(`Error adding row to sheet ${sheetName}:`, errorMsg);
            throw new Error(`No se pudo agregar el registro en '${sheetName}'. Detalles: ${errorMsg}`);
        }
    }

     private async batchAddSheetRows(sheetNameKey: keyof typeof this.sheetNames, dataArray: any[], idField: string) {
        if (dataArray.length === 0) return { success: true, message: 'No hay datos para guardar.' };

        await this.getAccessToken();
        const sheetName = this.sheetNames[sheetNameKey];

        if (!this.sheetHeaders[sheetName] || this.sheetHeaders[sheetName].length === 0) {
            await this.getSheetData(sheetName);
        }
        const headers = this.sheetHeaders[sheetName];
        if (!headers || headers.length === 0) throw new Error(`No se encontraron cabeceras en la hoja ${sheetName}. No se pueden agregar las filas.`);

        const startTime = Date.now();
        const values = dataArray.map((data, index) => {
            const nextId = `${startTime + index}`;
            const fullData = { [idField]: nextId, ...data };
            return objectToSheetValues(fullData, headers);
        });
        
        try {
            await this.fetchWithRetry(() => gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:A`,
                valueInputOption: 'USER_ENTERED',
                resource: { values },
            }));
            this.clearCache(sheetNameKey);
            return { success: true, message: `${values.length} registros guardados exitosamente.` };
        } catch (error: any) {
            const errorMsg = this.getErrorMessage(error);
            console.error(`Error batch adding rows to sheet ${sheetName}:`, errorMsg);
            throw new Error(`No se pudo agregar los registros en lote a '${sheetName}'. Detalles: ${errorMsg}`);
        }
    }


    private async updateSheetRow(sheetNameKey: keyof typeof this.sheetNames, data: any) {
        if (!data._row) throw new Error("No se puede actualizar la fila: falta la propiedad _row.");
        await this.getAccessToken();
        const sheetName = this.sheetNames[sheetNameKey];

        if (!this.sheetHeaders[sheetName]) await this.getSheetData(sheetName);
        const headers = this.sheetHeaders[sheetName];

        const values = [objectToSheetValues(data, headers)];
        const columnLetter = String.fromCharCode(64 + headers.length);
        const range = `${sheetName}!A${data._row}:${columnLetter}${data._row}`;

        try {
            await this.fetchWithRetry(() => gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range,
                valueInputOption: 'USER_ENTERED',
                resource: { values },
            }));
            this.clearCache(sheetNameKey);
            return { success: true, message: 'Registro actualizado.' };
        } catch (error: any) {
             const errorMsg = this.getErrorMessage(error);
             console.error(`Error updating row in sheet ${sheetName}:`, errorMsg);
             throw new Error(`No se pudo actualizar el registro en '${sheetName}'. Detalles: ${errorMsg}`);
        }
    }

    // --- LOGGING SYSTEM ---
    private async logChange(entityId: number | string, entityType: 'Hour' | 'Material' | 'Cost', action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE', changes: any[], userName: string = 'Admin') {
        const logEntry: Omit<LogEntry, 'log_id'> = {
            entity_id: Number(entityId), 
            entity_type: entityType,
            action,
            changes: JSON.stringify(changes) as any, 
            user_name: userName,
            timestamp: new Date().toISOString()
        };
        // Logs are append-only and read frequently, we use addSheetRow which clears cache
        await this.addSheetRow('logs', logEntry, 'log_id');
    }

    // CATALOGS
    getProjects(): Promise<Proyecto[]> { return this.getSheetData<Proyecto>(this.sheetNames.projects); }
    
    async getUsers(): Promise<Usuario[]> { 
        const rawUsers = await this.getSheetData<any>(this.sheetNames.users); 
        
        return rawUsers.map(u => {
            let permisosObj: UserPermissions = {
                upload_hours: false, upload_sae: false, upload_costs: false,
                view_reports: false, view_history: false,
                view_admin_projects: false, manage_admin_projects: false,
                view_admin_clients: false, manage_admin_clients: false,
                view_admin_teams: false, manage_admin_teams: false,
                view_admin_employees: false, manage_admin_employees: false,
                view_admin_users: false, manage_admin_users: false
            };

            // Parse 'permisos' JSON string if exists
            if (u.permisos && typeof u.permisos === 'string') {
                try {
                    permisosObj = JSON.parse(u.permisos);
                } catch(e) {
                    console.warn(`Could not parse permissions for user ${u.usuario_id}`);
                }
            } 
            // Backward compatibility: If 'rol' exists but permissions missing/invalid
            else if (u.rol === 'Admin') {
                permisosObj = {
                    upload_hours: true, upload_sae: true, upload_costs: true,
                    view_reports: true, view_history: true,
                    view_admin_projects: true, manage_admin_projects: true,
                    view_admin_clients: true, manage_admin_clients: true,
                    view_admin_teams: true, manage_admin_teams: true,
                    view_admin_employees: true, manage_admin_employees: true,
                    view_admin_users: true, manage_admin_users: true
                };
            }

            return {
                ...u,
                permisos: permisosObj
            } as Usuario;
        });
    }

    getClients(): Promise<Cliente[]> { return this.getSheetData<Cliente>(this.sheetNames.clients); }

    async getEmployees(): Promise<Empleado[]> {
        // Parallel fetch optimized by request coalescing if Teams called elsewhere
        const [rawData, teams] = await Promise.all([
            this.getSheetData<any>(this.sheetNames.employees),
            this.getSheetData<Equipo>(this.sheetNames.teams)
        ]);

        const teamMap = new Map(teams.map(t => [String(t.equipo_id).trim(), t.nombre_equipo]));

        return rawData.map((e: any) => {
            const equipoId = e.equipo_id ? String(e.equipo_id).trim() : '';
            return {
                _row: e._row,
                empleado_id: e.empleado || e.empleado_id, 
                nombre_completo: e.nombre || e.nombre_completo,
                equipo_id: equipoId,
                equipo: teamMap.get(equipoId) || 'Sin Equipo',
                puesto: e.puesto || 'N/A',
                costo_hora: Number(e.costo_hora) || 0,
                costo_hora_extra: Number(e.costo_hora_extra) || 0,
                activo: e.hasOwnProperty('activo') ? e.activo : true,
                is_deleted: e.is_deleted || false,
            };
        });
    }

    async getEquipos(): Promise<Equipo[]> {
        const [equipos, empleados] = await Promise.all([
            this.getSheetData<Equipo>(this.sheetNames.teams),
            this.getEmployees()
        ]);
        const employeeMap = new Map(empleados.map(e => [String(e.empleado_id).trim(), e.nombre_completo]));
        return equipos.map(equipo => {
            const encargadoId = equipo.encargado_empleado_id ? String(equipo.encargado_empleado_id).trim() : '';
            return {
                ...equipo,
                nombre_encargado: employeeMap.get(encargadoId) || 'Encargado no encontrado'
            };
        });
    }
    
    addProject(p: Omit<Proyecto, 'proyecto_id' | '_row'>) { return this.addSheetRow('projects', p, 'proyecto_id'); }
    updateProject(p: Proyecto) { return this.updateSheetRow('projects', p); }
    async deleteProject(id: number) {
        const items = await this.getProjects();
        const item = items.find(i => i.proyecto_id === id);
        if (!item) throw new Error("Proyecto no encontrado");
        return this.updateSheetRow('projects', { ...item, is_deleted: true });
    }
    
    addEmployee(e: Omit<Empleado, '_row'>) { return this.addSheetRow('employees', e, 'empleado_id'); }
    updateEmployee(e: Empleado) { return this.updateSheetRow('employees', e); }
     async deleteEmployee(id: string) {
        const items = await this.getEmployees();
        const item = items.find(i => i.empleado_id === id);
        if (!item) throw new Error("Empleado no encontrado");
        return this.updateSheetRow('employees', { ...item, is_deleted: true });
    }

    addUser(u: Omit<Usuario, 'usuario_id' | '_row'>) { 
        const dataToSave = {
            ...u,
            permisos: JSON.stringify(u.permisos)
        };
        return this.addSheetRow('users', dataToSave, 'usuario_id'); 
    }
    
    updateUser(u: Usuario) { 
        const dataToSave = {
            ...u,
            permisos: JSON.stringify(u.permisos)
        };
        return this.updateSheetRow('users', dataToSave); 
    }
    
    async deleteUser(id: number) {
        const items = await this.getUsers();
        const item = items.find(i => i.usuario_id === id);
        if (!item) throw new Error("Usuario no encontrado");
        const dataToSave = { ...item, permisos: JSON.stringify(item.permisos), is_deleted: true };
        return this.updateSheetRow('users', dataToSave);
    }

    addEquipo(t: Omit<Equipo, 'equipo_id' | '_row'>) { return this.addSheetRow('teams', t, 'equipo_id'); }
    updateEquipo(t: Equipo) { return this.updateSheetRow('teams', t); }
    async deleteEquipo(id: string) {
        const items = await this.getSheetData<Equipo>(this.sheetNames.teams); 
        const item = items.find(i => String(i.equipo_id) === String(id));
        if (!item) throw new Error("Equipo no encontrado");
        return this.updateSheetRow('teams', { ...item, is_deleted: true });
    }

    addClient(c: Omit<Cliente, 'cliente_id' | '_row'>) { return this.addSheetRow('clients', c, 'cliente_id'); }
    updateClient(c: Cliente) { return this.updateSheetRow('clients', c); }
    async deleteClient(id: number) {
        const items = await this.getClients();
        const item = items.find(i => i.cliente_id === id);
        if (!item) throw new Error("Cliente no encontrado");
        return this.updateSheetRow('clients', { ...item, is_deleted: true });
    }

    async getHourTransactions(filters?: any): Promise<HourTransaction[]> { 
        // Efficient due to Request Coalescing
        const [hours, projects, employees] = await Promise.all([
            this.getSheetData<HourTransaction>(this.sheetNames.hourTransactions),
            this.getProjects(),
            this.getEmployees()
        ]);

        const projectMap = new Map(projects.map(p => [String(p.proyecto_id), p.nombre_proyecto]));
        const employeeMap = new Map(employees.map(e => [String(e.empleado_id), e.nombre_completo]));

        let filteredHours = hours;
        if (filters?.proyecto_id) {
            filteredHours = filteredHours.filter(h => String(h.proyecto_id) === String(filters.proyecto_id));
        }

        return filteredHours.map(h => ({
            ...h,
            nombre_proyecto: projectMap.get(String(h.proyecto_id)) || h.nombre_proyecto || 'Proyecto Desconocido',
            nombre_completo_empleado: employeeMap.get(String(h.empleado_id)) || h.nombre_completo_empleado || 'Empleado Desconocido'
        }));
    }

    getMaterialTransactions(_filters?: any): Promise<MaterialTransaction[]> { return this.getSheetData<MaterialTransaction>(this.sheetNames.materialTransactions); }
    
    async getAdditionalCosts(filters?: any): Promise<AdditionalCost[]> { 
        const [costs, projects] = await Promise.all([
            this.getSheetData<AdditionalCost>(this.sheetNames.additionalCosts),
            this.getProjects()
        ]);
        
        const projectMap = new Map(projects.map(p => [String(p.proyecto_id).trim(), p.nombre_proyecto]));
        
        let filteredCosts = costs;
        if (filters?.proyecto_id) {
             filteredCosts = filteredCosts.filter(c => String(c.proyecto_id).trim() === String(filters.proyecto_id).trim());
        }

        return filteredCosts.map(c => ({
            ...c,
            nombre_proyecto: projectMap.get(String(c.proyecto_id).trim()) || 'Proyecto Desconocido'
        }));
    }
    
    async addAdditionalCost(cost: Omit<AdditionalCost, 'transaccion_id' | '_row' | 'nombre_proyecto'>) {
        if (this.sheetHeaders[this.sheetNames.additionalCosts]) {
            delete this.sheetHeaders[this.sheetNames.additionalCosts];
        }
        return this.addSheetRow('additionalCosts', cost, 'transaccion_id');
    }

    private getChanges(oldObj: any, newObj: any) {
        const changes = [];
        for (const key in newObj) {
            if (key === '_row' || key === 'is_deleted') continue;
            if (oldObj[key] != newObj[key]) {
                changes.push({ field: key, oldValue: oldObj[key], newValue: newObj[key] });
            }
        }
        return changes;
    }

    async updateHourTransaction(data: HourTransaction, userName: string = 'Admin') { 
        const hours = await this.getHourTransactions(); 
        const original = hours.find(h => h.transaccion_id === data.transaccion_id);
        
        if (original) {
            const changes = this.getChanges(original, data);
            if (changes.length > 0) {
                await this.logChange(data.transaccion_id, 'Hour', 'UPDATE', changes, userName);
            }
        }
        return this.updateSheetRow('hourTransactions', data); 
    }

    async updateMaterialTransaction(data: MaterialTransaction, userName: string = 'Admin') { 
        const mats = await this.getMaterialTransactions();
        const original = mats.find(m => m.transaccion_id === data.transaccion_id);
        if (original) {
            const changes = this.getChanges(original, data);
            if (changes.length > 0) await this.logChange(data.transaccion_id, 'Material', 'UPDATE', changes, userName);
        }
        return this.updateSheetRow('materialTransactions', data); 
    }

    async updateAdditionalCost(data: AdditionalCost, userName: string = 'Admin') { 
        const costs = await this.getAdditionalCosts();
        const original = costs.find(c => c.transaccion_id === data.transaccion_id);
        if (original) {
            const changes = this.getChanges(original, data);
            if (changes.length > 0) await this.logChange(data.transaccion_id!, 'Cost', 'UPDATE', changes, userName);
        }
        return this.updateSheetRow('additionalCosts', data); 
    }

    private async softDeleteTransaction(sheetNameKey: keyof typeof this.sheetNames, id: number, idField: string, entityType: 'Hour' | 'Material' | 'Cost', userName: string) {
        // @ts-ignore
        const items = await this[`get${sheetNameKey.charAt(0).toUpperCase() + sheetNameKey.slice(1)}`]();
        const item = items.find((i: any) => i[idField] === id);
        if (!item) throw new Error("Registro no encontrado para eliminar.");
        
        await this.logChange(id, entityType, 'DELETE', [], userName);
        return this.updateSheetRow(sheetNameKey, { ...item, is_deleted: true });
    }

    deleteHourTransaction(id: number, userName: string = 'Admin') { return this.softDeleteTransaction('hourTransactions', id, 'transaccion_id', 'Hour', userName); }
    deleteMaterialTransaction(id: number, userName: string = 'Admin') { return this.softDeleteTransaction('materialTransactions', id, 'transaccion_id', 'Material', userName); }
    deleteAdditionalCost(id: number, userName: string = 'Admin') { return this.softDeleteTransaction('additionalCosts', id, 'transaccion_id', 'Cost', userName); }
    
    // UPLOADS & REPORTING & HISTORY & FACTORS
    
    async parseWeeklyHoursReport(fileBuffer: ArrayBuffer, weekStartDate: string) { return this._parseWeeklyHoursReport(fileBuffer, weekStartDate); }
    private async _parseWeeklyHoursReport(fileBuffer: ArrayBuffer, weekStartDate: string) {
        const workbook = XLSX.read(fileBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        const transactions: any[] = [];
        const mismatches: Mismatch[] = [];
        const details = { projectSummary: {} as any, employeeSummary: {} as any };

        const [projects, employees] = await Promise.all([this.getProjects(), this.getEmployees()]);
        // Normalize IDs for comparison
        const projectMap = new Map(projects.map(p => [String(p.nueva_sae).trim().toUpperCase(), p]));
        const projectInternalMap = new Map(projects.map(p => [String(p.clave_interna).trim().toUpperCase(), p]));
        const employeeMap = new Map(employees.map(e => [String(e.empleado_id).trim().toUpperCase(), e]));

        // --- NEW LOGIC: Scan for Layout (Periodo Header + Time Columns) ---
        let headerRowIndex = -1;
        let periodStartDate: Date | null = null;

        // 1. Find Header Row (Look for 'Clave empleado' or similar in first few columns)
        for (let i = 0; i < Math.min(20, rawData.length); i++) {
            const rowStr = rawData[i].map(c => String(c).toLowerCase()).join(' ');
            if (rowStr.includes('clave') && (rowStr.includes('emplead') || rowStr.includes('nombre') || rowStr.includes('no.'))) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            return { success: false, message: "No se encontró la fila de encabezados (Clave Empleado) en el archivo." };
        }

        // 2. Try to parse "PERIODO DEL..." from rows above header
        const periodRegex = /PERIODO\s+DEL\s+(\d{1,2})\s*-\s*\d{1,2}\s+DE\s+([A-Z]{3,})\s+(\d{4})/i;
        const monthMap: Record<string, number> = {
            'ENE': 0, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'MAY': 4, 'JUN': 5, 
            'JUL': 6, 'AGO': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DIC': 11
        };

        for (let i = Math.max(0, headerRowIndex - 5); i < headerRowIndex; i++) {
            const rowStr = rawData[i].join(' ').toUpperCase();
            const match = rowStr.match(periodRegex);
            if (match) {
                const day = parseInt(match[1]);
                const monthStr = match[2].substring(0, 3);
                const year = parseInt(match[3]);
                const month = monthMap[monthStr];
                
                if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                    periodStartDate = new Date(year, month, day);
                    // Adjust if start date is not Monday (The prompt image shows 06 Oct 2025 which is Monday)
                    // We assume the period starts on Monday for calculation purposes
                }
                break;
            }
        }

        // Fallback to UI date if not found in file
        let reportStartDate = periodStartDate;
        if (!reportStartDate) {
            if (!weekStartDate) {
                return { success: false, message: "No se pudo detectar la fecha del periodo en el archivo. Por favor seleccione la fecha manualmente." };
            }
            // Parse UI string YYYY-MM-DD
            const parts = weekStartDate.split('-');
            reportStartDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }

        // 3. Map Columns to Days and Hours
        // Structure based on format: Lunes (3 cols), Martes (3 cols), ... Sabado (2 cols) = 17 columns of data
        const dayOffsets = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5];
        
        // Revised logic: shiftDefinitions to handle start times and default durations
        // Shift times: Morning (08:00), Afternoon (14:00), Evening (17:30)
        // Saturday: Morning (08:00), Afternoon (13:00)
        const shiftDefinitions = [
            { start: 8.0, duration: 5.0 },  { start: 14.0, duration: 3.5 }, { start: 17.5, duration: 2.0 }, // Mon (0,1,2)
            { start: 8.0, duration: 5.0 },  { start: 14.0, duration: 3.5 }, { start: 17.5, duration: 2.0 }, // Tue (3,4,5)
            { start: 8.0, duration: 5.0 },  { start: 14.0, duration: 3.5 }, { start: 17.5, duration: 2.0 }, // Wed (6,7,8)
            { start: 8.0, duration: 5.0 },  { start: 14.0, duration: 3.5 }, { start: 17.5, duration: 2.0 }, // Thu (9,10,11)
            { start: 8.0, duration: 5.0 },  { start: 14.0, duration: 3.5 }, { start: 17.5, duration: 2.0 }, // Fri (12,13,14)
            { start: 8.0, duration: 5.0 },  { start: 13.0, duration: 1.0 }                                   // Sat (15,16)
        ];

        const startCol = 3; // Column D

        // 4. Determine Data Start Row
        // IMPORTANT: The file might have a secondary header row with hour ranges (08:00 - 13:00)
        let startRow = headerRowIndex + 1;
        if (startRow < rawData.length) {
             const subHeaderRow = rawData[startRow].map(c => String(c));
             // Heuristic: check if multiple cells contain range dashes like '08:00 - 13:00'
             const timeRangeCount = subHeaderRow.filter(s => s.includes(':') && s.includes('-')).length;
             if (timeRangeCount > 2) {
                 startRow++;
             }
        }

        // 5. Iterate Rows
        for (let r = startRow; r < rawData.length; r++) {
            const row = rawData[r];
            const empIdRaw = row[0]; // Col A
            
            if (!empIdRaw) continue; // Skip empty rows

            const empId = String(empIdRaw).trim().toUpperCase();
            
            // Skip repeated headers if found
            if (empId.includes('CLAVE') || empId.includes('EMPLEAD')) continue;

            const employee = employeeMap.get(empId);

            if (!employee) {
                mismatches.push({
                    rowIndex: r + 1,
                    type: 'employee',
                    value: empId,
                    originalProjectIdentifier: '',
                    sheetName: 'Horas'
                });
                continue;
            }

            // Iterate through the time columns (up to 17 cols)
            for (let i = 0; i < shiftDefinitions.length; i++) {
                const colIndex = startCol + i;
                if (colIndex >= row.length) break;

                const cellValue = row[colIndex];
                if (!cellValue) continue;

                let valStr = String(cellValue).trim().toUpperCase();
                // Ignore "X" or empty or non-project codes
                if (valStr.length < 3 || valStr === 'X') continue;

                // --- NEW TIME PARSING LOGIC ---
                // Check if value has time in parenthesis e.g., "25-046-00(18:30)"
                // This means employee left at 18:30. We calculate duration vs shift start.
                let calculatedHours = shiftDefinitions[i].duration;
                const timeMatch = valStr.match(/^(.+?)\s*\((\d{1,2}):(\d{2})\)$/);

                if (timeMatch) {
                    valStr = timeMatch[1].trim(); // Extract project code part
                    const endHour = parseInt(timeMatch[2]);
                    const endMin = parseInt(timeMatch[3]);
                    
                    if (!isNaN(endHour) && !isNaN(endMin)) {
                        const endTimeDecimal = endHour + (endMin / 60);
                        const shiftStart = shiftDefinitions[i].start;
                        
                        // Calculate real duration
                        let realDuration = endTimeDecimal - shiftStart;
                        // Safety check for negative (e.g. crossing midnight not supported in this simple logic yet)
                        if (realDuration < 0) realDuration = 0;
                        
                        calculatedHours = realDuration;
                    }
                }

                // Find Project
                let project = projectMap.get(valStr) || projectInternalMap.get(valStr);
                
                // If not found directly, try fuzzy or create mismatch
                if (!project) {
                    mismatches.push({
                        rowIndex: r + 1,
                        type: 'project',
                        value: valStr,
                        originalProjectIdentifier: valStr,
                        employeeIdentifier: empId,
                        weekNum: getWeekNumber(reportStartDate!),
                        date: addDays(reportStartDate!, dayOffsets[i]).toISOString().split('T')[0],
                        hours: calculatedHours,
                        sheetName: 'Horas'
                    });
                    continue;
                }

                if (project.estatus === 'Terminado') {
                    mismatches.push({
                        rowIndex: r + 1,
                        type: 'project-finished',
                        value: project.nombre_proyecto,
                        originalProjectIdentifier: valStr,
                        sheetName: 'Horas'
                    });
                    continue;
                }

                const txDate = addDays(reportStartDate!, dayOffsets[i]);
                const hours = calculatedHours;

                // Check Costo Hora based on employee rate
                const rate = employee.costo_hora;

                transactions.push({
                    proyecto_id: project.proyecto_id!,
                    nombre_proyecto: project.nombre_proyecto,
                    empleado_id: employee.empleado_id,
                    nombre_completo_empleado: employee.nombre_completo,
                    fecha_registro: txDate.toISOString().split('T')[0],
                    semana_del_anio: getWeekNumber(txDate),
                    horas_registradas: hours,
                    costo_hora_real: rate,
                    costo_total_mo: hours * rate,
                    tipo_hora: 'Normal' // Default
                });

                // Summary
                details.projectSummary[project.nombre_proyecto] = (details.projectSummary[project.nombre_proyecto] || 0) + hours;
                details.employeeSummary[employee.nombre_completo] = (details.employeeSummary[employee.nombre_completo] || 0) + hours;
            }
        }

        return { success: true, message: "Parsed", transactions, mismatches, details };
    }
    
    async parseSaeReport(fileBuffer: ArrayBuffer) { return this._parseSaeReport(fileBuffer); }
    private async _parseSaeReport(fileBuffer: ArrayBuffer) {
        const workbook = XLSX.read(fileBuffer, { type: 'array' });
        const transactions: any[] = [];
        const mismatches: Mismatch[] = [];
        const details = { totalMaterialsCost: 0, count: 0, bySheet: {} as Record<string, number> };

        const projects = await this.getProjects();
        // Create maps for project lookup
        // We map SAE Project Code (nueva_sae) to Project ID
        // And Internal Code to Project ID
        const projectSaeMap = new Map(projects.map(p => [String(p.nueva_sae).trim().toUpperCase(), p]));
        const projectInternalMap = new Map(projects.map(p => [String(p.clave_interna).trim().toUpperCase(), p]));
        const projectNameMap = new Map(projects.map(p => [String(p.nombre_proyecto).trim().toUpperCase(), p]));

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
            
            if (rawData.length === 0) continue;

            // Find header row
            let headerRowIndex = -1;
            let colMap: Record<string, number> = {};

            // User provided specific columns: "Clave de artículo", "Descripción", "Fecha", "Costo", "Cantidad", "Proyecto", "Importe"
            
            for (let i = 0; i < Math.min(20, rawData.length); i++) {
                const row = rawData[i].map(c => String(c).trim().toUpperCase());
                // Check if row contains minimal required columns to identify it as the data table
                if (row.includes('CLAVE DE ARTÍCULO') || row.includes('CLAVE DE ARTICULO') || (row.includes('DESCRIPCION') && row.includes('CANTIDAD'))) {
                    headerRowIndex = i;
                    row.forEach((col, idx) => {
                        colMap[col] = idx;
                    });
                    break;
                }
            }

            if (headerRowIndex === -1) continue;

            // Helper to get value
            const getVal = (row: any[], keys: string[]) => {
                for (const key of keys) {
                    if (colMap[key] !== undefined) return row[colMap[key]];
                }
                return undefined;
            };

            for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                const row = rawData[i];
                // Skip empty rows
                if (!row || row.length === 0) continue;

                // Extract fields
                const partNumber = getVal(row, ['CLAVE DE ARTÍCULO', 'CLAVE DE ARTICULO', 'ARTICULO']);
                const description = getVal(row, ['DESCRIPCIÓN', 'DESCRIPCION']);
                const qty = getVal(row, ['CANTIDAD']);
                const cost = getVal(row, ['COSTO']);
                const amount = getVal(row, ['IMPORTE']); // Total cost
                const dateRaw = getVal(row, ['FECHA']);
                const projectCodeRaw = getVal(row, ['PROYECTO', 'REFERENCIA', 'CAMPO LIBRE 1']); 

                if (!partNumber && !description) continue; // Likely invalid row

                // Normalize Data
                const costVal = typeof cost === 'number' ? cost : parseFloat(String(cost || 0).replace(/[$,]/g, ''));
                const amountVal = typeof amount === 'number' ? amount : parseFloat(String(amount || 0).replace(/[$,]/g, ''));
                const qtyVal = typeof qty === 'number' ? qty : parseFloat(String(qty || 0).replace(/[$,]/g, ''));
                
                // If amount is missing but cost and qty exist, calculate it
                const finalTotal = (!isNaN(amountVal) && amountVal !== 0) ? amountVal : (qtyVal * costVal);

                if (finalTotal === 0 && qtyVal === 0) continue; 

                // Date Parsing
                let dateStr = '';
                if (typeof dateRaw === 'number') {
                     // Excel date
                     const d = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
                     dateStr = d.toISOString().split('T')[0];
                } else if (typeof dateRaw === 'string') {
                    // Try parsing DD/MM/YYYY
                    const parts = dateRaw.split('/');
                    if (parts.length === 3) {
                         // Assume DD/MM/YYYY
                         dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    } else {
                         // Try standard parse
                         const d = new Date(dateRaw);
                         if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
                    }
                }
                if (!dateStr) dateStr = new Date().toISOString().split('T')[0]; // Fallback

                // Project Matching
                let projectCode = String(projectCodeRaw || '').trim().toUpperCase();
                
                let project = projectSaeMap.get(projectCode) || projectInternalMap.get(projectCode) || projectNameMap.get(projectCode);

                if (!project && projectCode) {
                     // Try fuzzy or stripping 'PR-'
                     const stripped = projectCode.replace(/^PR-?/, '');
                     project = projectSaeMap.get(stripped) || projectInternalMap.get(stripped);
                }

                if (!project) {
                    if (projectCode) {
                        mismatches.push({
                            rowIndex: i + 1,
                            type: 'project',
                            value: projectCode,
                            originalProjectIdentifier: projectCode,
                            sheetName: sheetName,
                            amount: finalTotal,
                            date: dateStr
                        });
                    }
                    continue;
                }

                if (project.estatus === 'Terminado') {
                    mismatches.push({
                        rowIndex: i + 1,
                        type: 'project-finished',
                        value: project.nombre_proyecto,
                        originalProjectIdentifier: projectCode,
                        sheetName: sheetName
                    });
                    continue;
                }

                transactions.push({
                    proyecto_id: project.proyecto_id!,
                    nombre_proyecto: project.nombre_proyecto,
                    numero_parte_sae: String(partNumber),
                    descripcion_material: String(description),
                    cantidad: qtyVal,
                    costo_unitario: costVal,
                    costo_total_material: finalTotal,
                    fecha_movimiento_sae: dateStr,
                    origen_dato: sheetName
                });

                details.totalMaterialsCost += finalTotal;
                details.count++;
                details.bySheet[sheetName] = (details.bySheet[sheetName] || 0) + finalTotal;
            }
        }

        if (transactions.length === 0 && mismatches.length === 0) {
             return { success: false, message: "No se encontraron transacciones válidas o la estructura del archivo no coincide con las columnas esperadas (Clave de artículo, Descripción, Cantidad, Costo, Importe, Fecha, Proyecto).", transactions: [], mismatches: [], details };
        }

        return { success: true, message: `Procesado: ${transactions.length} registros encontrados.`, transactions, mismatches, details };
    }
    
    // Helper to find value in a row object by multiple possible keys (case-insensitive)
    // @ts-ignore
    private findRowValue(row: any, keys: string[]): any {
        if (!row) return undefined;
        for (const key of keys) { if (row[key] !== undefined) return row[key]; }
        const rowKeys = Object.keys(row);
        for (const key of keys) {
            const normalizedSearch = key.trim().toLowerCase();
            const foundKey = rowKeys.find(k => k.trim().toLowerCase() === normalizedSearch);
            if (foundKey) return row[foundKey];
        }
        return undefined;
    }

    async batchAddMaterialTransactions(transactions: any[]) { return this.batchAddSheetRows('materialTransactions', transactions, 'transaccion_id'); }
    async batchAddHourTransactions(transactions: any[]) { return this.batchAddSheetRows('hourTransactions', transactions, 'transaccion_id'); }
    async uploadPayrollHours(_content: string) { return { success: true, message: "Simulación" }; }
    async uploadSaeMaterials(_content: string) { return { success: true, message: "Deprecated" }; }

    async getProfitabilityReport(filters: { proyecto_id?: number }): Promise<ProfitabilityReport[]> {
        const [projects, hours, materials, costs] = await Promise.all([
            this.getProjects(),
            this.getHourTransactions(),
            this.getMaterialTransactions(),
            this.getAdditionalCosts()
        ]);

        let filteredProjects = projects.filter(p => !p.is_deleted);
        if (filters.proyecto_id) {
            filteredProjects = filteredProjects.filter(p => p.proyecto_id === filters.proyecto_id);
        }

        const report: ProfitabilityReport[] = filteredProjects.map(p => {
            const projectHours = hours.filter(h => String(h.proyecto_id) === String(p.proyecto_id));
            const projectMaterials = materials.filter(m => String(m.proyecto_id) === String(p.proyecto_id));
            const projectCosts = costs.filter(c => String(c.proyecto_id) === String(p.proyecto_id));

            const costo_total_mano_obra = projectHours.reduce((sum, h) => sum + (h.costo_total_mo || 0), 0);
            const costo_total_materiales = projectMaterials.reduce((sum, m) => sum + (m.costo_total_material || 0), 0);
            const costo_total_adicionales = projectCosts.reduce((sum, c) => sum + (c.monto || 0), 0);
            const costo_total_proyecto = costo_total_mano_obra + costo_total_materiales + costo_total_adicionales;
            
            // Calculate revenue parts (sum of defined prices)
            const monto_venta_pactado = (p.precio_fabricacion || 0) + (p.precio_instalacion || 0) + (p.precio_flete || 0) + (p.precio_servicios || 0);

            const margen_operativo = monto_venta_pactado - costo_total_proyecto;
            const porcentaje_margen = monto_venta_pactado !== 0 ? (margen_operativo / monto_venta_pactado) * 100 : 0;

            return {
                proyecto_id: p.proyecto_id!,
                nombre_proyecto: p.nombre_proyecto,
                nueva_sae: p.nueva_sae || '',
                precio_fabricacion: p.precio_fabricacion || 0,
                precio_instalacion: p.precio_instalacion || 0,
                precio_flete: p.precio_flete || 0,
                precio_servicios: p.precio_servicios || 0,
                ejercicio: new Date().getFullYear(), // Placeholder or derive from dates
                monto_venta_pactado,
                costo_total_mano_obra,
                costo_total_materiales,
                costo_total_adicionales,
                costo_total_proyecto,
                margen_operativo,
                porcentaje_margen,
                equipos_involucrados: [], // Populated below
                detalles_mano_obra: projectHours,
                detalles_materiales: projectMaterials,
                detalles_adicionales: projectCosts
            };
        });

        // Populate teams logic
        const employees = await this.getEmployees();
        const empTeamMap = new Map(employees.map(e => [e.empleado_id, e.equipo]));

        report.forEach(r => {
            const teamHours: Record<string, number> = {};
            r.detalles_mano_obra.forEach(h => {
                const team = empTeamMap.get(h.empleado_id) || 'Sin Equipo';
                teamHours[team] = (teamHours[team] || 0) + h.horas_registradas;
            });
            r.equipos_involucrados = Object.entries(teamHours).map(([equipo, horas]) => ({ equipo, horas }));
            
            // Derive exercise year from latest transaction
            const dates = [
                ...r.detalles_mano_obra.map(d => d.fecha_registro),
                ...r.detalles_materiales.map(d => d.fecha_movimiento_sae),
                ...r.detalles_adicionales.map(d => d.fecha)
            ].filter(d => d).sort();
            
            if (dates.length > 0) {
                 const lastDate = new Date(dates[dates.length - 1]);
                 r.ejercicio = lastDate.getFullYear();
            }
        });

        return report;
    }

    async getDeletedItems(): Promise<DeletedItem[]> {
        const [hours, materials, costs] = await Promise.all([
            this.getSheetData<HourTransaction>(this.sheetNames.hourTransactions, false),
            this.getSheetData<MaterialTransaction>(this.sheetNames.materialTransactions, false),
            this.getSheetData<AdditionalCost>(this.sheetNames.additionalCosts, false)
        ]);

        const [projects, employees] = await Promise.all([this.getProjects(), this.getEmployees()]);
        const projectMap = new Map(projects.map(p => [String(p.proyecto_id), p.nombre_proyecto]));
        const employeeMap = new Map(employees.map(e => [String(e.empleado_id), e.nombre_completo]));
        
        const logs = await this.getSheetData<LogEntry>(this.sheetNames.logs, false); // Get logs to find deletion info

        const getDeletionInfo = (id: number, type: string) => {
            const matchingLogs = logs.filter(l => Number(l.entity_id) === Number(id) && l.entity_type === type && l.action === 'DELETE');
            const latestLog = matchingLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
            
            return {
                deleted_by: latestLog ? latestLog.user_name : 'Desconocido',
                deleted_at: latestLog ? latestLog.timestamp : new Date().toISOString()
            };
        };

        const deletedHours = hours
            .filter(h => h.is_deleted)
            .map((h): DeletedItem => {
                const info = getDeletionInfo(h.transaccion_id, 'Hour');
                return {
                    ...h,
                    nombre_proyecto: projectMap.get(String(h.proyecto_id)) || 'Desconocido',
                    nombre_completo_empleado: employeeMap.get(String(h.empleado_id)) || 'Desconocido',
                    entity_type: 'Hour',
                    ...info
                };
            });

        const deletedMaterials = materials
            .filter(m => m.is_deleted)
            .map((m): DeletedItem => {
                const info = getDeletionInfo(m.transaccion_id, 'Material');
                return {
                    ...m,
                    nombre_proyecto: projectMap.get(String(m.proyecto_id)) || 'Desconocido',
                    entity_type: 'Material',
                    ...info
                };
            });

        const deletedCosts = costs
            .filter(c => c.is_deleted)
            .map((c): DeletedItem => {
                const info = getDeletionInfo(c.transaccion_id!, 'Cost');
                return {
                    ...c,
                    nombre_proyecto: projectMap.get(String(c.proyecto_id)) || 'Desconocido',
                    entity_type: 'Cost',
                    ...info
                };
            });

        // FIX: Cast spread objects to any to avoid TS2698 spread types from object types error
        // @ts-ignore
        return [...(deletedHours as any[]), ...(deletedMaterials as any[]), ...(deletedCosts as any[])];
    }

    async getLogsForEntity(entityId?: number, entityType?: string): Promise<LogEntry[]> {
        const rawLogs = await this.getSheetData<any>(this.sheetNames.logs, false);
        
        let logs = rawLogs.map(log => {
             let parsedChanges = [];
             if (log.changes) {
                 if (typeof log.changes === 'string') {
                    try {
                        parsedChanges = JSON.parse(log.changes);
                    } catch (e) { 
                        console.warn("Error parsing log changes", e); 
                    }
                 } else if (Array.isArray(log.changes)) {
                     parsedChanges = log.changes;
                 }
             }
             return { ...log, changes: parsedChanges } as LogEntry;
        });

        if (entityId !== undefined && entityType) {
            logs = logs.filter(l => Number(l.entity_id) === Number(entityId) && l.entity_type === entityType);
        }
        
        return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    
    private async restoreTransaction(sheetNameKey: keyof typeof this.sheetNames, id: number, idField: string, entityType: 'Hour' | 'Material' | 'Cost', userName: string) {
        // @ts-ignore
        const items = await this.getSheetData<any>(this.sheetNames[sheetNameKey], false);
        const item = items.find((i: any) => i[idField] === id);
        if (!item) throw new Error("Registro no encontrado.");
        
        await this.logChange(id, entityType, 'RESTORE', [], userName);
        return this.updateSheetRow(sheetNameKey, { ...item, is_deleted: false });
    }

    restoreHourTransaction(id: number, userName: string = 'Admin') { return this.restoreTransaction('hourTransactions', id, 'transaccion_id', 'Hour', userName); }
    restoreMaterialTransaction(id: number, userName: string = 'Admin') { return this.restoreTransaction('materialTransactions', id, 'transaccion_id', 'Material', userName); }
    restoreAdditionalCost(id: number, userName: string = 'Admin') { return this.restoreTransaction('additionalCosts', id, 'transaccion_id', 'Cost', userName); }

    async getFactorHistory(key: string): Promise<FactorOperativo[]> {
        const allConfigs = await this.getSheetData<FactorOperativo>('Configuracion');
        return allConfigs
            .filter(c => c.clave === key)
            .sort((a, b) => new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime());
    }

    async saveFactor(key: string, value: number, userName: string) {
        const factor: Omit<FactorOperativo, 'config_id' | '_row'> = {
            clave: key,
            valor: value,
            fecha_registro: new Date().toISOString(),
            usuario: userName
        };
        return this.addSheetRow('config', factor, 'config_id');
    }
    async saveOperatingFactor(value: number, userName: string) { return this.saveFactor('FACTOR_GASTOS_OP', value, userName); }
}

// Helper functions for Date math
function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export const apiService = new ApiService();
