import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { STAGES, STAGES_STATUS, allFields } from "@/config/stages";
import { ISLAND_LAYOUT, buildRoute } from "@/components/archipelago/scene/layout";

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

describe("catálogo de etapas", () => {
  it("tem exatamente seis etapas numeradas de 1 a 6 e marcadas como provisórias", () => {
    expect(STAGES).toHaveLength(6);
    expect(STAGES.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(STAGES.every((s) => s.provisional)).toBe(true);
    expect(STAGES_STATUS).toBe("PENDENTE_DE_CONFIRMACAO");
  });
  it("ids de etapas e de campos são únicos", () => {
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(6);
    const ids = allFields().map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("opções de cada pergunta têm ids únicos", () => {
    for (const f of allFields()) {
      if (f.kind === "choice") expect(new Set(f.options.map((o) => o.id)).size).toBe(f.options.length);
    }
  });
  it("títulos, descrições e rótulos curtos não terminam com ponto final", () => {
    for (const s of STAGES) {
      expect(s.title.endsWith(".")).toBe(false);
      if (s.description) expect(s.description.endsWith(".")).toBe(false);
      for (const f of s.fields) expect(f.label.endsWith(".")).toBe(false);
    }
  });
  it("a frase removida da primeira etapa não existe em nenhum arquivo de código", () => {
    const banned = "Conte onde sua empresa está hoje";
    const hits = walk("src").filter((f) => readFileSync(f, "utf8").includes(banned));
    expect(hits).toEqual([]);
  });
});

describe("cena ↔ formulário", () => {
  it("cada etapa tem uma ilha na mesma ordem", () => {
    expect(ISLAND_LAYOUT.map((l) => l.id)).toEqual(STAGES.map((s) => s.id));
  });
  it("a rota passa pelas seis ilhas em ordem crescente", () => {
    const r = buildRoute();
    expect(r.stopU).toHaveLength(6);
    for (let i = 1; i < r.stopU.length; i++) expect(r.stopU[i]).toBeGreaterThan(r.stopU[i - 1]);
    expect(r.stopU[0]).toBeGreaterThan(0);
    expect(r.stopU[5]).toBeLessThanOrEqual(1);
  });
});
