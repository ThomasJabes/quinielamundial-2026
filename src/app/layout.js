import "./globals.css";

export const metadata = {
  title: "Quiniela Mundial 2026",
  description: "La quiniela del grupo — Mundial 2026"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;700&family=Chivo+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-cancha text-cal min-h-screen">{children}</body>
    </html>
  );
}
