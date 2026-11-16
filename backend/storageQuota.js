const { createClient } = require("@supabase/supabase-js");

// Quota de stockage par utilisateur : 100 Mo
const STORAGE_LIMIT_BYTES = 100 * 1024 * 1024;

// Créer un client Supabase lié à l'utilisateur connecté.
function createUserSupabase(accessToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

// Récupérer l'espace utilisé par un compte.
async function getStorageUsage(accessToken) {
  const userSupabase = createUserSupabase(accessToken);

  const { data, error } = await userSupabase.rpc("syncli_storage_usage");

  if (error) {
    throw new Error(`Impossible de calculer le stockage : ${error.message}`);
  }

  const usedBytes = Number(data ?? 0);

  if (!Number.isSafeInteger(usedBytes) || usedBytes < 0) {
    throw new Error("Valeur de stockage invalide");
  }

  return {
    usedBytes,
    limitBytes: STORAGE_LIMIT_BYTES,
    availableBytes: Math.max(0, STORAGE_LIMIT_BYTES - usedBytes),
    percentage: Math.round((usedBytes / STORAGE_LIMIT_BYTES) * 10000) / 100,
  };
}

async function requireStorageQuota(req, res, next) {
  if (!req.file) {
    return next();
  }

  try {
    const usage = await getStorageUsage(req.accessToken);

    // Vérifier si le nouveau fichier dépasse l'espace disponible.
    if (req.file.size > usage.availableBytes) {
      const availableMo = (usage.availableBytes / (1024 * 1024)).toLocaleString(
        "fr-FR",
        {
          maximumFractionDigits: 2,
        },
      );

      return res.status(409).json({
        success: false,
        error: `Stockage insuffisant : ${availableMo} Mo disponibles sur 100 Mo.`,
      });
    }

    // Le quota permet l'envoi.
    next();
  } catch (error) {
    console.error("Erreur vérification quota :", error);

    return res.status(500).json({
      success: false,
      error: "Impossible de vérifier le stockage disponible.",
    });
  }
}

module.exports = {
  STORAGE_LIMIT_BYTES,
  getStorageUsage,
  requireStorageQuota,
};
