import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Sobre o MesaOn" };

export default function SobrePage() {
  return (
    <LegalPage title="Sobre o MesaOn">
      <p>
        O MesaOn é uma plataforma de atendimento para restaurantes, bares, lanchonetes e cafeterias. Cada mesa ganha um QR Code exclusivo — e,
        opcionalmente, uma tag NFC — que abre uma página simples no celular do cliente para chamar o garçom, pedir a conta ou solicitar outros
        atendimentos.
      </p>
      <p>
        Do outro lado, a equipe acompanha as chamadas em tempo real em um painel organizado, com responsável, status e tempo de espera de cada
        solicitação. Os dados ajudam o estabelecimento a entender horários de maior movimento e o tempo de atendimento.
      </p>
      <h2>Nossos princípios</h2>
      <ul>
        <li>Simplicidade: o cliente não instala nada e não precisa criar conta.</li>
        <li>Privacidade: não coletamos dados pessoais de quem está na mesa.</li>
        <li>Segurança: cada restaurante só acessa os próprios dados.</li>
      </ul>
    </LegalPage>
  );
}
