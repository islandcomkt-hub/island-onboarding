/**
 * Catálogo declarativo das SEIS etapas do onboarding.
 *
 * ⚠️ PENDENTE_DE_CONFIRMACAO
 * As perguntas e opções abaixo são um catálogo PROVISÓRIO. O conteúdo real das etapas do site atual
 * (islandcompany.space) é renderizado por JavaScript e não pôde ser inspecionado sem preencher o
 * formulário (ver docs/AUDITORIA_REFERENCIA.md). Os nomes das etapas seguem a arte de referência
 * (01 Partida … 06 Sua conexão). Não migrar para produção sem validação do cliente.
 * Para ajustar perguntas, edite SOMENTE este arquivo: validação, UI e cena 3D derivam dele.
 */

export const STAGES_STATUS = "PENDENTE_DE_CONFIRMACAO" as const;

export type StageId = "partida" | "negocio" | "desafio" | "destino" | "momento" | "conexao";

export interface ChoiceOption {
  id: string;
  label: string;
  hint?: string;
}

interface FieldBase {
  id: string;
  label: string;
  help?: string;
  required: boolean;
}

export interface TextField extends FieldBase {
  kind: "text" | "tel" | "email" | "textarea";
  minLength?: number;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email";
}

export interface ChoiceField extends FieldBase {
  kind: "choice";
  options: ChoiceOption[];
}

export interface ConsentField extends FieldBase {
  kind: "consent";
}

export type Field = TextField | ChoiceField | ConsentField;

export interface Stage {
  id: StageId;
  /** 1..6 */
  number: number;
  /** nome curto exibido no progresso e no rótulo da ilha */
  name: string;
  title: string;
  description?: string;
  fields: Field[];
  provisional: true;
}

export const STAGES: Stage[] = [
  {
    id: "partida",
    number: 1,
    name: "Partida",
    title: "Quem está embarcando?",
    description: "Começamos pelo básico para dar nome à rota",
    provisional: true,
    fields: [
      {
        id: "nome",
        kind: "text",
        label: "Como podemos te chamar?",
        required: true,
        minLength: 2,
        maxLength: 60,
        autoComplete: "given-name",
        placeholder: "Seu primeiro nome",
      },
      {
        id: "empresa",
        kind: "text",
        label: "Nome da empresa",
        required: true,
        minLength: 2,
        maxLength: 80,
        autoComplete: "organization",
        placeholder: "Como o mercado conhece o seu negócio",
      },
      {
        id: "whatsapp",
        kind: "tel",
        label: "WhatsApp com DDD",
        help: "Usamos apenas para falar sobre este diagnóstico",
        required: true,
        minLength: 10,
        maxLength: 20,
        autoComplete: "tel-national",
        inputMode: "tel",
        placeholder: "(31) 99999-9999",
      },
    ],
  },
  {
    id: "negocio",
    number: 2,
    name: "Seu negócio",
    title: "Qual é o seu negócio hoje?",
    description: "Escolha a opção que mais se aproxima da sua realidade",
    provisional: true,
    fields: [
      {
        id: "segmento",
        kind: "choice",
        label: "Segmento",
        required: true,
        options: [
          { id: "varejo", label: "Comércio e varejo" },
          { id: "servicos", label: "Serviços" },
          { id: "saude", label: "Saúde e bem-estar" },
          { id: "alimentacao", label: "Alimentação" },
          { id: "automotivo", label: "Automotivo" },
          { id: "educacao", label: "Educação e infoprodutos" },
          { id: "outro", label: "Outro segmento" },
        ],
      },
      {
        id: "estagio",
        kind: "choice",
        label: "Estágio do negócio",
        required: true,
        options: [
          { id: "comecando", label: "Começando agora" },
          { id: "operando", label: "Operando, sem previsibilidade" },
          { id: "crescendo", label: "Crescendo e pedindo estrutura" },
          { id: "reposicionando", label: "Reposicionando o negócio" },
        ],
      },
    ],
  },
  {
    id: "desafio",
    number: 3,
    name: "Seu desafio",
    title: "Qual é o maior obstáculo agora?",
    description: "Pense no que mais trava o seu crescimento neste momento",
    provisional: true,
    fields: [
      {
        id: "desafio",
        kind: "choice",
        label: "Principal desafio",
        required: true,
        options: [
          { id: "atrair", label: "Atrair mais clientes" },
          { id: "converter", label: "Converter melhor quem já chega" },
          { id: "marca", label: "Fortalecer a marca" },
          { id: "presenca", label: "Ter presença digital profissional" },
          { id: "processos", label: "Organizar processos comerciais" },
          { id: "indefinido", label: "Ainda não sei dizer" },
        ],
      },
      {
        id: "desafioDetalhe",
        kind: "textarea",
        label: "Quer contar mais?",
        required: false,
        maxLength: 400,
        placeholder: "Se preferir, descreva em poucas palavras",
      },
    ],
  },
  {
    id: "destino",
    number: 4,
    name: "Seu destino",
    title: "Aonde você quer chegar?",
    description: "O destino define a direção de todo o resto",
    provisional: true,
    fields: [
      {
        id: "objetivo",
        kind: "choice",
        label: "Objetivo principal",
        required: true,
        options: [
          { id: "vender", label: "Vender mais" },
          { id: "reconhecimento", label: "Ser reconhecido na minha região" },
          { id: "lancamento", label: "Lançar um produto ou serviço" },
          { id: "site", label: "Ter um site que gere contatos" },
          { id: "escalar", label: "Escalar com previsibilidade" },
        ],
      },
      {
        id: "meta",
        kind: "text",
        label: "Uma meta para os próximos 90 dias",
        required: false,
        maxLength: 160,
        placeholder: "Ex.: dobrar os pedidos pelo WhatsApp",
      },
    ],
  },
  {
    id: "momento",
    number: 5,
    name: "Seu momento",
    title: "Qual é o seu momento?",
    description: "Prazo e investimento ajudam a indicar o próximo passo mais coerente",
    provisional: true,
    fields: [
      {
        id: "prazo",
        kind: "choice",
        label: "Quando pretende começar?",
        required: true,
        options: [
          { id: "agora", label: "Quero começar agora" },
          { id: "30dias", label: "Em até 30 dias" },
          { id: "90dias", label: "Em até 90 dias" },
          { id: "explorando", label: "Estou só explorando" },
        ],
      },
      {
        id: "investimento",
        kind: "choice",
        label: "Investimento mensal em marketing",
        required: true,
        options: [
          { id: "nenhum", label: "Ainda não invisto" },
          { id: "ate1500", label: "Até R$ 1.500" },
          { id: "1500a5000", label: "De R$ 1.500 a R$ 5.000" },
          { id: "acima5000", label: "Acima de R$ 5.000" },
          { id: "conversar", label: "Prefiro conversar sobre isso" },
        ],
      },
    ],
  },
  {
    id: "conexao",
    number: 6,
    name: "Sua conexão",
    title: "Como prefere conversar?",
    description: "Última escala: escolha o canal e confirme o envio",
    provisional: true,
    fields: [
      {
        id: "canal",
        kind: "choice",
        label: "Canal preferido",
        required: true,
        options: [
          { id: "whatsapp", label: "WhatsApp" },
          { id: "ligacao", label: "Ligação" },
          { id: "email", label: "E-mail" },
        ],
      },
      {
        id: "horario",
        kind: "choice",
        label: "Melhor horário",
        required: true,
        options: [
          { id: "manha", label: "Manhã" },
          { id: "tarde", label: "Tarde" },
          { id: "noite", label: "Noite" },
          { id: "qualquer", label: "Tanto faz" },
        ],
      },
      {
        id: "email",
        kind: "email",
        label: "E-mail",
        required: false,
        maxLength: 120,
        autoComplete: "email",
        inputMode: "email",
        placeholder: "voce@empresa.com.br",
      },
      {
        id: "consentimento",
        kind: "consent",
        label: "Concordo em compartilhar estas respostas com a Island Company para receber contato sobre o meu diagnóstico",
        required: true,
      },
    ],
  },
];

export const TOTAL_STAGES = STAGES.length;

export function getStage(index: number): Stage {
  const stage = STAGES[index];
  if (!stage) throw new RangeError(`Etapa inexistente: ${index}`);
  return stage;
}

export function allFields(): Field[] {
  return STAGES.flatMap((s) => s.fields);
}

export function findOptionLabel(fieldId: string, optionId: string): string | undefined {
  for (const field of allFields()) {
    if (field.id === fieldId && field.kind === "choice") {
      return field.options.find((o) => o.id === optionId)?.label;
    }
  }
  return undefined;
}
