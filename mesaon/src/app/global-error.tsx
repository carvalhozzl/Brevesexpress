"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f3f5f9", color: "#14213d", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>Algo deu errado</h1>
          <p style={{ color: "#55607a" }}>Não foi possível carregar a página. Tente novamente.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, border: 0, background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
