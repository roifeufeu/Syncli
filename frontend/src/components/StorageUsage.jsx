import { useState } from "react";

const STORAGE_LIMIT_BYTES = 100 * 1024 * 1024;

function StorageUsage({ items }) {
  const [now] = useState(() => Date.now());
  const formatMo = (bytes) =>
    (bytes / (1024 * 1024)).toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    });

  // Calcul effectué au moment de l'affichage.

  const usedBytes = Array.isArray(items)
    ? items.reduce((total, item) => {
        // Seuls les images et fichiers comptent dans le quota.
        if (!["image", "file"].includes(item.type)) {
          return total;
        }

        // Ne pas compter les éléments expirés.
        const expiresAt = new Date(item.expires_at).getTime();

        if (!Number.isFinite(expiresAt) || expiresAt <= now) {
          return total;
        }

        // Taille enregistrée en base de données.
        const size = Number(item.file_size);

        if (!Number.isFinite(size) || size <= 0) {
          return total;
        }

        return total + size;
      }, 0)
    : null;

  const percentage =
    usedBytes !== null
      ? Math.min(100, (usedBytes / STORAGE_LIMIT_BYTES) * 100)
      : 0;

  return (
    <div>
      {usedBytes === null ? (
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Synchronisation de l'historique...
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-zinc-400">
              Espace utilisé
            </span>

            <span className="font-medium text-slate-700 dark:text-zinc-200">
              {formatMo(usedBytes)} / {formatMo(STORAGE_LIMIT_BYTES)} Mo
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
      )}
    </div>
  );
}

export default StorageUsage;
