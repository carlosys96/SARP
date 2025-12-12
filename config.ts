// --- CONFIGURACIÓN DE CREDENCIALES ---
// Puedes colocar tus tokens de desarrollo aquí directamente si no estás usando un archivo .env
// O asegúrate de tener las variables VITE_ en tu archivo .env

// 1. Tokens de Desarrollo (Fallbacks)
// PEGA TUS TOKENS AQUÍ SI ESTÁS EN MODO DEV Y NO USAS .ENV
const DEV_SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'; // ID de Demo por defecto
const DEV_CLIENT_ID = ''; 
const DEV_CLIENT_SECRET = '';
const DEV_REFRESH_TOKEN = '';

// 2. Lógica de carga (Prioridad: Vite ENV -> Process ENV -> Hardcoded Dev Tokens)
const getEnv = (key: string, devValue: string) => {
    let value = devValue;
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
            return import.meta.env[key];
        }
    } catch (e) {}
    
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key];
        }
    } catch (e) {}

    return value;
};

export const SPREADSHEET_ID = getEnv('VITE_SPREADSHEET_ID', DEV_SPREADSHEET_ID);
export const CLIENT_ID = getEnv('VITE_CLIENT_ID', DEV_CLIENT_ID);
export const CLIENT_SECRET = getEnv('VITE_CLIENT_SECRET', DEV_CLIENT_SECRET);
export const REFRESH_TOKEN = getEnv('VITE_REFRESH_TOKEN', DEV_REFRESH_TOKEN);

export const IS_CONFIGURED = !!(SPREADSHEET_ID && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
