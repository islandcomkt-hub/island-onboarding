import OnboardingApp from "@/components/onboarding/OnboardingApp";

export default function Page() {
  return (
    <>
      <OnboardingApp />
      <noscript>
        <p style={{ position: "fixed", inset: "auto 12px 12px", padding: 14, background: "#10051f", border: "1px solid #444", borderRadius: 12, zIndex: 10 }}>
          Ative o JavaScript para mapear sua rota ou{" "}
          <a href="https://wa.me/5531988690118" style={{ color: "#00c85a" }}>
            fale com a Island pelo WhatsApp
          </a>
          .
        </p>
      </noscript>
    </>
  );
}
