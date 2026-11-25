require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { getStorageUsage, requireStorageQuota } = require("./storageQuota");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
);

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: "utf8",

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 Mo maximum
  },

  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Le fichier doit être une image"));
    }

    cb(null, true);
  },
});

const MAX_FILE_SIZE = 20 * 1000 * 1000; // 20 Mo

const allowedFileFormats = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
};

const uploadFile = multer({
  storage: multer.memoryStorage(),
  defParamCharset: "utf8",

  limits: {
    fileSize: MAX_FILE_SIZE,
  },

  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!Object.hasOwn(allowedFileFormats, extension)) {
      return cb(new Error("Format de fichier non autorisé"));
    }

    cb(null, true);
  },
}).single("file");

// Vérification élémentaire de la signature du fichier.
// Elle ne remplace pas une analyse complète du contenu.
function isValidFileSignature(buffer, extension) {
  if (!buffer || buffer.length === 0) return false;

  const zipSignature =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[2] === 0x05 && buffer[3] === 0x06));

  const officeOpenXml = [".docx", ".xlsx", ".pptx"];

  if (extension === ".zip" || officeOpenXml.includes(extension)) {
    return zipSignature;
  }

  if (extension === ".pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  if ([".doc", ".xls", ".ppt"].includes(extension)) {
    const oleSignature = Buffer.from("d0cf11e0a1b11ae1", "hex");

    return buffer.length >= 8 && buffer.subarray(0, 8).equals(oleSignature);
  }

  if ([".txt", ".csv"].includes(extension)) {
    return !buffer.subarray(0, 4096).includes(0);
  }

  return false;
}

const allowedOrigins = (process.env.FRONTEND_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  }),
);

app.use(express.json());

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Token manquant",
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Token manquant",
    });
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: "Utilisateur non authentifié",
      });
    }

    req.user = user;
    req.accessToken = token;

    next();
  } catch (error) {
    next(error);
  }
}

app.get("/storage/usage", requireAuth, async (req, res) => {
  try {
    const usage = await getStorageUsage(req.accessToken);

    return res.json({
      success: true,
      ...usage,
    });
  } catch (error) {
    console.error("Erreur récupération stockage :", error);

    return res.status(500).json({
      success: false,
      error: "Impossible de récupérer le stockage utilisé",
    });
  }
});

app.get("/", (req, res) => {
  res.json({ message: "Backend OK" });
});

/*
 * Connexion avec un pseudo OU une adresse e-mail.
 * Le mot de passe est toujours vérifié par Supabase Auth.
 */
app.post("/auth/login", async (req, res) => {
  const { identifier, password } = req.body || {};

  const invalidCredentials = () =>
    res.status(401).json({
      success: false,
      error: "Identifiant ou mot de passe incorrect.",
    });

  if (
    typeof identifier !== "string" ||
    typeof password !== "string" ||
    !identifier.trim() ||
    !password
  ) {
    return invalidCredentials();
  }

  const cleanIdentifier = identifier.trim();

  try {
    let email = cleanIdentifier;

    // Si l'identifiant ne contient pas @, c'est un pseudo.
    if (!cleanIdentifier.includes("@")) {
      if (!/^[A-Za-z0-9_]{3,30}$/.test(cleanIdentifier)) {
        return invalidCredentials();
      }

      // Retrouver l'ID associé au pseudo.
      const { data: userId, error: lookupError } = await adminSupabase.rpc(
        "get_profile_id_for_login",
        {
          candidate_username: cleanIdentifier,
        },
      );

      if (lookupError) {
        console.error("Erreur recherche pseudo :", lookupError);

        return res.status(500).json({
          success: false,
          error: "Connexion momentanément indisponible.",
        });
      }

      if (!userId) {
        return invalidCredentials();
      }

      // Retrouver l'e-mail, uniquement côté backend.
      const { data: userData, error: userError } =
        await adminSupabase.auth.admin.getUserById(userId);

      if (userError || !userData?.user?.email) {
        console.error("Erreur récupération compte :", userError);

        return res.status(500).json({
          success: false,
          error: "Connexion momentanément indisponible.",
        });
      }

      email = userData.user.email;
    }

    // Client isolé pour chaque tentative de connexion.
    // On ne connecte jamais l'utilisateur au client administrateur.
    const loginSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    const { data, error } = await loginSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.status === 429) {
        return res.status(429).json({
          success: false,
          error: "Trop de tentatives. Réessaie plus tard.",
        });
      }

      return invalidCredentials();
    }

    if (!data?.session?.access_token || !data.session.refresh_token) {
      return invalidCredentials();
    }

    // Les jetons permettront au frontend d'ouvrir
    // la session avec son propre client Supabase.
    return res.json({
      success: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (error) {
    console.error("Erreur connexion :", error);

    return res.status(500).json({
      success: false,
      error: "Connexion momentanément indisponible.",
    });
  }
});

app.post("/items/text", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Token manquant",
    });
  }

  const token = authHeader.split(" ")[1];

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({
      success: false,
      error: "Utilisateur non authentifié",
    });
  }

  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: "Le texte est vide",
    });
  }

  const userSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { data, error } = await userSupabase
    .from("clipboard_items")
    .insert({
      user_id: user.id,
      type: "text",
      text_content: text,
    })
    .select()
    .single();

  if (error) {
    console.error("Erreur enregistrement texte :", error);

    return res.status(500).json({
      success: false,
      error: "Impossible d'enregistrer le texte. Réessaie.",
    });
  }

  res.status(201).json({
    success: true,
    message: "Texte enregistré",
    item: data,
  });
});

app.patch("/items/:id", requireAuth, async (req, res) => {
  try {
    const { text } = req.body;

    // Vérifier le nouveau contenu
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Le texte ne peut pas être vide",
      });
    }

    // Client Supabase authentifié avec le compte connecté
    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${req.accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    // Modifier uniquement le texte de l'utilisateur
    const { data, error } = await userSupabase
      .from("clipboard_items")
      .update({
        text_content: text,
      })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .eq("type", "text")
      .gt("expires_at", new Date().toISOString())
      .select()
      .maybeSingle();

    if (error) {
      console.error("Erreur modification texte :", error);

      return res.status(500).json({
        success: false,
        error: "Impossible de modifier le texte",
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Texte introuvable, expiré ou non autorisé",
      });
    }

    return res.json({
      success: true,
      message: "Texte modifié",
      item: data,
    });
  } catch (error) {
    console.error("Erreur PATCH texte :", error);

    return res.status(500).json({
      success: false,
      error: "Une erreur est survenue lors de la modification",
    });
  }
});

app.post(
  "/items/image",
  requireAuth,
  upload.single("image"),
  requireStorageQuota,
  async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Token manquant",
      });
    }

    const token = authHeader.split(" ")[1];

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: "Utilisateur non authentifié",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Aucune image envoyée",
      });
    }

    let detectedType;

    try {
      const { fileTypeFromBuffer } = await import("file-type");
      detectedType = await fileTypeFromBuffer(req.file.buffer);
    } catch (error) {
      console.error("Erreur de vérification du fichier :", error);

      return res.status(500).json({
        success: false,
        error: "Impossible de vérifier le fichier",
      });
    }

    const allowedImageTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

    if (!detectedType || !allowedImageTypes.has(detectedType.mime)) {
      return res.status(400).json({
        success: false,
        error: "Format non autorisé (JPG, PNG, WebP ou GIF)",
      });
    }

    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    const fileName = `${crypto.randomUUID()}.${detectedType.ext}`;
    const storagePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await userSupabase.storage
      .from("clipboard-images")
      .upload(storagePath, req.file.buffer, {
        contentType: detectedType.mime,
        upsert: false,
      });

    if (uploadError) {
      console.error("Erreur upload image :", uploadError);

      return res.status(500).json({
        success: false,
        error: "Impossible d'envoyer l'image. Réessaie.",
      });
    }

    const { data, error: databaseError } = await userSupabase
      .from("clipboard_items")
      .insert({
        user_id: user.id,
        type: "image",
        storage_path: storagePath,
        original_filename: req.file.originalname,
        mime_type: detectedType.mime,
        file_size: req.file.size,
      })
      .select()
      .single();

    if (databaseError) {
      console.error("Erreur enregistrement image :", databaseError);

      // Supprimer l'image envoyée si l'enregistrement BDD échoue
      const { error: cleanupError } = await userSupabase.storage
        .from("clipboard-images")
        .remove([storagePath]);

      if (cleanupError) {
        console.error("Erreur nettoyage image :", cleanupError);
      }

      if (databaseError.message?.includes("STORAGE_QUOTA_EXCEEDED")) {
        return res.status(409).json({
          success: false,
          error: "Quota de stockage de 100 Mo atteint.",
        });
      }

      return res.status(500).json({
        success: false,
        error: "Impossible d'enregistrer l'image. Réessaie.",
      });
    }

    res.status(201).json({
      success: true,
      message: "Image enregistrée",
      item: data,
    });
  },
);

app.post(
  "/items/file",
  requireAuth,

  // Gestion des erreurs spécifiques aux documents
  (req, res, next) => {
    uploadFile(req, res, (error) => {
      if (!error) return next();

      if (
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE"
      ) {
        return res.status(413).json({
          success: false,
          error: "Fichier trop volumineux (20 Mo maximum)",
        });
      }

      return res.status(400).json({
        success: false,
        error: error.message || "Fichier invalide",
      });
    });
  },

  requireStorageQuota,

  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Aucun fichier envoyé",
      });
    }

    const extension = path.extname(req.file.originalname).toLowerCase();

    const mimeType = allowedFileFormats[extension];

    if (!mimeType || !isValidFileSignature(req.file.buffer, extension)) {
      return res.status(400).json({
        success: false,
        error: "Le fichier ne correspond pas à un format autorisé",
      });
    }

    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${req.accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    const fileName = `${crypto.randomUUID()}${extension}`;
    const storagePath = `${req.user.id}/${fileName}`;

    // 1. Enregistrer le fichier dans Storage
    const { error: uploadError } = await userSupabase.storage
      .from("clipboard-files")
      .upload(storagePath, req.file.buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Erreur upload fichier :", uploadError);

      return res.status(500).json({
        success: false,
        error: "Impossible d'envoyer le fichier",
      });
    }

    // 2. Enregistrer les métadonnées dans PostgreSQL
    const { data, error: databaseError } = await userSupabase
      .from("clipboard_items")
      .insert({
        user_id: req.user.id,
        type: "file",
        storage_path: storagePath,
        original_filename: req.file.originalname,
        mime_type: mimeType,
        file_size: req.file.size,
      })
      .select()
      .single();

    if (databaseError) {
      console.error("Erreur BDD fichier :", databaseError);

      // Nettoyer le fichier si l'insertion échoue
      const { error: cleanupError } = await userSupabase.storage
        .from("clipboard-files")
        .remove([storagePath]);

      if (cleanupError) {
        console.error("Erreur nettoyage fichier :", cleanupError);
      }

      if (databaseError.message?.includes("STORAGE_QUOTA_EXCEEDED")) {
        return res.status(409).json({
          success: false,
          error: "Quota de stockage de 100 Mo atteint.",
        });
      }

      return res.status(500).json({
        success: false,
        error: "Impossible d'enregistrer le fichier",
      });
    }

    // 3. Confirmation
    return res.status(201).json({
      success: true,
      message: "Fichier enregistré",
      item: data,
    });
  },
);

app.get("/items", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Token manquant",
    });
  }

  const token = authHeader.split(" ")[1];

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({
      success: false,
      error: "Utilisateur non authentifié",
    });
  }

  const userSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { data, error } = await userSupabase
    .from("clipboard_items")
    .select("*")
    .eq("type", "text")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }

  res.json({
    success: true,
    items: data,
  });
});

app.get("/items/images", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Token manquant",
    });
  }

  const token = authHeader.split(" ")[1];

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({
      success: false,
      error: "Utilisateur non authentifié",
    });
  }

  const userSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { data: items, error } = await userSupabase
    .from("clipboard_items")
    .select("*")
    .eq("type", "image")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }

  const images = await Promise.all(
    items.map(async (item) => {
      const { data, error: signedUrlError } = await userSupabase.storage
        .from("clipboard-images")
        .createSignedUrl(item.storage_path, 3600);

      if (signedUrlError) {
        return {
          ...item,
          image_url: null,
        };
      }

      return {
        ...item,
        image_url: data.signedUrl,
      };
    }),
  );

  res.json({
    success: true,
    items: images,
  });
});

app.get("/items/history", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Token manquant",
    });
  }

  const token = authHeader.split(" ")[1];

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({
      success: false,
      error: "Utilisateur non authentifié",
    });
  }

  const userSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { data: items, error } = await userSupabase
    .from("clipboard_items")
    .select("*")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur récupération historique :", error);

    return res.status(500).json({
      success: false,
      error: "Impossible de charger l'historique. Réessaie.",
    });
  }

  const history = await Promise.all(
    items.map(async (item) => {
      // Les textes n'ont pas de fichier à télécharger.
      if (!item.storage_path) {
        return item;
      }

      // Choisir le bucket selon le type.
      const bucket =
        item.type === "image"
          ? "clipboard-images"
          : item.type === "file"
            ? "clipboard-files"
            : null;

      if (!bucket) {
        return item;
      }

      // Générer un lien temporaire valable une heure.
      const { data, error: signedUrlError } = await userSupabase.storage
        .from(bucket)
        .createSignedUrl(item.storage_path, 3600);

      if (signedUrlError) {
        console.error("Erreur génération URL :", signedUrlError);

        return {
          ...item,
          image_url: null,
          file_url: null,
        };
      }

      return {
        ...item,
        ...(item.type === "image"
          ? { image_url: data.signedUrl }
          : { file_url: data.signedUrl }),
      };
    }),
  );

  res.json({
    success: true,
    items: history,
  });
});

app.delete("/items/:id", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Token manquant",
    });
  }

  const token = authHeader.split(" ")[1];

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({
      success: false,
      error: "Utilisateur non authentifié",
    });
  }

  const userSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  // On récupère d'abord l'élément
  const { data: item, error: itemError } = await userSupabase
    .from("clipboard_items")
    .select("id, type, storage_path")
    .eq("id", req.params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (itemError) {
    return res.status(500).json({
      success: false,
      error: itemError.message,
    });
  }

  if (!item) {
    return res.status(404).json({
      success: false,
      error: "Élément introuvable",
    });
  }

  // Déterminer le bucket selon le type d'élément
  const storageBucket =
    item.type === "image"
      ? "clipboard-images"
      : item.type === "file"
        ? "clipboard-files"
        : null;

  // Supprimer le fichier réel avant son entrée en BDD
  if (storageBucket && item.storage_path) {
    const { error: storageError } = await userSupabase.storage
      .from(storageBucket)
      .remove([item.storage_path]);

    if (storageError) {
      return res.status(500).json({
        success: false,
        error: "Impossible de supprimer le fichier du stockage",
      });
    }
  }

  // Puis on supprime l'entrée BDD
  const { error: deleteError } = await userSupabase
    .from("clipboard_items")
    .delete()
    .eq("id", item.id)
    .eq("user_id", user.id);

  if (deleteError) {
    return res.status(500).json({
      success: false,
      error: deleteError.message,
    });
  }

  res.json({
    success: true,
    message: "Élément supprimé",
  });
});

app.post("/maintenance/cleanup-expired", async (req, res) => {
  const cleanupSecret = req.headers["x-cleanup-secret"];

  if (!cleanupSecret || cleanupSecret !== process.env.CLEANUP_SECRET) {
    return res.status(401).json({
      success: false,
      error: "Non autorisé",
    });
  }

  const now = new Date().toISOString();

  // 1. Récupérer tous les éléments expirés
  const { data: expiredItems, error: selectError } = await adminSupabase
    .from("clipboard_items")
    .select("id, type, storage_path")
    .lte("expires_at", now);

  if (selectError) {
    return res.status(500).json({
      success: false,
      error: selectError.message,
    });
  }

  if (!expiredItems || expiredItems.length === 0) {
    return res.json({
      success: true,
      deleted: 0,
      message: "Aucun élément expiré",
    });
  }

  // 2. Récupérer les fichiers images à supprimer
  const imagePaths = expiredItems
    .filter((item) => item.type === "image" && item.storage_path)
    .map((item) => item.storage_path);

  // 3. Supprimer les fichiers réels dans Storage
  if (imagePaths.length > 0) {
    const { error: storageError } = await adminSupabase.storage
      .from("clipboard-images")
      .remove(imagePaths);

    if (storageError) {
      return res.status(500).json({
        success: false,
        error: "Impossible de supprimer les images expirées",
      });
    }
  }

  // 4. Supprimer les lignes de la BDD
  const expiredIds = expiredItems.map((item) => item.id);

  // Récupérer les documents expirés
  const filePaths = expiredItems
    .filter((item) => item.type === "file" && item.storage_path)
    .map((item) => item.storage_path);

  // Supprimer les documents de Supabase Storage
  if (filePaths.length > 0) {
    const { error: fileStorageError } = await adminSupabase.storage
      .from("clipboard-files")
      .remove(filePaths);

    if (fileStorageError) {
      console.error("Erreur suppression documents expirés :", fileStorageError);

      return res.status(500).json({
        success: false,
        error: "Impossible de supprimer les documents expirés",
      });
    }
  }

  const { error: deleteError } = await adminSupabase
    .from("clipboard_items")
    .delete()
    .in("id", expiredIds);

  if (deleteError) {
    return res.status(500).json({
      success: false,
      error: deleteError.message,
    });
  }

  res.json({
    success: true,
    deleted: expiredItems.length,
    deletedImages: imagePaths.length,
    deletedFiles: filePaths.length,
    message: "Nettoyage terminé",
  });
});

app.use((err, req, res, next) => {
  console.error("Erreur serveur :", err);

  // Erreurs liées à Multer

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        error: "Image trop volumineuse (maximum 10 Mo)",
      });
    }

    return res.status(400).json({
      success: false,
      error: "Erreur lors de l'envoi du fichier",
    });
  }

  // Fichier non autorisé
  if (err.message === "Le fichier doit être une image") {
    return res.status(400).json({
      success: false,
      error: "Le fichier doit être une image",
    });
  }

  // JSON invalide
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: "Les données envoyées sont invalides",
    });
  }

  // Autres erreurs inattendues
  return res.status(500).json({
    success: false,
    error: "Une erreur interne est survenue",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});
