export default function Home() {
  return (
    <main>
      <div className="card">
        <h1>Lootly</h1>
        <p>Онлайн-запись, расписание, клиенты и аналитика в одном сервисе.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/login"><button>Войти</button></a>
          <a href="/setup"><button className="secondary">Создать организацию</button></a>
        </div>
      </div>
    </main>
  );
}
