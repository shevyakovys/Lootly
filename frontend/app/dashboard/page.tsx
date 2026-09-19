"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

type Me = { organization_id: string; email: string; role: string };
type Analytics = {
  bookings_created: number;
  public_bookings: number;
  completed: number;
  canceled: number;
  no_show: number;
  online_booking_conversion: number;
  staff_utilization: number;
  cancellation_rate: number;
  no_show_rate: number;
  average_lead_time_hours: number;
  repeat_customer_rate: number;
  notification_delivery_rate: number;
};
type Appointment = {
  id: string;
  start_at: string;
  status: string;
  price: string;
  booking_source: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("lootly_token");
    if (!token) {
      router.push("/login");
      return;
    }
    void (async () => {
      try {
        const user = await api<Me>("/auth/me", {}, token);
        setMe(user);
        const [stats, rows] = await Promise.all([
          api<Analytics>("/analytics/overview", {}, token),
          api<Appointment[]>(
            `/appointments?organization_id=${user.organization_id}&limit=50`,
            {},
            token,
          ),
        ]);
        setAnalytics(stats);
        setAppointments(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
  }, [router]);

  async function setStatus(id: string, status: string) {
    const token = localStorage.getItem("lootly_token");
    if (!token) return;
    const updated = await api<Appointment>(
      `/appointments/${id}/status`,
      {
        method: "POST",
        body: JSON.stringify({ status }),
      },
      token,
    );
    setAppointments((rows) => rows.map((row) => row.id === id ? updated : row));
  }

  return (
    <main>
      <h1>Панель управления</h1>
      {me && <p className="muted">{me.email} · {me.role}</p>}
      {error && <div className="card">{error}</div>}
      {analytics && (
        <div className="grid">
          <div className="card"><span className="muted">Записи</span><div className="metric">{analytics.bookings_created}</div></div>
          <div className="card"><span className="muted">Онлайн</span><div className="metric">{analytics.public_bookings}</div></div>
          <div className="card"><span className="muted">Завершено</span><div className="metric">{analytics.completed}</div></div>
          <div className="card"><span className="muted">Отмены</span><div className="metric">{Math.round(analytics.cancellation_rate * 100)}%</div></div>
          <div className="card"><span className="muted">Конверсия online</span><div className="metric">{Math.round(analytics.online_booking_conversion * 100)}%</div></div>
          <div className="card"><span className="muted">Загрузка команды</span><div className="metric">{Math.round(analytics.staff_utilization * 100)}%</div></div>
        </div>
      )}
      <h2>Журнал записей</h2>
      <div className="card list">
        {appointments.length === 0 && <span className="muted">Записей пока нет</span>}
        {appointments.map((item) => (
          <div className="row" key={item.id}>
            <span>{new Date(item.start_at).toLocaleString("ru-RU")}</span>
            <span>{item.status}</span>
            <span>{item.price}</span>
            <span>{item.booking_source}</span>
            {["booked", "confirmed"].includes(item.status) && (
              <span style={{ display: "flex", gap: 6 }}>
                {item.status === "booked" && <button onClick={() => void setStatus(item.id, "confirmed")}>Подтвердить</button>}
                <button onClick={() => void setStatus(item.id, "completed")}>Завершить</button>
                <button className="secondary" onClick={() => void setStatus(item.id, "canceled")}>Отменить</button>
              </span>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
