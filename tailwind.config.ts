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
      },
      fontFamily: {
        heading: ['Cormorant Garamond', 'serif'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
