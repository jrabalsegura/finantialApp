import type { Metadata } from "next";
import { AppNavbar } from "./components/AppNavbar";
import { NumberInputWheelGuard } from "./components/NumberInputWheelGuard";
import { SessionActivityRefresher } from "./components/SessionActivityRefresher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzas personales",
  description: "Webapp personal para control financiero"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <NumberInputWheelGuard />
        <SessionActivityRefresher />
        <AppNavbar />
        {children}
      </body>
    </html>
  );
}
