
// ... (Imports stay the same)
import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Upload from './components/Upload';
import Admin from './components/Admin';
import Report from './components/Report';
import History from './components/History';
import Login from './components/Login';
import { View } from './types';
import { MenuIcon } from './components/icons/Icons';
import { apiService } from './services/api';
import Toast from './components/common/Toast';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const Header: React.FC<{ toggleSidebar: () => void; currentView: View; userName?: string }> = ({ toggleSidebar, currentView, userName }) => (
    <header className="bg-white shadow-sm sticky top-0 z-10 flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center">
                <button onClick={toggleSidebar} className="text-sarp-gray md:hidden mr-4">
                    <MenuIcon />
                </button>
                <h1 className="text-xl font-semibold text-sarp-gray">{currentView}</h1>
            </div>
             <div className="flex flex-col items-end justify-center">
                <div className="flex items-center">
                    <span className="text-sm text-gray-600 mr-2">Hola,</span>
                    <span className="text-sm font-bold text-sarp-dark-blue">{userName || 'Usuario'}</span>
                </div>
            </div>
        </div>
    </header>
);

const AppContent: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>(View.Dashboard);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
    const { user, isAuthenticated, isLoading } = useAuth();
    
    const handleSetCurrentView = useCallback((view: View) => {
        setCurrentView(view);
        setIsSidebarOpen(false);
    }, []);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-100">Cargando...</div>;
    }

    if (!isAuthenticated) {
        return <Login />;
    }

    const renderContent = () => {
        switch (currentView) {
            case View.Dashboard: 
                return <Dashboard setCurrentView={handleSetCurrentView} />;
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
        <div className="relative min-h-screen bg-sarp-light-gray text-sarp-gray md:flex">
            <Sidebar 
                currentView={currentView} 
                setCurrentView={handleSetCurrentView} 
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />
            <div className="flex-1 flex flex-col max-h-screen overflow-y-hidden">
                <Header 
                    toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
                    currentView={currentView}
                    userName={user?.nombre}
                />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                    {renderContent()}
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

