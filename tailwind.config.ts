import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'wing-blue': '#17BFD9',
        'wing-pink': '#EC2C91', 
        'wing-gray': '#D5D5D5',
        'wing-light-gray': '#F3F3F3',
        'wing-back-gray': '#F0F6FA',
        'wing-light-blue': '#D0F2F7',
        'wing-dark-gray': '#919191',
        'wing-black': '#231E20',
      },
      fontFamily: {
        'montserrat': ['Montserrat', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-in': 'bounceIn 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
  safelist: [
    'bg-wing-blue',
    'bg-wing-pink', 
    'bg-wing-gray',
    'bg-wing-light-gray',
    'bg-wing-back-gray',
    'bg-wing-light-blue',
    'text-wing-blue',
    'text-wing-pink',
    'text-wing-gray',
    'text-wing-black',
    'border-wing-blue',
    'hover:bg-wing-blue',
  ],
} satisfies Config;
