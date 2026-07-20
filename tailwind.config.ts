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
        'w-blue': '#17BFD9',
        'w-pink': '#EC2C91', 
        'w-gray': '#D5D5D5',
        'w-light-gray': '#F3F3F3',
        'w-back-gray': '#F0F6FA',
        'w-light-blue': '#D0F2F7',
        'w-dark-gray': '#919191',
        'w-black': '#231E20',
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
    'bg-w-blue',
    'bg-w-pink', 
    'bg-w-gray',
    'bg-w-light-gray',
    'bg-w-back-gray',
    'bg-w-light-blue',
    'text-w-blue',
    'text-w-pink',
    'text-w-gray',
    'text-w-black',
    'border-w-blue',
    'hover:bg-w-blue',
  ],
} satisfies Config;
