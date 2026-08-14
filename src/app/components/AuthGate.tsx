import { useEffect, useState, type ReactNode } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";

/**
 * Porta de entrada de autenticação da nova UI. Usa o mesmo cliente Supabase
 * (lib/supabase.ts) e o mesmo fluxo de login "Entrar com Google" já usado na
 * versão anterior do app (ver App.tsx raiz, por volta da linha 4777).
 *
 * Além da sessão do Supabase Auth, também exige uma linha em `profiles` para
 * o usuário logado — sem isso, qualquer conta Google conseguia entrar e usar
 * o app inteiro, mesmo sem cargo/acesso concedido por um admin em "Gestão de
 * Usuários" (ver api/admin/users.ts).
 */
function FullScreenMessage({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        padding: 16,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#111" }}>
          {title}
        </h1>
        <p style={{ fontFamily: "Montserrat, sans-serif", fontSize: 13, color: "rgba(0,0,0,0.6)", marginBottom: 24 }}>
          {message}
        </p>
        {children}
      </div>
    </div>
  );
}

// Em desenvolvimento local (localhost/127.0.0.1) pula a tela de login,
// para agilizar testes sem depender de uma conta Google/Supabase válida.
const SKIP_LOGIN_LOCALHOST =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  if (SKIP_LOGIN_LOCALHOST) {
    console.warn("[AuthGate] Login pulado: ambiente localhost detectado.");
    return <>{children}</>;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      console.log("[AuthGate] getSession() inicial:", { user: data.session?.user?.email, error });
      setSession(data.session);
      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("[AuthGate] onAuthStateChange:", event, newSession?.user?.email);
      setSession(newSession);
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setHasAccess(null);
      setCheckError(null);
      return;
    }
    let cancelled = false;
    setHasAccess(null);
    setCheckError(null);
    supabase
      .from("profiles")
      .select("role, is_master")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[AuthGate] Erro ao verificar perfil:", error);
          setCheckError(error.message || "Erro ao verificar permissões.");
          return;
        }
        setHasAccess(!!data && (!!data.role || !!data.is_master));
      });
    return () => {
      cancelled = true;
    };
  }, [session, retryCount]);

  if (checking) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
        }}
      >
        <span style={{ fontFamily: "Montserrat, sans-serif", fontSize: 13, color: "rgba(0,0,0,0.6)" }}>
          Verificando acesso...
        </span>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          padding: 16,
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          <h1
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: 26,
              fontWeight: 700,
              textAlign: "center",
              marginBottom: 8,
              color: "#111",
            }}
          >
            Bem-vindo
          </h1>
          <p
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: 13,
              color: "rgba(0,0,0,0.6)",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            Faça login para acessar o Gestor de Agentes
          </p>
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              style: {
                button: {
                  backgroundColor: "#000",
                  color: "#fff",
                  borderRadius: "8px",
                },
              },
            }}
            theme="default"
            providers={["google"]}
            onlyThirdPartyProviders
            view="sign_in"
            showLinks={false}
            redirectTo={window.location.origin}
            localization={{ variables: { sign_in: { social_provider_text: "Entrar com Google" } } }}
          />
        </div>
      </div>
    );
  }

  if (checkError) {
    return (
      <FullScreenMessage
        title="Erro ao verificar acesso"
        message={`Não foi possível confirmar suas permissões (${checkError}). Isso não significa que seu acesso foi negado — tente novamente.`}
      >
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={() => setRetryCount(c => c + 1)}
            style={{
              height: 38,
              padding: "0 20px",
              borderRadius: 8,
              border: "none",
              background: "#000",
              color: "#fff",
              cursor: "pointer",
              fontFamily: "Montserrat, sans-serif",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Tentar novamente
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              height: 38,
              padding: "0 20px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "white",
              cursor: "pointer",
              fontFamily: "Montserrat, sans-serif",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Sair
          </button>
        </div>
      </FullScreenMessage>
    );
  }

  if (hasAccess === null) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
        }}
      >
        <span style={{ fontFamily: "Montserrat, sans-serif", fontSize: 13, color: "rgba(0,0,0,0.6)" }}>
          Verificando permissões...
        </span>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <FullScreenMessage
        title="Acesso Bloqueado"
        message="Entre em contato com o Administrador."
      >
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            height: 38,
            padding: "0 20px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.2)",
            background: "white",
            cursor: "pointer",
            fontFamily: "Montserrat, sans-serif",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Sair
        </button>
      </FullScreenMessage>
    );
  }

  return <>{children}</>;
}
