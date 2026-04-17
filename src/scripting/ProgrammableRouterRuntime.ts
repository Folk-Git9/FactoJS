export interface CompiledProgrammableRouterProgram {
  execute(api: object, state: Record<string, unknown>): void;
}

export interface ProgrammableRouterCompileResult {
  ok: boolean;
  program: CompiledProgrammableRouterProgram | null;
  error: string | null;
}

type ProgramExecutor = (
  api: object,
  state: Record<string, unknown>,
  globalThis: undefined,
  window: undefined,
  document: undefined,
  fetch: undefined,
  XMLHttpRequest: undefined,
  WebSocket: undefined,
  localStorage: undefined,
  sessionStorage: undefined,
  navigator: undefined,
  location: undefined,
  postMessage: undefined,
  Worker: undefined,
  evalFn: undefined,
  functionCtor: undefined,
  dateCtor: undefined,
  mathApi: object
) => void;

const createSafeMath = (): object => {
  const safeMath = Object.create(null) as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(Math)) {
    const descriptor = Object.getOwnPropertyDescriptor(Math, key);
    if (!descriptor || !("value" in descriptor)) {
      continue;
    }
    safeMath[key] = key === "random" ? undefined : descriptor.value;
  }
  return Object.freeze(safeMath);
};

const SAFE_MATH = createSafeMath();

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const compileProgrammableRouterProgram = (source: string): ProgrammableRouterCompileResult => {
  try {
    const factory = new Function(
      "api",
      "state",
      "globalThis",
      "window",
      "document",
      "fetch",
      "XMLHttpRequest",
      "WebSocket",
      "localStorage",
      "sessionStorage",
      "navigator",
      "location",
      "postMessage",
      "Worker",
      "evalFn",
      "functionCtor",
      "dateCtor",
      "mathApi",
      `"use strict";\n${source}\n//# sourceURL=programmable-router.user.js`
    ) as ProgramExecutor;

    return {
      ok: true,
      error: null,
      program: {
        execute(api: object, state: Record<string, unknown>): void {
          factory(
            api,
            state,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            SAFE_MATH
          );
        },
      },
    };
  } catch (error) {
    return {
      ok: false,
      program: null,
      error: formatError(error),
    };
  }
};

export const formatProgrammableRouterRuntimeError = (error: unknown): string => formatError(error);
