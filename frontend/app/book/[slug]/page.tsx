"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

type Item = { id: string; name: string };
type Service = Item & { duration_minutes: number; price: string };
type Slot = { staff_id: string; start_at: string; end_at: string };

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState("");
  const [locations, setLocations] = useState<Item[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Item[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [locationId, setLocationId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [slot, setSlot] = useState("");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void params.then(({ slug: value }) => {
      setSlug(value);
      void Promise.all([
        api<Item[]>(`/public/${value}/locations`),
        api<Service[]>(`/public/${value}/services`),
      ]).then(([locationRows, serviceRows]) => {
        setLocations(locationRows);
        setServices(serviceRows);
        if (locationRows[0]) setLocationId(locationRows[0].id);
        if (serviceRows[0]) setServiceId(serviceRows[0].id);
      });
    });
  }, [params]);

  useEffect(() => {
    if (!slug || !locationId || !serviceId) return;
    void api<Item[]>(
      `/public/${slug}/staff?location_id=${locationId}&service_id=${serviceId}`,
    ).then((rows) => {
      setStaff(rows);
      setStaffId(rows[0]?.id ?? "");
    });
  }, [slug, locationId, serviceId]);

  useEffect(() => {
    if (!slug || !locationId || !serviceId || !day) return;
    const staffQuery = staffId ? `&staff_id=${staffId}` : "";
    void api<Slot[]>(
      `/public/${slug}/availability?location_id=${locationId}&service_id=${serviceId}&day=${day}${staffQuery}`,
    ).then(setSlots);
  }, [slug, locationId, serviceId, staffId, day]);

  const selected = useMemo(() => slots.find((item) => item.start_at === slot), [slots, slot]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const result = await api<{ id: string }>(`/public/${slug}/appointments`, {
      method: "POST",
      body: JSON.stringify({
        location_id: locationId,
        service_id: serviceId,
        staff_id: selected.staff_id,
        start_at: selected.start_at,
        customer_name: name,
        customer_phone: phone,
        booking_key: crypto.randomUUID(),
      }),
    });
    setMessage(`Готово. Номер записи: ${result.id}`);
  }

  return (
    <main>
      <form className="card" onSubmit={submit}>
        <h1>Онлайн-запись</h1>
        <div className="grid">
          <label>Филиал<select value={locationId} onChange={(e) => setLocationId(e.target.value)}>{locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Услуга<select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>{services.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.price}</option>)}</select></label>
          <label>Специалист<select value={staffId} onChange={(e) => setStaffId(e.target.value)}><option value="">Любой доступный</option>{staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Дата<input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        </div>
        <label>Время<select value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">Выберите слот</option>{slots.map((x) => <option key={`${x.staff_id}-${x.start_at}`} value={x.start_at}>{new Date(x.start_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</option>)}</select></label>
        <label>Имя<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Телефон<input value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
        <button type="submit" disabled={!selected}>Записаться</button>
        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
