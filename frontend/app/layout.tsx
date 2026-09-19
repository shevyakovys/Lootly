import "./globals.css";
import Link from "next/link";
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
          <strong><Link href="/">Lootly</Link></strong>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/dashboard">Журнал</Link>
            <Link href="/catalog">Справочники</Link>
            <Link href="/schedule">Расписание</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
