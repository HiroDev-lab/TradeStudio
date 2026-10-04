import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

/**
 * Porta de entrada de autenticação (Supabase Auth).
 *
 * Login por e-mail e senha. Ninguém se cadastra sozinho: quem cria a conta é
 * um gestor, em "Gestão de Usuários" (api/admin-users.ts), que recebe uma
 * senha provisória para repassar. No primeiro acesso a pessoa é obrigada a
 * trocar essa senha.
 *
 * "Entrar com Google" continua disponível, mas só aparece com
 * VITE_GOOGLE_LOGIN=true — depende de um cliente OAuth configurado no Supabase.
 *
 * Além da sessão, exige uma linha em `profiles` para o usuário logado: sem
 * cargo concedido, a pessoa fica na tela de "Acesso Bloqueado".
 */

const GOOGLE_LOGIN_ENABLED = import.meta.env.VITE_GOOGLE_LOGIN === "true";
const MIN_PASSWORD_LENGTH = 8;

const FONT = "Montserrat, sans-serif";

const inputStyle: CSSProperties = {
  width: "100%",
  height: 42,
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.2)",
  padding: "0 12px",
  fontFamily: FONT,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  background: "white",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontFamily: FONT,
  fontSize: 11,
  fontWeight: 600,
  color: "rgba(0,0,0,0.68)",
  marginBottom: 6,
  textAlign: "left",
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  height: 42,
  borderRadius: 8,
  border: "none",
  background: "#000",
  color: "#fff",
  cursor: "pointer",
  fontFamily: FONT,
  fontSize: 13,
  fontWeight: 600,
};

const secondaryButtonStyle: CSSProperties = {
  height: 38,
  padding: "0 20px",
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "white",
  cursor: "pointer",
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 600,
};

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
        <h1 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#111" }}>
          {title}
        </h1>
        <p style={{ fontFamily: FONT, fontSize: 13, color: "rgba(0,0,0,0.6)", marginBottom: 24 }}>
          {message}
        </p>
        {children}
      </div>
    </div>
  );
}

function LoadingScreen({ text }: { text: string }) {
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
      <span style={{ fontFamily: FONT, fontSize: 13, color: "rgba(0,0,0,0.6)" }}>{text}</span>
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontFamily: FONT, fontSize: 12, color: "#d92d20", margin: "0 0 12px", textAlign: "left" }}>
      {children}
    </p>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : `Não foi possível entrar (${signInError.message}).`
      );
      setSubmitting(false);
    }
    // Em caso de sucesso o onAuthStateChange do AuthGate troca de tela.
  }

  return (
    <FullScreenMessage title="Bem-vindo" message="Faça login para acessar o Gestor de Agentes">
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="login-email" style={labelStyle}>E-MAIL</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label htmlFor="login-password" style={labelStyle}>SENHA</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {GOOGLE_LOGIN_ENABLED && (
        <button
          type="button"
          onClick={() =>
            supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })
          }
          style={{ ...secondaryButtonStyle, width: "100%", height: 42, marginTop: 12 }}
        >
          Entrar com Google
        </button>
      )}

      <p style={{ fontFamily: FONT, fontSize: 11, color: "rgba(0,0,0,0.5)", marginTop: 20 }}>
        Ainda não tem acesso ou esqueceu a senha? Fale com o administrador.
      </p>
    </FullScreenMessage>
  );
}

function ChangePasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("As duas senhas não são iguais.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    if (updateError) {
      setError(
        updateError.code === "same_password"
          ? "A nova senha precisa ser diferente da senha provisória."
          : `Não foi possível salvar a senha (${updateError.message}).`
      );
      setSubmitting(false);
    }
    // Em caso de sucesso o onAuthStateChange (USER_UPDATED) libera o app.
  }

  return (
    <FullScreenMessage
      title="Crie sua senha"
      message="Você entrou com uma senha provisória. Escolha uma senha só sua para continuar."
    >
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="new-password" style={labelStyle}>NOVA SENHA</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label htmlFor="confirm-password" style={labelStyle}>REPITA A NOVA SENHA</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            style={inputStyle}
          />
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Salvando..." : "Salvar e continuar"}
        </button>
      </form>
      <button onClick={() => supabase.auth.signOut()} style={{ ...secondaryButtonStyle, marginTop: 12 }}>
        Sair
      </button>
    </FullScreenMessage>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
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
      .eq("id", userId)
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
  }, [userId, retryCount]);

  if (checking) {
    return <LoadingScreen text="Verificando acesso..." />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (session.user.user_metadata?.must_change_password) {
    return <ChangePasswordScreen />;
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
            style={{ ...secondaryButtonStyle, border: "none", background: "#000", color: "#fff" }}
          >
            Tentar novamente
          </button>
          <button onClick={() => supabase.auth.signOut()} style={secondaryButtonStyle}>
            Sair
          </button>
        </div>
      </FullScreenMessage>
    );
  }

  if (hasAccess === null) {
    return <LoadingScreen text="Verificando permissões..." />;
  }

  if (!hasAccess) {
    return (
      <FullScreenMessage title="Acesso Bloqueado" message="Entre em contato com o Administrador.">
        <button onClick={() => supabase.auth.signOut()} style={secondaryButtonStyle}>
          Sair
        </button>
      </FullScreenMessage>
    );
  }

  return <>{children}</>;
}
