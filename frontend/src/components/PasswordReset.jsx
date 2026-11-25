import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { supabase } from "../lib/supabase";

function PasswordReset({ onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading || success) return;

    setMessage("");

    if (password.length < 6 || password.length > 30) {
      setMessage("Le mot de passe doit contenir entre 6 et 30 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error("[Syncli Reset]", error);
        setMessage(
          error.code === "same_password"
            ? "Choisis un mot de passe différent de l'ancien."
            : "Impossible de modifier le mot de passe. Réessaie.",
        );
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (error) {
      console.error("[Syncli Reset]", error);
      setMessage("Impossible de contacter le serveur. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-5 text-center">
        <CheckCircle2
          size={44}
          className="mx-auto text-green-600 dark:text-green-400"
        />

        <p className="text-sm text-slate-600 dark:text-zinc-300">
          Votre mot de passe a été modifié avec succès.
        </p>

        <button
          type="button"
          onClick={onComplete}
          className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Continuer vers Syncli
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-slate-500 dark:text-zinc-400">
        Choisissez un nouveau mot de passe pour votre compte Syncli.
      </p>

      <div>
        <label
          htmlFor="reset-password"
          className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-200"
        >
          Nouveau mot de passe
        </label>

        <div className="relative">
          <LockKeyhole
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            id="reset-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nouveau mot de passe"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-500/20"
          />

          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={
              showPassword
                ? "Masquer les mots de passe"
                : "Afficher les mots de passe"
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="reset-confirm-password"
          className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-200"
        >
          Confirmer le mot de passe
        </label>

        <input
          id="reset-confirm-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirmez le mot de passe"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-500/20"
        />
      </div>

      {message && (
        <p
          role="alert"
          className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Modification en cours..." : "Modifier le mot de passe"}
      </button>
    </form>
  );
}

export default PasswordReset;
