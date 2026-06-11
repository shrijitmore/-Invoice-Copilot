import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#627d98',
          500: '#486581',
          600: '#334e68',
          700: '#1e3a5f',
          800: '#16304f',
          900: '#102a43',
        },
        surface: {
          light: '#f8fafc',
          dark: '#0b1929',
        },
      },
      fontSize: {
        base: ['1rem', { lineHeight: '1.6' }],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.5' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'bounce-dot': 'bounce-dot 1.2s infinite ease-in-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
