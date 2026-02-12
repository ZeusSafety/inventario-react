import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { InventoryProvider } from "@/context/InventoryContext";
import SidebarWrapper from "@/components/SidebarWrapper";
import FeedbackContainer from "@/components/FeedbackContainer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins"
});

export const metadata: Metadata = {
  title: "Inventario Zeus Safety - Dashboard",
  description: "Sistema de gestión de inventario para Zeus Safety",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} antialiased flex min-h-screen`} suppressHydrationWarning>
        <InventoryProvider>
          <SidebarWrapper>
            {children}
          </SidebarWrapper>
          <FeedbackContainer />
        </InventoryProvider>
      </body>
    </html>
  );
}
