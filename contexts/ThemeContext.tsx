import React, { createContext, useContext, useState, useEffect } from 'react';

export type FontFamily = 'Inter' | 'Roboto' | 'Open Sans' | 'Lato' | 'Montserrat';

interface ThemeContextType {
  fontFamily: FontFamily;
  setFontFamily: (font: FontFamily) => void;
  baseFontSize: number;
  setBaseFontSize: (size: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontFamily, setFontFamily] = useState<FontFamily>(() => {
    return (localStorage.getItem('sarp_font_family') as FontFamily) || 'Inter';
  });
  
  // Default base size 16px (100%)
  const [baseFontSize, setBaseFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('sarp_base_font_size');
    return saved ? parseInt(saved, 10) : 16;
  });

  useEffect(() => {
    localStorage.setItem('sarp_font_family', fontFamily);
    document.documentElement.style.setProperty('--font-primary', `"${fontFamily}", sans-serif`);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem('sarp_base_font_size', String(baseFontSize));
    // Update the root font size. Tailwind uses rem units, so changing html font-size scales everything.
    // 16px is standard (1rem = 16px). 
    // If user selects 18px, 1rem becomes 18px.
    document.documentElement.style.fontSize = `${baseFontSize}px`;
  }, [baseFontSize]);

  return (
    <ThemeContext.Provider value={{ fontFamily, setFontFamily, baseFontSize, setBaseFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
