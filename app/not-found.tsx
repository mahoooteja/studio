import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found wrap">
      <div>
        <h1>404</h1>
        <p className="muted" style={{ margin: "16px 0 28px" }}>Ta warstwa się nie wydrukowała. Strony nie ma albo nie masz do niej dostępu.</p>
        <Link href="/" className="btn">Wróć na start</Link>
      </div>
    </div>
  );
}
