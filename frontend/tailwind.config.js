/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'line-1': 'line1 2s ease-in-out infinite',
        'line-2': 'line2 2s ease-in-out infinite',
        'line-3': 'line3 2s ease-in-out infinite',
        'line-4': 'line4 2s ease-in-out infinite',
        'line-5': 'line5 2s ease-in-out infinite',
        'line-6': 'line6 2s ease-in-out infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'shine': 'shine 2s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        line1: {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(2px)' },
        },
        line2: {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(-2px)' },
        },
        line3: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(2px)' },
        },
        line4: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        line5: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        line6: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.8)' },
        },
        shine: {
          '0%': { transform: 'translateX(-100%) skewX(-12deg)' },
          '100%': { transform: 'translateX(200%) skewX(-12deg)' },
        },
      },
    },
  },
  plugins: [],
}
