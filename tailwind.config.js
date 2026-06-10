/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cancha: "#0A3D2A",
        canchaclaro: "#10543B",
        cal: "#F3F0E6",
        oro: "#E8B53A",
        pizarra: "#10231B",
        tarjeta: "#C84B31"
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        marcador: ["var(--font-marcador)"]
      }
    }
  },
  plugins: []
};
