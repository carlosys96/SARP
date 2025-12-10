
import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiService } from '../services/api';
import type { Usuario } from '../types';
import { useToast } from './ToastContext';

interface AuthContextType {
    user: Usuario | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<Usuario | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        const initSession = async () => {
            const storedUserStr = localStorage.getItem('sarp_user');
            if (storedUserStr) {
                try {
                    const storedUser = JSON.parse(storedUserStr);
                    // 1. Set optimistic state to show UI immediately
                    setUser(storedUser);
                    
                    // 2. Validate and Refresh against API (Critical for permissions updates)
                    try {
                        const users = await apiService.getUsers();
                        const freshUser = users.find(u => u.usuario_id === storedUser.usuario_id);
                        
                        if (freshUser && !freshUser.is_deleted) {
                            // Update state and storage with fresh data including new permissions
                            setUser(freshUser);
                            localStorage.setItem('sarp_user', JSON.stringify(freshUser));
                        } else {
                            // User was deleted or not found remotely, logout
                            console.warn("User no longer valid, logging out.");
                            setUser(null);
                            localStorage.removeItem('sarp_user');
                        }
                    } catch (apiError) {
                        console.warn("Could not verify session with API (Offline?), using stored credentials.", apiError);
                    }
                } catch (e) {
                    console.error("Error parsing stored user", e);
                    localStorage.removeItem('sarp_user');
                }
            }
            setIsLoading(false);
        };

        initSession();
    }, []);

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const users = await apiService.getUsers();
            
            const foundUser = users.find(u => 
                u.email.toLowerCase().trim() === email.toLowerCase().trim() && 
                u.password === password
            );

            if (foundUser && !foundUser.is_deleted) {
                setUser(foundUser);
                localStorage.setItem('sarp_user', JSON.stringify(foundUser));
                addToast(`Bienvenido, ${foundUser.nombre}`, 'success');
            } else {
                throw new Error("Credenciales incorrectas o usuario inactivo.");
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error al iniciar sesión";
            addToast(msg, 'error');
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('sarp_user');
        // addToast('Sesión cerrada correctamente', 'info');
    };

    const refreshSession = async () => {
        if (!user) return;
        try {
            const users = await apiService.getUsers();
            const freshUser = users.find(u => u.usuario_id === user.usuario_id);
            if (freshUser && !freshUser.is_deleted) {
                setUser(freshUser);
                localStorage.setItem('sarp_user', JSON.stringify(freshUser));
            }
        } catch (error) {
            console.error("Error refreshing session:", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, refreshSession }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
