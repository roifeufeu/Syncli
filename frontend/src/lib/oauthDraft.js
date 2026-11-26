const DB_NAME = "syncli-oauth-drafts";
const STORE_NAME = "drafts";
const DRAFT_KEY = "google";
const MAX_AGE = 24 * 60 * 60 * 1000;

// Ouvrir la base IndexedDB locale.
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Effectuer une opération et attendre sa validation.
async function useStore(mode, operation) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    let transaction;
    let request;

    try {
      transaction = db.transaction(STORE_NAME, mode);
      request = operation(transaction.objectStore(STORE_NAME));
    } catch (error) {
      db.close();
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      const result = request.result;
      db.close();
      resolve(result);
    };

    transaction.onabort = () => {
      const error =
        transaction.error ||
        new Error("Impossible d'accéder au stockage local.");

      db.close();
      reject(error);
    };
  });
}

// Sauvegarder le brouillon avant Google OAuth.
export async function saveGoogleDraft({ text, images, documents }) {
  if (!text && images.length === 0 && documents.length === 0) {
    await clearGoogleDraft();
    return;
  }

  const draft = {
    savedAt: Date.now(),
    text,
    images: images.map(({ id, file }) => ({ id, file })),
    documents: documents.map(({ id, file }) => ({ id, file })),
  };

  await useStore("readwrite", (store) => store.put(draft, DRAFT_KEY));
}

// Récupérer le brouillon après la redirection.
export async function loadGoogleDraft() {
  const draft = await useStore("readonly", (store) => store.get(DRAFT_KEY));

  if (!draft) return null;

  // Éviter de conserver un ancien brouillon indéfiniment.
  if (Date.now() - draft.savedAt > MAX_AGE) {
    await clearGoogleDraft();
    return null;
  }

  return draft;
}

// Supprimer la sauvegarde temporaire.
export async function clearGoogleDraft() {
  await useStore("readwrite", (store) => store.delete(DRAFT_KEY));
}
