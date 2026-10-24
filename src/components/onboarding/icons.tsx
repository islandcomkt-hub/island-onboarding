import type { ReactElement } from "react";

/** Ícones de linha (24×24, stroke) para os cards de resposta. Decorativos: sempre aria-hidden. */
const P: Record<string, ReactElement> = {
  // negócio
  varejo: <path d="M4 9l1.5-5h13L20 9M4 9v10h16V9M4 9h16M9 19v-5h6v5" />,
  servicos: <path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />,
  saude: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  alimentacao: <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 8h3" />,
  automotivo: <path d="M5 16l1.5-5h11L19 16M5 16v3h3v-2h8v2h3v-3M5 16h14M8 13.5h.01M16 13.5h.01" />,
  educacao: <path d="M3 8l9-4 9 4-9 4-9-4zM7 10.5V15c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5" />,
  outro: <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth="3" />,
  // estágio
  comecando: <path d="M12 21v-9M12 12c0-4 2.5-6 6-6 0 4-2 6-6 6zM12 15c0-3-2-4.5-5-4.5 0 3 1.8 4.5 5 4.5z" />,
  operando: <path d="M4 12h3l2-5 4 10 2-5h5" />,
  crescendo: <path d="M4 19h16M7 19v-5M12 19V9M17 19V5" />,
  reposicionando: <path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4" />,
  // desafio
  atrair: <path d="M5 4v6a7 7 0 0 0 14 0V4M5 7h4M15 7h4" />,
  converter: <path d="M4 5h16l-6 7v6l-4 2v-8L4 5z" />,
  marca: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />,
  presenca: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />,
  processos: <path d="M5 5h5v5H5zM14 14h5v5h-5zM10 7.5h4a2 2 0 0 1 2 2V14" />,
  indefinido: <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01" />,
  // destino
  vender: <path d="M4 17l5-5 4 4 7-8M15 8h5v5" />,
  reconhecimento: <path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10zM12 11h.01" strokeWidth="2.6" />,
  lancamento: <path d="M12 3c3 2 4.5 5 4.5 9l-2.2 2.5h-4.6L7.5 12C7.5 8 9 5 12 3zM9.7 14.5L8 19l4-1.5 4 1.5-1.7-4.5M12 9.5h.01" />,
  site: <path d="M3 5h18v14H3zM3 9h18M6 7h.01M9 7h.01" />,
  escalar: <path d="M4 20h4v-5h4v-5h4V5h4" />,
  // momento
  agora: <path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z" />,
  "30dias": <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />,
  "90dias": <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" />,
  explorando: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5 5-2z" />,
  nenhum: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12h8" />,
  ate1500: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v10M14.5 9.5c-.5-1-1.5-1.3-2.5-1.3-1.5 0-2.5.8-2.5 2s1 1.6 2.5 1.9 2.5.7 2.5 1.9-1 2-2.5 2c-1 0-2-.3-2.5-1.3" />,
  "1500a5000": <path d="M5 8h14v10H5zM5 12h14M9 5h6" />,
  acima5000: <path d="M12 4l7 4v4c0 4-3 7-7 8-4-1-7-4-7-8V8l7-4zM9 12l2 2 4-4" />,
  conversar: <path d="M4 5h16v11H9l-5 4V5z" />,
  // conexão
  whatsapp: <path d="M4 20l1.3-4.2A8 8 0 1 1 8.2 19L4 20zM9 9c0 3.5 2.5 6 6 6l1-1.5-2-1-1 .8c-1-.4-1.8-1.200-2.200-2.200l.8-1-1-2L9 9z" />,
  ligacao: <path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4c0 1-1 2-2 2A15 15 0 0 1 3 6c0-1 1-2 2-2z" />,
  email: <path d="M3 6h18v12H3zM3 7l9 7 9-7" />,
  manha: <path d="M12 4v2M5.600 7.600l1.400 1.400M3 15h18M5 19h14M17 9l1.400-1.400M8 15a4 4 0 0 1 8 0" />,
  tarde: <path d="M12 3v2M4.900 5.900l1.400 1.400M19.100 5.900l-1.400 1.400M3 12h2M19 12h2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM6 20h12" />,
  noite: <path d="M20 14.500A8 8 0 0 1 9.500 4 8 8 0 1 0 20 14.500z" />,
  qualquer: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" />,
};
const FALLBACK = <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />;

export default function OptionIcon({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[id] ?? FALLBACK}
    </svg>
  );
}
