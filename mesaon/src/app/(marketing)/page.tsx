import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Building2,
  Clock3,
  GlassWater,
  HandPlatter,
  History,
  LayoutDashboard,
  ListChecks,
  MapPin,
  MonitorSmartphone,
  Nfc,
  QrCode,
  Receipt,
  Smile,
  TrendingUp,
  Users,
  VolumeX,
  Wifi,
} from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { LiveDemo } from "@/components/marketing/live-demo";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { getPublicPlans } from "@/services/plans";

// Preços vêm do banco (editáveis no /admin); revalida a cada 5 minutos.
export const revalidate = 300;

const STEPS = [
  {
    icon: QrCode,
    title: "Identifique a mesa",
    text: "Cada mesa possui um QR Code exclusivo e pode ter uma tag NFC. O cliente aponta a câmera ou aproxima o celular.",
  },
  {
    icon: HandPlatter,
    title: "Solicite atendimento",
    text: "Uma página abre na hora, sem aplicativo. O cliente escolhe do que precisa: garçom, conta, água ou outro pedido.",
  },
  {
    icon: BellRing,
    title: "Receba e atenda",
    text: "A equipe recebe a chamada em tempo real, aceita, atende e conclui. O cliente acompanha cada etapa pelo celular.",
  },
];

const FEATURES = [
  { icon: HandPlatter, title: "Chamada de garçom", text: "Um toque e a equipe sabe exatamente qual mesa precisa de atenção." },
  { icon: Receipt, title: "Solicitação de conta", text: "O cliente pede a conta sem precisar chamar a atenção de ninguém." },
  { icon: GlassWater, title: "Água e outros itens", text: "Pedidos de atendimento configuráveis: água, gelo, talheres, maquininha e mais." },
  { icon: Wifi, title: "Notificações em tempo real", text: "Chamadas aparecem no painel na hora, com destaque visual e alerta sonoro opcional." },
  { icon: MapPin, title: "Identificação automática da mesa", text: "Código imprevisível por mesa, validado no servidor. Sem digitar nada." },
  { icon: LayoutDashboard, title: "Painel de atendimento", text: "Aceitar, iniciar e concluir com um toque, vendo o tempo de espera de cada chamada." },
  { icon: History, title: "Histórico de chamadas", text: "Filtre por período, mesa, tipo, status e responsável." },
  { icon: BarChart3, title: "Relatórios operacionais", text: "Horários de pico, tipos mais pedidos e tempo médio de atendimento." },
  { icon: Users, title: "Gestão de funcionários", text: "Convide a equipe e defina papéis: proprietário, gerente ou atendente." },
  { icon: Building2, title: "Múltiplos restaurantes", text: "Gerencie várias unidades com o mesmo login, com dados isolados entre elas." },
  { icon: QrCode, title: "QR Codes personalizados", text: "Baixe em PNG ou SVG e imprima etiquetas prontas para as mesas." },
  { icon: Nfc, title: "Integração com tags NFC", text: "Grave o endereço da mesa em tags NFC e o cliente só precisa aproximar o celular." },
];

const BENEFITS = [
  { icon: VolumeX, title: "Menos chamadas manuais", text: "Sem gritos, acenos ou clientes procurando o garçom pelo salão." },
  { icon: ListChecks, title: "Equipe mais organizada", text: "Cada chamada tem um responsável e um status. Ninguém atende em dobro." },
  { icon: MonitorSmartphone, title: "Pendências à vista", text: "Todas as solicitações abertas em uma tela, da mais antiga à mais nova." },
  { icon: Smile, title: "Cliente mais confortável", text: "O cliente pede quando quiser e acompanha o andamento pelo celular." },
  { icon: TrendingUp, title: "Dados de demanda", text: "Descubra os horários e as mesas com mais chamadas para planejar escalas." },
  { icon: Clock3, title: "Tempo de atendimento", text: "Acompanhe quanto tempo leva entre a chamada, o aceite e a conclusão." },
];

function SectionTitle({ eyebrow, title, text, id }: { eyebrow: string; title: string; text?: string; id: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {text ? <p className="mt-3 text-lg leading-relaxed text-muted">{text}</p> : null}
    </div>
  );
}

export default async function HomePage() {
  const { plans } = await getPublicPlans();

  return (
    <>
      {/* HERO */}
      <section id="inicio" aria-labelledby="hero-title" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(60%_60%_at_70%_20%,rgb(59_130_246/0.12),transparent_70%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1fr_1.05fr] lg:pb-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-navy-900 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
              Seu atendimento a um toque de distância
            </p>
            <h1 id="hero-title" className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
              Seu cliente chama.
              <br />
              <span className="text-brand-600">Sua equipe atende.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Transforme cada mesa em um ponto de atendimento inteligente. Com o MesaOn, seus clientes chamam o garçom pelo celular, sem gritos, sem
              gestos e sem complicação.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/cadastro" className={buttonClasses("primary", "lg")}>
                Conhecer o MesaOn <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#como-funciona" className={buttonClasses("secondary", "lg")}>
                Ver como funciona
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <li className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-brand-600" aria-hidden="true" /> QR Code e NFC
              </li>
              <li className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-brand-600" aria-hidden="true" /> Sem aplicativo
              </li>
              <li className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-brand-600" aria-hidden="true" /> Painel em tempo real
              </li>
            </ul>
          </div>
          <figure className="pb-6">
            <HeroVisual />
            <figcaption className="sr-only">Ilustração da interface: o celular da mesa 12 chama o garçom e o painel do restaurante recebe a chamada.</figcaption>
          </figure>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" aria-labelledby="como-title" className="scroll-mt-20 border-y border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle id="como-title" eyebrow="Como funciona" title="Três passos, do toque ao atendimento" />
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative rounded-3xl border border-line bg-canvas p-6">
                <span className="absolute right-6 top-6 text-5xl font-bold text-navy-900/[0.06]" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white">
                  <step.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ink">
                  <span className="sr-only">Passo {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-2 leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" aria-labelledby="recursos-title" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            id="recursos-title"
            eyebrow="Recursos"
            title="Tudo o que o salão precisa para atender melhor"
            text="Do QR Code na mesa ao relatório no fim do mês, em uma única plataforma."
          />
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-raised)]">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <f.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PARA RESTAURANTES / BENEFÍCIOS */}
      <section id="para-restaurantes" aria-labelledby="beneficios-title" className="scroll-mt-20 bg-navy-900 py-20 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">Para restaurantes</p>
            <h2 id="beneficios-title" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Um salão mais silencioso e uma equipe mais eficiente
            </h2>
            <p className="mt-3 text-lg text-white/70">Para restaurantes, bares, lanchonetes, cafeterias e outros estabelecimentos gastronômicos.</p>
          </div>
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <li key={b.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <b.icon className="h-6 w-6 text-brand-400" aria-hidden="true" />
                <h3 className="mt-4 font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{b.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* DEMONSTRAÇÃO */}
      <section id="demonstracao" aria-labelledby="demo-title" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            id="demo-title"
            eyebrow="Demonstração interativa"
            title="Experimente agora: chame o garçom"
            text="Escolha uma mesa, toque em um pedido e veja a chamada chegar ao painel. Depois, atenda como a equipe faria."
          />
          <div className="mt-12">
            <LiveDemo />
          </div>
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" aria-labelledby="precos-title" className="scroll-mt-20 border-y border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle id="precos-title" eyebrow="Planos e preços" title="Um plano para cada tamanho de operação" />
          <div className="mt-12">
            <Pricing plans={plans} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionTitle id="faq-title" eyebrow="Perguntas frequentes" title="Tire suas dúvidas" />
          <div className="mt-10">
            <Faq />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 rounded-3xl bg-brand-600 px-6 py-12 text-center text-white sm:py-14">
          <h2 id="cta-title" className="text-3xl font-bold tracking-tight">
            Precisou? MesaOn.
          </h2>
          <p className="max-w-xl text-lg text-white/85">Crie sua conta, cadastre as mesas e imprima os QR Codes. Sua equipe começa a receber chamadas no mesmo dia.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/cadastro" className={buttonClasses("light", "lg")}>
              Começar agora
            </Link>
            <Link href="/contato" className={buttonClasses("outlineLight", "lg")}>
              Falar com a equipe
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
