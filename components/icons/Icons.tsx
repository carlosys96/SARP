
import React from 'react';

type IconProps = {
    size?: number;
    className?: string;
};

const defaultSize = 6;

export const MenuIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
);

export const UploadIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

export const CogIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V12M12 12V4M12 12H20M12 12H4M12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

export const ChartBarIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10M18 20V4M6 20V16" />
    </svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ size = 6, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
);

export const DashboardIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
);


export const LogoutIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
);

export const UserIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
);

export const LockIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
);

export const ClientLogo: React.FC<{ className?: string }> = ({ className }) => (
    <img 
        src="/logo_disenarte.png" 
        alt="Diseñarte Logo" 
        className={`${className} object-contain`} 
        style={{ maxWidth: '100%', height: 'auto' }}
        onError={(e) => {
            // Fallback en caso de que la imagen no exista aún
            e.currentTarget.style.display = 'none';
            console.warn("No se encontró el archivo /logo_disenarte.png");
        }}
    />
);

export const HistoryIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
);

export const EditIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export const LogbookIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
    </svg>
);

export const RestoreIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"></polyline>
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
  </svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ size = 5, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

export const MoonIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

export const MapPinIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

export const SaveIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </svg>
);

export const AlertCircleIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ size = defaultSize, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size * 4} height={size * 4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);
