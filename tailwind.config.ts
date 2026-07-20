import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          50: '#ECF4EE',
          100: '#D5E8DA',
          200: '#ABD0B4',
          // Vert « porte de riad » (icône Darna). 500 = 6.38:1 sur blanc,
          // 6.11:1 sur bg-page — WCAG 2 AA (≥4.5:1) pour texte blanc sur
          // bouton accent ET liens accent sur fond clair.
          500: '#3B6944',
          600: '#305A38',
          700: '#274C2E',
          900: '#1F3823',
        },
        bg: {
          page: '#FBFAF6',
          card: '#FFFFFF',
          soft: '#F4F2EC',
        },
        neutral: {
          300: '#C8C2B5',
          // 5.02:1 sur bg-page, 4.68:1 sur bg-soft (placeholders) — AA.
          400: '#716C5D',
          500: '#6E6A5C',
          700: '#38362E',
          900: '#1A1812',
        },
        success: '#5B9C66',
        warning: '#D4A24A',
        danger: '#D45B4A',
        info: '#4A82A8',
        gauge: {
          depannage: '#4A82A8',
          'petits-travaux': '#5B9C66',
          'travail-soigne': '#CB7B2A',
          urgences: '#D45B4A',
          track: '#ECEAE2',
        },
      },
      borderRadius: {
        sm: '10px',
        DEFAULT: '14px',
        lg: '20px',
      },
      boxShadow: {
        xs: '0 1px 1px rgba(20, 18, 14, 0.025)',
        sm: '0 2px 6px rgba(20, 18, 14, 0.04)',
        DEFAULT: '0 6px 18px rgba(20, 18, 14, 0.06)',
      },
      fontFamily: {
        sans: ['Inter Variable', 'system-ui', 'sans-serif'],
      },
      minHeight: {
        touch: '48px',
        'touch-lg': '56px',
      },
      minWidth: {
        touch: '48px',
      },
    },
  },
  plugins: [],
} satisfies Config;
