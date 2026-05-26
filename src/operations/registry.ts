import type { OperationDef, OperationName } from "./types.js";

const registry = new Map<OperationName, OperationDef<any, any>>();

export function register<TParams, TResult>(
  def: OperationDef<TParams, TResult>
): void {
  if (registry.has(def.name)) {
    throw new Error(`Operation already registered: ${def.name}`);
  }
  registry.set(def.name, def as OperationDef<any, any>);
}

export function getOperation(name: string): OperationDef<any, any> | undefined {
  return registry.get(name as OperationName);
}

export function listOperations(): OperationDef<any, any>[] {
  return [...registry.values()];
}

export function operationNames(): OperationName[] {
  return [...registry.keys()];
}
