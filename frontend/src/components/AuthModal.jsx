import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, LockKeyhole, Mail, X, Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import PasswordRecovery from "./PasswordRecovery";
import PasswordReset from "./PasswordReset";

function getAuthErrorMessage(error) {
  if (error instanceof TypeError) {
    return "Impossible de contacter le serveur. Vérifie ta connexion.";
  }

  switch (error?.code) {
    case "invalid_credentials":
      return "Adresse e-mail ou mot de passe incorrect.";

    case "email_not_confirmed":
      return "Cette adresse e-mail n'a pas encore été confirmée.";

    case "email_exists":
    case "user_already_exists":
      return "Un compte existe déjà avec cette adresse e-mail.";

    case "weak_password":
      return "Ce mot de passe ne respecte pas les règles de sécurité.";

    case "email_address_invalid":
      return "Cette adresse e-mail n'est pas valide.";

    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Réessaie un peu plus tard.";

    case "signup_disabled":
      return "Les inscriptions sont temporairement désactivées.";

    default:
      return "Une erreur est survenue. Réessaie.";
  }
}

function AuthModal({
  open,
  onClose,
  passwordReset = false,
  onPasswordResetComplete,
}) {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event) => {
      if (event.key === "Escape" && !passwordReset) {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose, passwordReset]);

  if (!open) return null;

  const changeMode = (mode) => {
    setAuthMode(mode);
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setMessage("");

    const cleanUsername = username.trim();

    // Vérifications uniquement à l'inscription
    if (authMode === "register") {
      if (!/^[A-Za-z0-9_]{3,30}$/.test(cleanUsername)) {
        setMessage(
          "Le pseudo doit contenir entre 3 et 30 caractères : lettres, chiffres et underscores uniquement.",
        );
        return;
      }

      if (password.length < 6 || password.length > 30) {
        setMessage("Le mot de passe doit contenir entre 6 et 30 caractères.");
        return;
      }
    }

    setLoading(true);

    try {
      if (authMode === "login") {
        // Connexion par pseudo ou adresse e-mail
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/auth/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              identifier: email.trim(),
              password,
            }),
          },
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          setMessage(data?.error || "Impossible de se connecter. Réessaie.");
          return;
        }

        if (!data?.access_token || !data?.refresh_token) {
          setMessage("Réponse de connexion invalide.");
          return;
        }

        // Enregistrer la session dans le client Supabase du frontend
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (sessionError) {
          setMessage("Impossible d'ouvrir la session. Réessaie.");
          return;
        }

        onClose();
      } else {
        // INSCRIPTION

        // 1. Vérifier si le pseudo est disponible
        const { data: isAvailable, error: availabilityError } =
          await supabase.rpc("is_username_available", {
            candidate_username: cleanUsername,
          });

        if (availabilityError) {
          console.error("[Syncli] Vérification du pseudo :", availabilityError);

          setMessage(
            "Impossible de vérifier la disponibilité du pseudo. Réessaie.",
          );
          return;
        }

        if (!isAvailable) {
          setMessage("Ce pseudo est déjà utilisé. Choisis-en un autre.");
          return;
        }

        // 2. Créer le compte uniquement si le pseudo est disponible
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              syncli_signup_username: cleanUsername,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          onClose();
        } else {
          setMessage(
            "Compte créé, mais la session n'a pas été ouverte. Essaie de te connecter.",
          );
        }
      }
    } catch (error) {
      console.error("[Syncli Auth]", error);
      setMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !loading &&
          !passwordReset
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2
            id="auth-modal-title"
            className="text-2xl font-semibold text-slate-900 dark:text-zinc-50"
          >
            {passwordReset
              ? "Nouveau mot de passe"
              : authMode === "login"
                ? "Se connecter"
                : authMode === "register"
                  ? "Créer un compte"
                  : "Mot de passe oublié"}
          </h2>

          {!passwordReset && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Fermer"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <X size={21} />
            </button>
          )}
        </div>

        {!passwordReset && authMode !== "recovery" && (
          <p className="mb-6 text-sm text-slate-500 dark:text-zinc-400">
            {authMode === "login"
              ? "Connectez-vous pour retrouver vos éléments."
              : "Créez votre espace presse-papiers personnel."}
          </p>
        )}

        {!passwordReset && authMode !== "recovery" && (
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-zinc-800">
            {[
              { value: "login", label: "Connexion" },
              { value: "register", label: "Inscription" },
            ].map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => changeMode(mode.value)}
                disabled={loading}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  authMode === mode.value
                    ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
                    : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}

        {passwordReset ? (
          <PasswordReset onComplete={onPasswordResetComplete} />
        ) : authMode === "recovery" ? (
          <PasswordRecovery onBack={() => changeMode("login")} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              {/* Pseudo : uniquement pendant l'inscription */}
              {authMode === "register" && (
                <div className="mb-5">
                  <label
                    htmlFor="modal-username"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-200"
                  >
                    Pseudo
                  </label>

                  <input
                    id="modal-username"
                    type="text"
                    autoComplete="username"
                    required
                    maxLength={30}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Choisissez votre pseudo"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-blue-500/20"
                  />
                </div>
              )}

              <label
                htmlFor="modal-email"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-200"
              >
                {authMode === "login" ? "Pseudo ou e-mail" : "Adresse e-mail"}
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="modal-email"
                  type={authMode === "login" ? "text" : "email"}
                  autoComplete={authMode === "login" ? "username" : "email"}
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={
                    authMode === "login"
                      ? "Pseudo ou adresse e-mail"
                      : "exemple@email.com"
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="modal-password"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-200"
              >
                Mot de passe
              </label>

              <div className="relative">
                <LockKeyhole
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="modal-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    authMode === "login" ? "current-password" : "new-password"
                  }
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Votre mot de passe"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-500/20"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  title={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            {authMode === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => changeMode("recovery")}
                  className="text-sm font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            {message && (
              <p
                role="status"
                className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading
                ? "Chargement..."
                : authMode === "login"
                  ? "Se connecter"
                  : "Créer mon compte"}

              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default AuthModal;
