
import React from 'react';
import { View } from '../types';
import { DashboardIcon, UploadIcon, CogIcon, ChartBarIcon, HistoryIcon, LogoutIcon, ClientLogo } from './icons/Icons';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
    currentView: View;
    setCurrentView: (view: View) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const NavLink: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center w-full px-4 py-3 text-sm font-medium transition-colors duration-200 rounded-lg ${
            isActive
                ? 'bg-sarp-blue text-white shadow-md'
                : 'text-gray-300 hover:bg-white/10 hover:text-white'
        }`}
    >
        <span className="mr-3">{icon}</span>
        {label}
    </button>
);

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isOpen, setIsOpen }) => {
    const { logout } = useAuth();

    const navItems = [
        { view: View.Dashboard, label: 'Dashboard', icon: <DashboardIcon size={5} /> },
        { view: View.Upload, label: 'Carga de Datos', icon: <UploadIcon size={5} /> },
        { view: View.Report, label: 'Reportes', icon: <ChartBarIcon size={5} /> },
        { view: View.History, label: 'Históricos', icon: <HistoryIcon size={5} /> },
        { view: View.Admin, label: 'Administración', icon: <CogIcon size={5} /> },
    ];

    return (
        <>
            {/* Overlay for mobile (only) */}
            <div
                onClick={() => setIsOpen(false)}
                className={`fixed inset-0 z-20 bg-black bg-opacity-75 transition-opacity md:hidden ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
            />

            <aside
                className={`fixed top-0 left-0 z-30 h-screen bg-sarp-dark-blue text-white flex flex-col transition-all duration-300 ease-in-out shadow-2xl border-r border-white/5 ${
                    isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full overflow-hidden'
                } md:relative md:translate-x-0 ${!isOpen && 'md:w-0'}`}
            >
                <div className="flex flex-col items-center justify-center pt-8 pb-6 px-4 border-b border-white/10 flex-shrink-0 overflow-hidden">
                    <div className="bg-white p-4 rounded-lg shadow-inner mb-3 w-[90%] flex justify-center items-center overflow-hidden min-h-[110px]">
                        <ClientLogo className="max-h-24 w-auto" />
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.2em]">Diseñarte S.A. de C.V.</p>
                    </div>
                </div>

                <nav className="flex-1 mt-6 px-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.view}
                            icon={item.icon}
                            label={item.label}
                            isActive={currentView === item.view}
                            onClick={() => setCurrentView(item.view)}
                        />
                    ))}
                </nav>

                <div className="p-4 mt-auto border-t border-white/10 bg-black/10">
                    <button
                        onClick={logout}
                        className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-300 hover:text-white hover:bg-red-50/20 rounded-lg transition-colors"
                    >
                        <span className="mr-3"><LogoutIcon size={5} /></span>
                        Cerrar Sesión
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
