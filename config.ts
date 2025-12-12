/// <reference types="vite/client" />

// --- CONFIGURACIÓN DE CREDENCIALES ---

// 1. Tokens de Desarrollo (Fallbacks)
// PEGA TUS TOKENS AQUÍ SI ESTÁS EN MODO DEV Y NO USAS .ENV
const DEV_SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'; 
const DEV_CLIENT_ID = ''; 
const DEV_CLIENT_SECRET = '';
const DEV_REFRESH_TOKEN = '';

// Declaración para evitar errores de TS
declare const process: any;
declare const window: any;

// 2. Lógica de carga (Prioridad: Runtime Window ENV -> Vite ENV -> Process ENV -> Hardcoded)
const getEnv = (key: string, devValue: string) => {
    // 1. Runtime Injection (Docker/Nginx via env-config.js)
    if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
        return window.__ENV__[key];
    }

    // 2. Vite Build Time Replacement
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
            return import.meta.env[key];
        }
    } catch (e) {}
    
    // 3. Process Env (Legacy/Node)
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key];
        }
    } catch (e) {}

    // 4. Fallback Hardcoded
    return devValue;
};

export const SPREADSHEET_ID = getEnv('VITE_SPREADSHEET_ID', DEV_SPREADSHEET_ID);
export const CLIENT_ID = getEnv('VITE_CLIENT_ID', DEV_CLIENT_ID);
export const CLIENT_SECRET = getEnv('VITE_CLIENT_SECRET', DEV_CLIENT_SECRET);
export const REFRESH_TOKEN = getEnv('VITE_REFRESH_TOKEN', DEV_REFRESH_TOKEN);

export const IS_CONFIGURED = !!(SPREADSHEET_ID && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);