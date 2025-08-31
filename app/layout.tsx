// app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";

export const metadata = {
  title: "Airpark Live",
  description: "UAV collision-avoidance lab in your browser",
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0b0e14] text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
