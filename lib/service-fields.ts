import { z } from "zod";

export const serviceFieldSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-zA-Z0-9_]{0,39}$/),
  label: z.string().trim().min(1).max(60),
  type: z.enum(["text", "email", "password", "url", "number"]),
  required: z.boolean().default(false),
});

export const serviceFieldsSchema = z.array(serviceFieldSchema).min(1).max(20).superRefine((fields, ctx) => {
  const keys = fields.map((field) => field.key);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", message: "DUPLICATE_FIELD_KEYS" });
});

export type ServiceField = z.infer<typeof serviceFieldSchema>;

export const legacyServiceFields: ServiceField[] = [
  { key: "email", label: "الإيميل", type: "email", required: true },
  { key: "password", label: "كلمة المرور", type: "password", required: true },
  { key: "otpSecret", label: "مفتاح OTP", type: "text", required: false },
  { key: "otpUrl", label: "رابط استخراج OTP", type: "url", required: false },
];

export function normalizeServiceFields(value: unknown): ServiceField[] {
  const parsed = serviceFieldsSchema.safeParse(value);
  return parsed.success ? parsed.data : legacyServiceFields;
}

