/** Fusos mais comuns no Brasil (o banco aceita qualquer fuso IANA válido). */
export const BRAZIL_TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (SP, RJ, MG, Sul, GO, DF, BA, NE)" },
  { value: "America/Manaus", label: "Amazonas (AM)" },
  { value: "America/Cuiaba", label: "Mato Grosso (MT)" },
  { value: "America/Campo_Grande", label: "Mato Grosso do Sul (MS)" },
  { value: "America/Porto_Velho", label: "Rondônia (RO)" },
  { value: "America/Boa_Vista", label: "Roraima (RR)" },
  { value: "America/Rio_Branco", label: "Acre (AC)" },
  { value: "America/Belem", label: "Pará / Amapá (PA, AP)" },
  { value: "America/Fortaleza", label: "Ceará / RN / PB / PI / MA" },
  { value: "America/Recife", label: "Pernambuco (PE)" },
  { value: "America/Maceio", label: "Alagoas / Sergipe (AL, SE)" },
  { value: "America/Araguaina", label: "Tocantins (TO)" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
] as const;
