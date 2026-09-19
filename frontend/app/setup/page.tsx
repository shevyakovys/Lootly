"use client";

import { FormEvent, useState } from "react";
import { api } from "../lib/api";

export default function SetupPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await api("/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify({
          organization_name: organizationName,
          organization_slug: organizationSlug,
          email,
          password,
        }),
      });
      setMessage("Организация создана. Теперь можно войти.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка создания");
    }
  }

  return (
    <main>
      <form className="card" onSubmit={submit} style={{ maxWidth: 560, margin: "40px auto" }}>
        <h1>Новая организация</h1>
        <label>Название<input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required /></label>
        <label>Slug<input value={organizationSlug} onChange={(e) => setOrganizationSlug(e.target.value)} placeholder="my-studio" required /></label>
        <label>Email владельца<input value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Пароль<input type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button type="submit">Создать</button>
        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
