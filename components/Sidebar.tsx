
import React from 'react';
import { View } from '../types';
import { DashboardIcon, UploadIcon, CogIcon, ChartBarIcon, HistoryIcon, LogoutIcon } from './icons/Icons';
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
                ? 'bg-sarp-blue text-white'
                : 'text-gray-300 hover:bg-white/20'
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
            {/* Overlay for mobile */}
            <div
                onClick={() => setIsOpen(false)}
                className={`fixed inset-0 z-20 bg-black bg-opacity-75 transition-opacity md:hidden ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
            />

            <aside
                className={`fixed top-0 left-0 z-30 h-screen w-64 bg-sarp-dark-blue text-white flex flex-col transition-transform transform md:relative md:translate-x-0 ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex items-center justify-center h-20 border-b border-gray-700 flex-shrink-0">
                    <h1 className="text-2xl font-bold text-white">S.A.R.P.</h1>
                </div>
                <nav className="flex-1 mt-4 px-2 space-y-1 overflow-y-auto">
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
                <div className="p-4 border-t border-gray-700">
                    <button
                        onClick={logout}
                        className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
