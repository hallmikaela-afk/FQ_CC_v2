import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'fq-dark': '#2C2420',
        'fq-accent': '#8B6F4E',
        'fq-alert': '#A0522D',
        'fq-success': '#6B7F5E',
        'fq-bg': '#F8F5F1',
        'fq-border': '#E8E0D8',
        'fq-card': '#FFFFFF',
        'fq-muted': '#9B8E82',
        'fq-light-accent': '#F0EAE2',
        'fq-sage': '#7B8F6B',
        'fq-sage-light': '#EDF2E8',
        'fq-rose': '#B5727A',
        'fq-rose-light': '#F5E8EA',
        'fq-blue': '#6B89A8',
        'fq-blue-light': '#E8EFF5',
        'fq-plum': '#8B7198',
        'fq-plum-light': '#F0E8F2',
        'fq-amber': '#C49B40',
        'fq-amber-light': '#F8F0D8',
        'fq-teal': '#5E9B95',
        'fq-teal-light': '#E5F2F0',
      },
      fontFamily: {
        heading: ['Cormorant Garamond', 'serif'],
        body: ['Optima', 'Candara', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
