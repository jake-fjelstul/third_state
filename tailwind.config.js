/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#6467F2',
          soft: '#EEF0FF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F5F5FB',
        },
      },
      borderRadius: {
        '3xl': '1.75rem',
        card: '1.5rem',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15,23,42,0.08)',
        'elevated': '0 18px 60px rgba(15,23,42,0.18)',
      },
    },
  },
  plugins: [],
}


