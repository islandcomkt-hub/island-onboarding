// Tipos mínimos só para o typecheck do site importar o Worker nos testes unitários.
// O Worker usa os tipos reais de @cloudflare/workers-types (worker/tsconfig.json).
declare type D1Database = { prepare(query: string): { bind(...values: unknown[]): { run(): Promise<{ meta?: { changes?: number } }> } } };
declare type ExportedHandler<E = unknown> = { fetch?: (request: Request, env: E) => Response | Promise<Response> };
