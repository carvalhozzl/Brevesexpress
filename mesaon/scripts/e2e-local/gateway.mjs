// Gateway mínimo que imita as rotas do Supabase (Kong) para testes E2E locais.
import http from "node:http";
const routes = [["/rest/v1", 3001], ["/auth/v1", 9999]];
const server = http.createServer((req, res) => {
  const route = routes.find(([p]) => req.url.startsWith(p));
  if (!route) { res.writeHead(404); return res.end("not found"); }
  const [prefix, port] = route;
  const path = req.url.slice(prefix.length) || "/";
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  const p = http.request({ host: "127.0.0.1", port, path, method: req.method, headers }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  p.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(p);
});
// Realtime não está disponível neste ambiente: recusa upgrades de WebSocket.
server.on("upgrade", (_req, socket) => socket.destroy());
server.listen(54321, "127.0.0.1", () => console.log("gateway on 54321"));
