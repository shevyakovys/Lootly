"use client";

import { FormEvent, useState } from "react";
import { api } from "../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await api<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("lootly_token", result.access_token);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    }
  }

  return (
    <main>
      <form className="card" onSubmit={submit} style={{ maxWidth: 440, margin: "40px auto" }}>
        <h1>Вход</h1>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Пароль<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p>{error}</p>}
        <button type="submit">Войти</button>
      </form>
    </main>
  );
}
