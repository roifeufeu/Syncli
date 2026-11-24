import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, LockKeyhole, Mail, X } from "lucide-react";
import { supabase } from "../lib/supabase";

function AuthModal({ open, onClose }) {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  const changeMode = (mode) => {
    setAuthMode(mode);
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        onClose();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (data.session) {
          onClose();
        } else {
          setMessage(
            "Inscription enregistrée. Vérifie ton e-mail si une confirmation est demandée.",
          );
        }
      }
    } catch (error) {
      setMessage(error.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
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
            {authMode === "login" ? "Bon retour !" : "Créer un compte"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <X size={21} />
          </button>
        </div>

        <p className="mb-6 text-sm text-slate-500 dark:text-zinc-400">
          {authMode === "login"
            ? "Connectez-vous pour retrouver vos éléments."
            : "Créez votre espace presse-papiers personnel."}
        </p>

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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="modal-email"
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-200"
            >
              Adresse e-mail
            </label>

            <div className="relative">
              <Mail
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="modal-email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="exemple@email.com"
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
                type="password"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Votre mot de passe"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-500/20"
              />
            </div>
          </div>

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
      </div>
    </div>,
    document.body,
  );
}

export default AuthModal;
