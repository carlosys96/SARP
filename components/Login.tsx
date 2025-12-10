
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ClientLogo, LockIcon, UserIcon } from './icons/Icons';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        
        setIsSubmitting(true);
        try {
            await login(email, password);
        } catch (error) {
            // Error handled in context/toast
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-2xl">
                <div className="text-center">
                    <div className="mx-auto h-16 w-auto flex justify-center items-center mb-6">
                         {/* Logo placeholder or icon */}
                         <div className="bg-sarp-dark-blue p-3 rounded-lg">
                            <h1 className="text-2xl font-bold text-white tracking-widest">S.A.R.P.</h1>
                         </div>
                    </div>
                    <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
                        Iniciar Sesión
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Acceda al sistema de análisis de rentabilidad
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="relative mb-4">
                            <label htmlFor="email-address" className="sr-only">Correo Electrónico</label>
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <UserIcon className="h-5 w-5" />
                            </div>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="appearance-none rounded-lg relative block w-full px-3 py-3 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-sarp-blue focus:border-sarp-blue focus:z-10 sm:text-sm"
                                placeholder="Correo electrónico"
                            />
                        </div>
                        <div className="relative">
                            <label htmlFor="password" className="sr-only">Contraseña</label>
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <LockIcon className="h-5 w-5" />
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none rounded-lg relative block w-full px-3 py-3 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-sarp-blue focus:border-sarp-blue focus:z-10 sm:text-sm"
                                placeholder="Contraseña"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-sarp-dark-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sarp-blue disabled:bg-gray-400 transition-colors"
                        >
                            {isSubmitting ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : 'Entrar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
