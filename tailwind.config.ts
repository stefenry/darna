import type { Config } from 'tailwindcss';

// Les couleurs sont des variables CSS (app/globals.css) : un seul jeu de classes
// sert le thème clair et le thème sombre. Format « R G B » pour garder les
// modificateurs d'opacité Tailwind (`bg-danger/10`).
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // `accent` = couleur d'ACTION (encre en clair, lime en sombre), jamais
        // décorative. Le texte posé dessus est `on-accent`. Les liens utilisent
        // `link`. 50/100/200 sont les anciens aplats pâles, ramenés au neutre.
        accent: {
          DEFAULT: v('soft'), // shadcn : survol des items de menu
          foreground: v('text'),
          50: v('soft'),
          100: v('soft'),
          200: v('border'),
          500: v('primary'),
          600: v('primary-hover'),
          700: v('primary-hover'),
          900: v('primary-hover'),
        },
        'on-accent': v('on-primary'),
        link: { DEFAULT: v('link'), hover: v('link-hover') },
        bg: {
          page: v('bg'),
          card: v('surface'),
          soft: v('soft'),
        },
        neutral: {
          100: v('soft'),
          200: v('border'),
          300: v('border-strong'),
          400: v('muted'),
          500: v('muted'),
          600: v('text-2'),
          700: v('text-2'),
          800: v('text'),
          900: v('text'),
        },
        success: v('success'),
        warning: v('warning'),
        'on-warning': v('on-warning'),
        danger: v('danger'),
        'on-danger': v('on-danger'),
        info: v('info'),
        // Jauges monochromes : la longueur et le chiffre portent l'information,
        // plus une teinte par axe. Les 4 clés restent pour ne pas toucher aux
        // composants.
        gauge: {
          depannage: v('text'),
          'petits-travaux': v('text'),
          'travail-soigne': v('text'),
          urgences: v('text'),
          track: v('soft'),
        },
        // Tokens shadcn (components/ui) — jamais définis jusqu'ici.
        background: v('bg'),
        foreground: v('text'),
        primary: { DEFAULT: v('primary'), foreground: v('on-primary') },
        secondary: { DEFAULT: v('soft'), foreground: v('text') },
        destructive: { DEFAULT: v('danger'), foreground: v('on-danger') },
        muted: { DEFAULT: v('soft'), foreground: v('muted') },
        popover: { DEFAULT: v('surface'), foreground: v('text') },
        input: v('border-strong'),
        ring: v('primary'),
      },
      borderColor: {
        DEFAULT: v('border'),
      },
      borderRadius: {
        sm: '10px',
        DEFAULT: '16px',
        lg: '20px',
      },
      // Design bordé : les anciennes ombres de carte deviennent un filet de 1 px,
      // ce qui borde toutes les cartes `shadow-xs` sans toucher aux composants.
      boxShadow: {
        xs: '0 0 0 1px rgb(var(--border))',
        sm: '0 0 0 1px rgb(var(--border))',
        DEFAULT: '0 0 0 1px rgb(var(--border)), 0 8px 24px rgb(0 0 0 / 0.12)',
      },
      fontFamily: {
        sans: ['Schibsted Grotesk Variable', 'Inter Variable', 'system-ui', 'sans-serif'],
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
