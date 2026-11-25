import { useState } from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { supabase } from "../lib/supabase";

function PasswordRecovery({ onBack }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading || sent) return;

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/`,
        },
      );

      if (error) {
        console.error("[Syncli Recovery]", error);

        if (error.status === 429) {
          setMessage("Trop de demandes. Réessaie un peu plus tard.");
        } else {
          setMessage("Impossible d'envoyer l'e-mail. Réessaie.");
        }

        return;
      }

      setSent(true);
      setMessage(
        "Si cette adresse est associée à un compte Syncli, un lien de récupération lui sera envoyé.",
      );
    } catch (error) {
      console.error("[Syncli Recovery]", error);

      setMessage("Impossible de contacter le serveur. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="mb-6 text-sm text-slate-500 dark:text-zinc-400">
        Saisissez l'adresse e-mail associée à votre compte pour recevoir un lien
        de réinitialisation.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="recovery-email"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-200"
          >
            Adresse e-mail
          </label>

          <div className="relative">
            <Mail
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
            />

            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              required
              disabled={loading || sent}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="exemple@email.com"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        {message && (
          <p
            role={sent ? "status" : "alert"}
            className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || sent}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {loading
            ? "Envoi en cours..."
            : sent
              ? "Demande envoyée"
              : "Envoyer le lien"}

          {!loading && !sent && <ArrowRight size={18} />}
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        <ArrowLeft size={17} />
        Retour à la connexion
      </button>
    </div>
  );
}

export default PasswordRecovery;
