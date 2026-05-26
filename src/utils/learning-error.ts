import type { ZodError } from "zod";
import type { OperationDef, OperationError } from "../operations/types.js";
import { emitJsonSchema } from "../schema/emit.js";

type ErrorWithSchema = OperationError & {
  operation: string;
  schema?: unknown;
  example?: unknown;
  example_batch?: unknown;
  issues?: { path: (string | number)[]; message: string }[];
};

// Top-level .refine() failures (XOR rules etc.) carry the whole-payload
// example as actionable guidance — the full JSON schema would only add
// noise. Skip the schema for those and any other top-level-only issue
// where the example is self-explanatory.
function shouldIncludeSchema(issues: ZodError["issues"]): boolean {
  return issues.some((i) => i.path.length > 0);
}

export function buildValidationError(
  def: OperationDef,
  zodError: ZodError
): ErrorWithSchema {
  const issues = zodError.issues.map((i) => ({
    path: i.path as (string | number)[],
    message: i.message,
  }));

  const firstPath = issues[0]?.path ?? [];
  const firstMsg = issues[0]?.message ?? "Validation failed";
  const includeSchema = shouldIncludeSchema(zodError.issues);

  return {
    code: "validation_error",
    operation: def.name,
    message: `${firstMsg}${firstPath.length ? ` at ${firstPath.join(".")}` : ""}`,
    path: firstPath.length ? firstPath : undefined,
    issues,
    ...(includeSchema ? { schema: emitJsonSchema(def.schema) } : {}),
    example: def.example,
    ...(def.exampleBatch ? { example_batch: def.exampleBatch } : {}),
    fix: includeSchema
      ? "The full schema and a working example are included above. Adjust the payload and retry. For batch mode, wrap items in { items: [...] }."
      : "A working example is included above. Match the example shape and retry. For batch mode, wrap items in { items: [...] }.",
  };
}
