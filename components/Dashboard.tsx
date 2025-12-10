
import React from 'react';
import { View } from '../types';
import { UploadIcon, CogIcon, ChartBarIcon, ArrowRightIcon, HistoryIcon } from './icons/Icons';


interface DashboardProps {
    setCurrentView: (view: View) => void;
}

const FeatureCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
}> = ({ title, description, icon, onClick }) => (
    <div 
        onClick={onClick}
        className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col"
    >
        <div className="flex-shrink-0 text-sarp-blue">{icon}</div>
        <div className="flex-grow mt-4">
            <h3 className="text-xl font-semibold text-sarp-gray">{title}</h3>
            <p className="mt-2 text-gray-500">{description}</p>
        </div>
        <div className="mt-4 flex items-center text-sarp-blue font-semibold">
            <span>Ir ahora</span>
            <ArrowRightIcon />
        </div>
    </div>
);

const Dashboard: React.FC<DashboardProps> = ({ setCurrentView }) => {
    return (
        <div>
            <h1 className="text-3xl font-bold text-sarp-gray mb-6">Bienvenido a S.A.R.P.</h1>
            <p className="text-lg text-gray-600 mb-8">Seleccione una de las siguientes opciones para comenzar a gestionar y analizar la rentabilidad de sus proyectos.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <FeatureCard
                    title="Carga de Datos"
                    description="Suba los reportes de planta, nómina y SAE para registrar horas y materiales en los proyectos."
                    icon={<UploadIcon size={8} />}
                    onClick={() => setCurrentView(View.Upload)}
                />
                
                <FeatureCard
                    title="Reportes de Rentabilidad"
                    description="Analice los costos, ventas y márgenes de cada proyecto con filtros personalizados."
                    icon={<ChartBarIcon size={8} />}
                    onClick={() => setCurrentView(View.Report)}
                />

                <FeatureCard
                    title="Históricos"
                    description="Consulte el detalle de horas, materiales y costos adicionales registrados en los proyectos."
                    icon={<HistoryIcon size={8} />}
                    onClick={() => setCurrentView(View.History)}
                />

                <FeatureCard
                    title="Administración"
                    description="Gestione los catálogos de proyectos, empleados y usuarios del sistema."
                    icon={<CogIcon size={8} />}
                    onClick={() => setCurrentView(View.Admin)}
                />
            </div>
        </div>
    );
};

export default Dashboard;
