/// <reference types="vite/client" />

// --- CONFIGURACIÓN SEGURA ---
// Las credenciales ahora se cargan desde el archivo .env (Variables de Entorno)
// Esto evita que se suban claves secretas a GitHub.

// IMPORTANTE: Vite realiza un reemplazo estático. Se debe acceder a las propiedades directamente.

export const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID || '';
export const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || '';
export const CLIENT_SECRET = import.meta.env.VITE_CLIENT_SECRET || '';
export const REFRESH_TOKEN = import.meta.env.VITE_REFRESH_TOKEN || '';

if (!SPREADSHEET_ID || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.error("Faltan variables de entorno. Verifique su archivo .env y asegúrese de que las variables comiencen con VITE_");
}
