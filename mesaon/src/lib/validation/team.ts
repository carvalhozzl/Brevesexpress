import { z } from "zod";
import { emailSchema } from "./auth";
import { uuidSchema } from "./common";

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["manager", "attendant"], { error: "Escolha uma função" }),
});

export const updateMemberSchema = z.object({
  memberId: uuidSchema,
  role: z.enum(["owner", "manager", "attendant"]).optional(),
  isActive: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});
