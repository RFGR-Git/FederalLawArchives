    /** @type {import('tailwindcss').Config} */
    module.exports = {
      content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html",
      ],
      theme: {
        extend: {
          fontFamily: {
            inter: ['Inter', 'sans-serif'],
            'pt-serif': ['"PT Serif"', 'serif'],
            roboto: ['Roboto', 'sans-serif'],
          },
          colors: {
            'primary-dark-blue': '#002856',
            'accent-red': '#b41f1f',
            'light-background': '#f2f2f2',
            'white-card': '#ffffff',
            'secondary-grey': '#d9d9d9',
            'dark-text': '#343a40',
            'gold-accent': '#c9a335',
            'dark-background': '#1a1a2e',
            'dark-card': '#2a2a4a',
            'text-dark': '#e0e0e0',
            'text-secondary-dark': '#b0b0b0',
            'border-dark': '#4a4a6e',
            'input-bg-dark': '#3a3a5e',
            'input-border-dark': '#5a5a7e',
            'placeholder-dark': '#8080a0',
          },
        },
      },
      plugins: [],
    }
    