
import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Upload from './components/Upload';
import Admin from './components/Admin';
import Report from './components/Report';
import History from './components/History';
import Login from './components/Login';
import DailyEntry from './components/DailyEntry';
import { View } from './types';
import { MenuIcon } from './components/icons/Icons';
import { apiService } from './services/api';
import Toast from './components/common/Toast';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const Header: React.FC<{ toggleSidebar: () => void; currentView: View; userName?: string }> = ({ toggleSidebar, currentView, userName }) => (
    <header className="bg-white shadow-sm sticky top-0 z-10 flex-shrink-0 border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center">
                <button 
                    onClick={toggleSidebar} 
                    className="p-2 -ml-2 text-gray-500 hover:text-sarp-blue hover:bg-gray-100 rounded-lg transition-all mr-4"
                    aria-label="Alternar menú"
                >
                    <MenuIcon />
                </button>
                <h1 className="text-xl font-bold text-sarp-dark-blue tracking-tight">{currentView}</h1>
            </div>
             <div className="flex flex-col items-end justify-center">
                <div className="flex items-center bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                    <span className="text-xs text-gray-500 mr-1.5 font-medium">Hola,</span>
                    <span className="text-sm font-bold text-sarp-dark-blue">{userName || 'Usuario'}</span>
                </div>
            </div>
        </div>
    </header>
);

const AppContent: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>(View.Dashboard);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true); // Por defecto abierto en escritorio
    const { user, isAuthenticated, isLoading } = useAuth();
    
    const handleSetCurrentView = useCallback((view: View) => {
        setCurrentView(view);
        // Opcional: Cerrar en móvil automáticamente al seleccionar vista
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    }, []);

    // Escuchar cambios de tamaño para ajustar sidebar automáticamente si es necesario
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };
        handleResize(); // Init
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sarp-blue mb-4"></div>
                <p className="text-gray-500 font-medium">Cargando sesión...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Login />;
    }

    const renderContent = () => {
        switch (currentView) {
            case View.Dashboard: 
                return <Dashboard setCurrentView={handleSetCurrentView} />;
            case View.DailyEntry:
                return <DailyEntry />;
            case View.Upload: 
                return <Upload />;
            case View.Admin: 
                return <Admin />;
            case View.Report: 
                return <Report />;
            case View.History: 
                return <History />;
            default: 
                return <Dashboard setCurrentView={handleSetCurrentView} />;
        }
    };

    return (
        <div className="relative min-h-screen bg-sarp-light-gray text-sarp-gray flex overflow-hidden">
            <Sidebar 
                currentView={currentView} 
                setCurrentView={handleSetCurrentView} 
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                <Header 
                    toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
                    currentView={currentView}
                    userName={user?.nombre}
                />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                    <div className="max-w-7xl mx-auto h-full">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

const AppInitializer: React.FC = () => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const { addToast } = useToast();

    useEffect(() => {
        const init = async () => {
            try {
                await apiService.initialize();
                setIsInitialized(true);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error("Initialization error:", error);
                setInitError(message);
                addToast(message, 'error');
            }
        };
        init();
    }, [addToast]);
    
    if (initError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-800 p-4">
                <div className="text-center bg-white p-8 rounded-lg shadow-lg max-w-lg">
                     <h2 className="text-2xl font-bold mb-4 text-red-600">Error de Conexión</h2>
                    <p className="text-base font-medium">{initError}</p>
                    <p className="mt-4 text-sm text-gray-600">Por favor verifique sus credenciales en <code>config.ts</code> y su conexión a internet.</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="mt-6 px-4 py-2 bg-sarp-blue text-white rounded hover:bg-sarp-dark-blue transition-colors shadow-md"
                    >
                        Reintentar Conexión
                    </button>
                </div>
            </div>
        );
    }

    if (!isInitialized) {
         return (
             <div className="min-h-screen flex items-center justify-center bg-sarp-light-gray flex-col">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sarp-blue mb-4"></div>
                 <p className="text-sarp-gray font-medium">Conectando con Google Sheets...</p>
                 <p className="text-xs text-gray-400 mt-2">Validando credenciales y permisos</p>
             </div>
        );
    }
    
    return <AppContent />;
}

const App: React.FC = () => (
    <ThemeProvider>
        <ToastProvider>
            <AuthProvider>
                <AppInitializer />
            </AuthProvider>
            <Toast />
        </ToastProvider>
    </ThemeProvider>
);

export default App;
