const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5531988690118";

/**
 * Texto de privacidade (fonte única): usado no diálogo e no card recolhível da etapa final.
 * Texto baseado no painel "Seus dados, com clareza" do site atual (auditado em 20/10/2026).
 * REVISÃO JURÍDICA/CLIENTE necessária antes de produção.
 */
export default function PrivacyText() {
  return (
    <>
      <p>
        A Island Company usa seus dados de contato, respostas e origem da visita para entender seu negócio, organizar o atendimento e conversar sobre
        sua solicitação.
      </p>
      <p>
        O rascunho fica neste navegador. Ao finalizar, suas respostas são enviadas para a base da Island. Não enviamos o diagnóstico completo ao
        WhatsApp: você escolhe enviar uma mensagem com seu primeiro nome, empresa, objetivo e referência da jornada.
      </p>
      <p>
        Os dados permanecem na base enquanto necessários ao atendimento da solicitação. Para consultar, corrigir ou solicitar a exclusão, fale com a
        Island pelo{" "}
        <a className="linklike" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">
          WhatsApp (31) 98869-0118
        </a>
        .
      </p>
      <p>Apagar o rascunho remove apenas a cópia deste dispositivo. Este formulário não instala pixels de publicidade nem compartilha suas respostas com plataformas de anúncios.</p>
    </>
  );
}
