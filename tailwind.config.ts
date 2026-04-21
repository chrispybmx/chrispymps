import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        orange:  '#ff6a00',
        black:   '#0a0a0a',
        bone:    '#f3ead8',
        coffee:  '#ffce4d',
        gray:    {
          800: '#1a1a1a',
          700: '#2a2a2a',
          600: '#3a3a3a',
          400: '#888888',
          200: '#cccccc',
        },
      },
      fontFamily: {
        mono:    ['VT323', 'monospace'],
        display: ['Barlow Condensed', 'sans-serif'],
        sans:    ['Barlow Condensed', 'sans-serif'],
      },
      fontSize: {
        'vhs-xs': ['12px', { lineHeight: '1.2', letterSpacing: '0.05em' }],
        'vhs-sm': ['14px', { lineHeight: '1.3', letterSpacing: '0.04em' }],
        'vhs-base': ['16px', { lineHeight: '1.4', letterSpacing: '0.03em' }],
        'vhs-lg': ['20px', { lineHeight: '1.3', letterSpacing: '0.02em' }],
        'vhs-xl': ['28px', { lineHeight: '1.2', letterSpacing: '0.01em' }],
        'vhs-2xl': ['40px', { lineHeight: '1.1', letterSpacing: '0em' }],
        'vhs-3xl': ['56px', { lineHeight: '1.0', letterSpacing: '-0.01em' }],
      },
      animation: {
        'glitch':      'glitch 2.5s infinite',
        'scanline':    'scanline 8s linear infinite',
        'flicker':     'flicker 4s infinite',
        'slide-up':    'slideUp 0.3s ease-out',
        'slide-down':  'slideDown 0.3s ease-out',
        'fade-in':     'fadeIn 0.2s ease-out',
        'spin-slow':   'spin 3s linear infinite',
      },
      keyframes: {
        glitch: {
          '0%, 100%':  { transform: 'translate(0)' },
          '10%':       { transform: 'translate(-2px, 1px)' },
          '20%':       { transform: 'translate(2px, -1px)' },
          '30%':       { transform: 'translate(-1px, 2px)' },
          '40%':       { transform: 'translate(1px, -2px)' },
          '50%':       { transform: 'translate(-2px, 0px)' },
          '60%':       { transform: 'translate(0, 0)' },
        },
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        flicker: {
          '0%, 95%, 100%': { opacity: '1' },
          '96%':            { opacity: '0.7' },
          '97%':            { opacity: '1' },
          '98%':            { opacity: '0.5' },
          '99%':            { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',      opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backgroundImage: {
        'noise': "url('/noise.svg')",
        'scanlines': 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
      },
      boxShadow: {
        'vhs':     '0 0 20px rgba(255, 106, 0, 0.3)',
        'vhs-lg':  '0 0 40px rgba(255, 106, 0, 0.4)',
        'vhs-pin': '2px 4px 12px rgba(0,0,0,0.6)',
      },
      rotate: {
        '-2': '-2deg',
        '2':  '2deg',
      },
      zIndex: {
        '60':  '60',
        '70':  '70',
        '80':  '80',
        '90':  '90',
        '100': '100',
      },
    },
  },
  plugins: [],
};

export default config;
