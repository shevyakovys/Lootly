"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

type Me = { role: string };
type Staff = { id: string; name: string };
type Hours = { id: string; weekday: number; start_time: string; end_time: string };
type TimeOff = { id: string; start_at: string; end_at: string; reason?: string | null };

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function SchedulePage() {
  const [token, setToken] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffId, setStaffId] = useState("");
  const [hours, setHours] = useState<Hours[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [message, setMessage] = useState("");

  const loadSchedule = useCallback(async (accessToken: string, id: string) => {
    if (!id) return;
    const [hoursRows, offRows] = await Promise.all([
      api<Hours[]>(`/catalog/staff/${id}/working-hours`, {}, accessToken),
      api<TimeOff[]>(`/catalog/staff/${id}/time-off`, {}, accessToken),
    ]);
    setHours(hoursRows);
    setTimeOff(offRows);
  }, []);

  useEffect(() => {
    const accessToken = localStorage.getItem("lootly_token") ?? "";
    if (!accessToken) {
      window.location.href = "/login";
      return;
    }
    setToken(accessToken);
    void Promise.all([
      api<Me>("/auth/me", {}, accessToken),
      api<Staff[]>("/catalog/staff", {}, accessToken),
    ]).then(([user, rows]) => {
      setMe(user);
      setStaff(rows);
      if (rows[0]) {
        setStaffId(rows[0].id);
        void loadSchedule(accessToken, rows[0].id);
      }
    }).catch((err) => setMessage(err instanceof Error ? err.message : "Ошибка"));
  }, [loadSchedule]);

  async function addHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/working-hours", {
      method: "POST",
      body: JSON.stringify({
        staff_id: staffId,
        weekday: Number(form.get("weekday")),
        start_time: form.get("start_time"),
        end_time: form.get("end_time"),
      }),
    }, token);
    await loadSchedule(token, staffId);
  }

  async function addTimeOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = String(form.get("start_at"));
    const end = String(form.get("end_at"));
    await api("/time-off", {
      method: "POST",
      body: JSON.stringify({
        staff_id: staffId,
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        reason: form.get("reason") || null,
      }),
    }, token);
    await loadSchedule(token, staffId);
  }

  async function remove(kind: "working-hours" | "time-off", id: string) {
    await api(`/catalog/${kind}/${id}`, { method: "DELETE" }, token);
    await loadSchedule(token, staffId);
  }

  const manager = me?.role === "owner" || me?.role === "admin";

  return (
    <main>
      <h1>Расписание</h1>
      {message && <p>{message}</p>}
      <label>Сотрудник
        <select value={staffId} onChange={(e) => { setStaffId(e.target.value); void loadSchedule(token, e.target.value); }}>
          {staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>

      {manager && staffId && (
        <div className="grid">
          <form className="card" onSubmit={addHours}>
            <h3>Рабочие часы</h3>
            <label>День<select name="weekday">{weekdays.map((x, i) => <option value={i} key={x}>{x}</option>)}</select></label>
            <label>С<input name="start_time" type="time" defaultValue="09:00" required /></label>
            <label>До<input name="end_time" type="time" defaultValue="18:00" required /></label>
            <button>Добавить интервал</button>
          </form>
          <form className="card" onSubmit={addTimeOff}>
            <h3>Time off</h3>
            <label>Начало<input name="start_at" type="datetime-local" required /></label>
            <label>Конец<input name="end_at" type="datetime-local" required /></label>
            <label>Причина<input name="reason" /></label>
            <button>Добавить блокировку</button>
          </form>
        </div>
      )}

      <div className="grid" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Рабочая неделя</h3>
          {hours.map((x) => <div className="row" key={x.id}><span>{weekdays[x.weekday]} {x.start_time.slice(0, 5)}–{x.end_time.slice(0, 5)}</span>{manager && <button className="secondary" onClick={() => void remove("working-hours", x.id)}>Удалить</button>}</div>)}
        </div>
        <div className="card">
          <h3>Исключения</h3>
          {timeOff.map((x) => <div className="row" key={x.id}><span>{new Date(x.start_at).toLocaleString("ru-RU")} → {new Date(x.end_at).toLocaleString("ru-RU")}</span>{manager && <button className="secondary" onClick={() => void remove("time-off", x.id)}>Удалить</button>}</div>)}
        </div>
      </div>
    </main>
  );
}
