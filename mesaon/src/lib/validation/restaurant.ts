import { z } from "zod";

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use pelo menos 3 caracteres")
  .max(50, "Use no máximo 50 caracteres")
  .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, "Use apenas letras minúsculas, números e hífens (sem hífen no início/fim)");

export const timezoneSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Fuso horário inválido");

export const restaurantNameSchema = z.string().trim().min(2, "Informe o nome do estabelecimento").max(80, "Nome muito longo");

export const createRestaurantSchema = z.object({
  name: restaurantNameSchema,
  slug: slugSchema,
  timezone: timezoneSchema.default("America/Sao_Paulo"),
});

export const updateRestaurantSchema = z.object({
  name: restaurantNameSchema,
  timezone: timezoneSchema,
});

/** Sugere um endereço a partir do nome: "Bar do Zé" -> "bar-do-ze" */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}
