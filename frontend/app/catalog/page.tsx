"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

type Me = { organization_id: string; role: string };
type Location = { id: string; name: string; timezone: string; active: boolean };
type Service = { id: string; name: string; duration_minutes: number; price: string; active: boolean };
type Staff = { id: string; name: string; location_id: string; active: boolean };
type Customer = { id: string; name: string; phone: string; email?: string | null };

export default function CatalogPage() {
  const router = useRouter();
  const tokenRef = useRef("");
  const [me, setMe] = useState<Me | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async (accessToken: string) => {
    const user = await api<Me>("/auth/me", {}, accessToken);
    setMe(user);
    const [locationRows, serviceRows, staffRows, customerRows] = await Promise.all([
      api<Location[]>("/catalog/locations", {}, accessToken),
      api<Service[]>("/catalog/services", {}, accessToken),
      api<Staff[]>("/catalog/staff", {}, accessToken),
      api<Customer[]>("/catalog/customers", {}, accessToken),
    ]);
    setLocations(locationRows);
    setServices(serviceRows);
    setStaff(staffRows);
    setCustomers(customerRows);
  }, []);

  useEffect(() => {
    const accessToken = localStorage.getItem("lootly_token") ?? "";
    if (!accessToken) {
      router.push("/login");
      return;
    }
    tokenRef.current = accessToken;
    void load(accessToken).catch((err) => setMessage(err instanceof Error ? err.message : "Ошибка"));
  }, [load, router]);

  async function createLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!me) return;
    const form = new FormData(event.currentTarget);
    await api("/locations", {
      method: "POST",
      body: JSON.stringify({
        organization_id: me.organization_id,
        name: form.get("name"),
        timezone: form.get("timezone"),
        address: form.get("address") || null,
      }),
    }, tokenRef.current);
    event.currentTarget.reset();
    await load(tokenRef.current);
  }

  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!me) return;
    const form = new FormData(event.currentTarget);
    await api("/services", {
      method: "POST",
      body: JSON.stringify({
        organization_id: me.organization_id,
        name: form.get("name"),
        duration_minutes: Number(form.get("duration")),
        price: form.get("price"),
      }),
    }, tokenRef.current);
    event.currentTarget.reset();
    await load(tokenRef.current);
  }

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!me) return;
    const form = new FormData(event.currentTarget);
    await api("/staff", {
      method: "POST",
      body: JSON.stringify({
        organization_id: me.organization_id,
        location_id: form.get("location_id"),
        name: form.get("name"),
      }),
    }, tokenRef.current);
    event.currentTarget.reset();
    await load(tokenRef.current);
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!me) return;
    const form = new FormData(event.currentTarget);
    await api("/customers", {
      method: "POST",
      body: JSON.stringify({
        organization_id: me.organization_id,
        name: form.get("name"),
        phone: form.get("phone"),
        email: form.get("email") || null,
      }),
    }, tokenRef.current);
    event.currentTarget.reset();
    await load(tokenRef.current);
  }

  async function assignService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const staffId = String(form.get("staff_id"));
    const serviceId = String(form.get("service_id"));
    await api(`/staff/${staffId}/services/${serviceId}`, { method: "POST" }, tokenRef.current);
    setMessage("Услуга назначена сотруднику");
  }

  const manager = me?.role === "owner" || me?.role === "admin";

  return (
    <main>
      <h1>Справочники</h1>
      {message && <p>{message}</p>}
      {manager && (
        <div className="grid">
          <form className="card" onSubmit={createLocation}>
            <h3>Новый филиал</h3>
            <label>Название<input name="name" required /></label>
            <label>Timezone<input name="timezone" defaultValue="Europe/Moscow" required /></label>
            <label>Адрес<input name="address" /></label>
            <button>Добавить</button>
          </form>
          <form className="card" onSubmit={createService}>
            <h3>Новая услуга</h3>
            <label>Название<input name="name" required /></label>
            <label>Длительность, мин<input name="duration" type="number" min="1" defaultValue="60" required /></label>
            <label>Цена<input name="price" type="number" min="0" step="0.01" required /></label>
            <button>Добавить</button>
          </form>
          <form className="card" onSubmit={createStaff}>
            <h3>Новый сотрудник</h3>
            <label>Имя<input name="name" required /></label>
            <label>Филиал<select name="location_id" required>{locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <button>Добавить</button>
          </form>
          <form className="card" onSubmit={createCustomer}>
            <h3>Новый клиент</h3>
            <label>Имя<input name="name" required /></label>
            <label>Телефон<input name="phone" required /></label>
            <label>Email<input name="email" type="email" /></label>
            <button>Добавить</button>
          </form>
        </div>
      )}

      {manager && staff.length > 0 && services.length > 0 && (
        <form className="card" onSubmit={assignService} style={{ marginTop: 16 }}>
          <h3>Назначить услугу сотруднику</h3>
          <div className="grid">
            <label>Сотрудник<select name="staff_id">{staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label>Услуга<select name="service_id">{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          </div>
          <button>Назначить</button>
        </form>
      )}

      <div className="grid" style={{ marginTop: 24 }}>
        <div className="card"><h3>Филиалы</h3>{locations.map((x) => <div className="row" key={x.id}><span>{x.name}</span><span>{x.timezone}</span></div>)}</div>
        <div className="card"><h3>Услуги</h3>{services.map((x) => <div className="row" key={x.id}><span>{x.name}</span><span>{x.price}</span></div>)}</div>
        <div className="card"><h3>Сотрудники</h3>{staff.map((x) => <div className="row" key={x.id}><span>{x.name}</span><span>{x.active ? "active" : "inactive"}</span></div>)}</div>
        <div className="card"><h3>Клиенты</h3>{customers.map((x) => <div className="row" key={x.id}><span>{x.name}</span><span>{x.phone}</span></div>)}</div>
      </div>
    </main>
  );
}
