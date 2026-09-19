import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Lootly",
  description: "Онлайн-запись для сервисного бизнеса",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <nav>
          <strong>Lootly</strong>
          <span className="muted">Online Booking</span>
        </nav>
        {children}
      </body>
    </html>
  );
}
