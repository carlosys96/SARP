/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Archivo', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        canvas:    'oklch(97.4% 0.005 60)',
        surface:   'oklch(99.6% 0.003 60)',
        surface2:  'oklch(96.2% 0.006 58)',
        ink:       'oklch(20% 0.012 40)',
        ink2:      'oklch(43% 0.010 45)',
        ink3:      'oklch(60% 0.008 50)',
        line:      'oklch(90.5% 0.006 55)',
        line2:     'oklch(84% 0.008 50)',
        brand:     'oklch(50% 0.175 28)',
        brandDeep: 'oklch(41% 0.155 28)',
        brandSoft: 'oklch(95.5% 0.028 30)',
        amber:     'oklch(58% 0.125 70)',
        amberSoft: 'oklch(95.5% 0.045 82)',
        amberLine: 'oklch(84% 0.09 80)',
        green:     'oklch(48% 0.095 155)',
        greenSoft: 'oklch(95.5% 0.035 155)',
        steel:     'oklch(46% 0.028 255)',
        steelSoft: 'oklch(95.5% 0.014 255)',
        // Compatibilidad con vistas existentes
        'sarp-blue': '#0077B6',
        'sarp-red': '#FF6B6B',
        'sarp-yellow': '#FFD166',
        'sarp-gray': '#495057',
        'sarp-light-gray': '#f7fafc',
        'sarp-dark-blue': '#023047',
      },
      transitionTimingFunction: {
        'exponential': 'cubic-bezier(0.25, 1, 0.5, 1)',
      }
    },
  },
  plugins: [],
};
