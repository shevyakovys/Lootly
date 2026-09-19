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
          <strong><a href="/">Lootly</a></strong>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="/dashboard">Журнал</a>
            <a href="/catalog">Справочники</a>
            <a href="/schedule">Расписание</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
