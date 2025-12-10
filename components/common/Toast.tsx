import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import { CloseIcon } from '../icons/Icons';

const Toast: React.FC = () => {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) {
        return null;
    }
    
    const getIcon = (type: string) => {
      switch (type) {
        case 'success': return <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
        case 'error': return <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
        case 'info': return <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
        default: return null;
      }
    };

    return (
        <div className="fixed bottom-0 right-0 p-4 space-y-2 z-50 w-full max-w-sm">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="bg-white shadow-lg rounded-lg p-4 flex items-start space-x-3 animate-fade-in-up"
                >
                    <div className="flex-shrink-0">
                      {getIcon(toast.type)}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{toast.message}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600">
                        <CloseIcon size={4}/>
                      </button>
                    </div>
                </div>
            ))}
            <style>{`
              @keyframes fade-in-up {
                0% {
                  opacity: 0;
                  transform: translateY(20px);
                }
                100% {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              .animate-fade-in-up {
                animation: fade-in-up 0.3s ease-out forwards;
              }
            `}</style>
        </div>
    );
};

export default Toast;
