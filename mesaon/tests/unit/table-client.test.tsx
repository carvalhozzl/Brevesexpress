import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TableClient } from "@/components/customer/table-client";
import type { PublicTable } from "@/services/public-table";

const token = "0123456789abcdef01234567";
const initial: PublicTable = {
  restaurant: { name: "Restaurante Exemplo", is_active: true, timezone: "America/Sao_Paulo" },
  table: { label: "12", is_active: true },
  service_types: [
    { id: "00000000-0000-4000-8000-000000000001", name: "Chamar garçom", icon: "waiter" },
    { id: "00000000-0000-4000-8000-000000000002", name: "Solicitar a conta", icon: "bill" },
  ],
  requests: [],
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("página da mesa (cliente)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("mostra restaurante, mesa e as opções configuradas", () => {
    render(<TableClient token={token} initial={initial} />);
    expect(screen.getByText("Restaurante Exemplo")).toBeInTheDocument();
    expect(screen.getByTestId("table-label")).toHaveTextContent("Mesa 12");
    expect(screen.getByRole("button", { name: /Chamar garçom/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Solicitar a conta/ })).toBeInTheDocument();
  });

  it("cliques repetidos enviam apenas UMA requisição e confirmam após o servidor", async () => {
    let resolvePost: (r: Response) => void = () => {};
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") return new Promise<Response>((r) => (resolvePost = r));
      return Promise.resolve(json(200, { ...initial, requests: [{ id: "r1", service_type_id: initial.service_types[0].id, service_type_name: "Chamar garçom", status: "pending", created_at: new Date().toISOString(), received_at: null, started_at: null, completed_at: null, cancelled_at: null }] }));
    });
    const user = userEvent.setup();
    render(<TableClient token={token} initial={initial} />);
    const button = screen.getByRole("button", { name: /Chamar garçom/ });
    await user.click(button);
    await user.click(button);
    await user.click(button);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(screen.getByText("Enviando…")).toBeInTheDocument();
    expect(screen.queryByText(/foi enviado/)).not.toBeInTheDocument(); // ainda não confirmou

    await act(async () => resolvePost(json(201, { result: "created", message: "ok", request: { id: "r1", status: "pending", service_type_name: "Chamar garçom", created_at: new Date().toISOString() } })));
    expect(await screen.findByText(/“Chamar garçom” foi enviado para a equipe/)).toBeInTheDocument();
    expect(await screen.findByText("Acompanhe seus pedidos")).toBeInTheDocument();
    expect(screen.getByText("Já solicitado")).toBeInTheDocument();
  });

  it("falha de rede mostra erro e botão para tentar de novo", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST" ? Promise.reject(new TypeError("Failed to fetch")) : Promise.resolve(json(200, initial)),
    );
    const user = userEvent.setup();
    render(<TableClient token={token} initial={initial} />);
    await user.click(screen.getByRole("button", { name: /Solicitar a conta/ }));
    expect(await screen.findByText(/Sem conexão com o servidor/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("aviso de pedido duplicado", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? Promise.resolve(json(200, { result: "duplicate", message: "dup", request: { id: "r1", status: "received", service_type_name: "Chamar garçom", created_at: new Date().toISOString() } }))
        : Promise.resolve(json(200, initial)),
    );
    const user = userEvent.setup();
    render(<TableClient token={token} initial={initial} />);
    await user.click(screen.getByRole("button", { name: /Chamar garçom/ }));
    expect(await screen.findByText(/Você já pediu “Chamar garçom”/)).toBeInTheDocument();
  });
});
