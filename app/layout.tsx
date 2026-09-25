import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FLASH_COOKIE_NAME } from "@/lib/action-feedback";
import { AppNavbar } from "./components/AppNavbar";
import { FlashMessage } from "./components/FlashMessage";
import { NumberInputWheelGuard } from "./components/NumberInputWheelGuard";
import { SessionActivityRefresher } from "./components/SessionActivityRefresher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzas personales",
  description: "Webapp personal para control financiero"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const flash = (await cookies()).get(FLASH_COOKIE_NAME)?.value;

  return (
    <html lang="es">
      <body>
        <NumberInputWheelGuard />
        <SessionActivityRefresher />
        <AppNavbar />
        <FlashMessage cookieName={FLASH_COOKIE_NAME} value={flash} />
        {children}
      </body>
    </html>
  );
}
