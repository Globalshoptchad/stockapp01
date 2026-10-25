import "./globals.css";
import Providers from "../components/Providers";

export const metadata = {
  title: "Mon Stock",
  description: "Gère ton stock et tes ventes simplement",
  manifest: "/manifest.json",
  applicationName: "Mon Stock",
  // Réglages iPhone : l'app s'ouvre en plein écran depuis l'écran d'accueil
  appleWebApp: {
    capable: true,
    title: "Mon Stock",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f766e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
