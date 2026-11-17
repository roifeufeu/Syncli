import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";

function StorageUsage() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadUsage = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          throw new Error("Session indisponible");
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/storage/usage`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            signal: controller.signal,
          },
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Erreur de chargement");
        }

        if (!active) return;

        setUsage(data);
        setError("");
      } catch (err) {
        if (!active) return;

        setError(err.message || "Impossible de récupérer le stockage");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadUsage();

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryKey]);

  const formatMo = (bytes) =>
    (bytes / (1024 * 1024)).toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    });

  const percentage = usage ? Math.min(100, Math.max(0, usage.percentage)) : 0;

  const retry = () => {
    setLoading(true);
    setError("");
    setRetryKey((previous) => previous + 1);
  };

  return (
    <div>
      {loading ? (
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Chargement du stockage...
        </p>
      ) : error ? (
        <div>
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>

          <button
            type="button"
            onClick={retry}
            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <RefreshCw size={13} />
            Réessayer
          </button>
        </div>
      ) : usage ? (
        <>
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-zinc-400">
              Espace utilisé
            </span>

            <span className="font-medium text-slate-700 dark:text-zinc-200">
              {formatMo(usage.usedBytes)} / {formatMo(usage.limitBytes)} Mo
            </span>
          </div>

          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-700"
            role="progressbar"
            aria-label="Stockage utilisé"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage}
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
            Expiration automatique après 7 jours.
          </p>
        </>
      ) : null}
    </div>
  );
}

export default StorageUsage;
