/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        premium: {
          bg: '#e4e7eb',
          card: '#ffffff',
          dark: '#1e272e',
          accent: '#3742fa',
          success: '#2ed573',
          danger: '#ff4757',
          warning: '#ffa502',
          purple: '#8e44ad',
        }
      }
    },
  },
  plugins: [],
}
