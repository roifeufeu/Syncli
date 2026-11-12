import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { ImagePlus, FileUp, FileText, Send, X } from "lucide-react";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 10;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_DOCUMENT_SIZE = 20 * 1000 * 1000;
const MAX_DOCUMENTS = 10;

const ALLOWED_DOCUMENT_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "zip",
];

function SendClipboard({ onItemAdded }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const fileInputRef = useRef(null);
  const sendingRef = useRef(false);
  const imagesRef = useRef([]);
  const documentsRef = useRef([]);
  const documentInputRef = useRef(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragCounterRef = useRef(0);

  const [previewId, setPreviewId] = useState(null);

  const galleryRef = useRef(null);

  const dragRef = useRef({
    pressed: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  const ignoreNextClickRef = useRef(false);

  const updateImages = useCallback((nextImages) => {
    imagesRef.current = nextImages;
    setImages(nextImages);
  }, []);

  const updateDocuments = (nextDocuments) => {
    documentsRef.current = nextDocuments;
    setDocuments(nextDocuments);
  };

  const chooseDocument = () => {
    documentInputRef.current?.click();
  };

  const addDocuments = (files) => {
    if (sendingRef.current || files.length === 0) return;

    if (imagesRef.current.length > 0) {
      setMessage(
        "Termine ou annule l'envoi des images avant de sélectionner des fichiers.",
      );
      return;
    }

    const previous = documentsRef.current;

    if (previous.length + files.length > MAX_DOCUMENTS) {
      setMessage(`Vous pouvez sélectionner ${MAX_DOCUMENTS} fichiers maximum.`);
      return;
    }

    const invalid = files.find((file) => {
      const extension = file.name.split(".").pop().toLowerCase();
      return !ALLOWED_DOCUMENT_EXTENSIONS.includes(extension);
    });

    if (invalid) {
      setMessage(`Format de fichier non autorisé : ${invalid.name}`);
      return;
    }

    const tooLarge = files.find((file) => file.size > MAX_DOCUMENT_SIZE);

    if (tooLarge) {
      setMessage(`Fichier trop volumineux : ${tooLarge.name} (20 Mo maximum).`);
      return;
    }

    const newDocuments = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
    }));

    updateDocuments([...previous, ...newDocuments]);
    setMessage("");
  };

  const handleDocumentChange = (event) => {
    addDocuments(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const removeDocument = (id) => {
    if (sendingRef.current) return;

    updateDocuments(documentsRef.current.filter((item) => item.id !== id));
    setMessage("");
  };

  const clearDocuments = () => {
    if (sendingRef.current) return;

    updateDocuments([]);

    if (documentInputRef.current) {
      documentInputRef.current.value = "";
    }

    setMessage("");
  };

  // Libérer les URL de prévisualisation à la fermeture.
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (
      ![
        "Texte enregistré",
        "Image enregistrée",
        "Images enregistrées",
      ].includes(message)
    ) {
      return;
    }

    const timeout = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timeout);
  }, [message]);

  const chooseImage = () => {
    fileInputRef.current?.click();
  };

  // Logique commune de sélection des images.
  // Elle pourra être réutilisée pour le drop et Ctrl+V.
  const addImages = useCallback(
    (files) => {
      if (sendingRef.current || files.length === 0) return;

      if (documentsRef.current.length > 0) {
        setMessage(
          "Termine ou annule l'envoi des fichiers avant de sélectionner des images.",
        );
        return;
      }

      const previous = imagesRef.current;

      if (previous.length + files.length > MAX_IMAGES) {
        setMessage(
          `Vous pouvez sélectionner ${MAX_IMAGES} images maximum à la fois.`,
        );
        return;
      }

      const invalid = files.find(
        (file) => !ALLOWED_IMAGE_TYPES.includes(file.type),
      );

      if (invalid) {
        setMessage(
          `Format non autorisé : ${invalid.name} (JPG, PNG, WebP ou GIF).`,
        );
        return;
      }

      const tooLarge = files.find((file) => file.size > MAX_IMAGE_SIZE);

      if (tooLarge) {
        setMessage(
          `Image trop volumineuse : ${tooLarge.name} (10 Mo maximum par image).`,
        );
        return;
      }

      const newImages = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      updateImages([...previous, ...newImages]);
      setMessage("");
    },
    [updateImages],
  );

  useEffect(() => {
    const handlePaste = (event) => {
      if (sendingRef.current || event.defaultPrevented) return;

      // Récupérer les images présentes dans le presse-papiers.
      const pastedImages = Array.from(event.clipboardData?.items || [])
        .filter(
          (item) => item.kind === "file" && item.type.startsWith("image/"),
        )
        .map((item) => item.getAsFile())
        .filter(Boolean);

      // Si aucune image n'est présente,
      // laisser fonctionner le collage de texte normalement.
      if (pastedImages.length === 0) return;

      event.preventDefault();

      // Réutiliser nos validations existantes.
      addImages(pastedImages);
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [addImages]);

  const handleImageChange = (event) => {
    addImages(Array.from(event.target.files || []));
    event.target.value = "";
  };

  // Vérifier que le glissement contient des fichiers.
  const isFileDrag = (event) => {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  };

  const handleDragEnter = (event) => {
    if (!isFileDrag(event)) return;

    event.preventDefault();

    if (sendingRef.current) return;

    dragCounterRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleDragOver = (event) => {
    if (!isFileDrag(event)) return;

    event.preventDefault();

    event.dataTransfer.dropEffect = sendingRef.current ? "none" : "copy";
  };

  const handleDragLeave = (event) => {
    if (!isFileDrag(event)) return;

    event.preventDefault();

    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);

    if (dragCounterRef.current === 0) {
      setIsDraggingFiles(false);
    }
  };

  const handleDrop = (event) => {
    if (!isFileDrag(event)) return;

    event.preventDefault();

    dragCounterRef.current = 0;
    setIsDraggingFiles(false);

    if (sendingRef.current) return;

    const droppedFiles = Array.from(event.dataTransfer.files);

    // Réutiliser la même validation que le bouton de sélection.
    addImages(droppedFiles);
  };

  const removeImage = (id) => {
    if (sendingRef.current) return;

    setPreviewId((current) => (current === id ? null : current));

    const removed = imagesRef.current.find((item) => item.id === id);

    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
    }

    updateImages(imagesRef.current.filter((item) => item.id !== id));

    setMessage("");
  };

  const clearImages = () => {
    imagesRef.current.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });

    updateImages([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setMessage("");
    setPreviewId(null);
  };

  // Envoi de texte : comportement de la V1 conservé.
  const sendText = async () => {
    if (sendingRef.current || !text.trim()) return;

    sendingRef.current = true;
    setIsSending(true);
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setMessage("Impossible de vérifier la session. Réessaie.");
        return;
      }

      if (!session) {
        setMessage("Tu dois être connecté pour envoyer un texte");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/items/text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text }),
        },
      );

      const data = await response.json();

      if (response.status === 401) {
        setMessage(
          "Session expirée ou invalide. Déconnecte-toi puis reconnecte-toi.",
        );
        return;
      }

      if (!response.ok) {
        setMessage(data.error || "Erreur lors de l'envoi");
        return;
      }

      setText("");
      setMessage("Texte enregistré");
      onItemAdded?.();
    } catch {
      setMessage("Impossible de contacter le serveur ou de traiter sa réponse");
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  // Envoi des images une par une avec notre route existante.
  const sendImages = async () => {
    if (imagesRef.current.length === 0 || sendingRef.current) {
      return;
    }

    sendingRef.current = true;
    setIsSending(true);
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setMessage(
          "Impossible de vérifier la session. Reconnecte-toi puis réessaie.",
        );
        return;
      }

      const queue = [...imagesRef.current];
      const sentIds = new Set();
      const failedNames = [];
      let sessionExpired = false;

      for (const item of queue) {
        const formData = new FormData();
        formData.append("image", item.file);

        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/items/image`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              body: formData,
            },
          );

          if (response.status === 401) {
            sessionExpired = true;
            break;
          }

          if (!response.ok) {
            failedNames.push(item.file.name);
            continue;
          }

          sentIds.add(item.id);
        } catch {
          failedNames.push(item.file.name);
        }
      }

      // On conserve uniquement les images non envoyées.
      const remaining = queue.filter((item) => !sentIds.has(item.id));

      queue
        .filter((item) => sentIds.has(item.id))
        .forEach((item) => {
          URL.revokeObjectURL(item.previewUrl);
        });

      updateImages(remaining);

      if (sentIds.size > 0) {
        onItemAdded?.();
      }

      if (sessionExpired) {
        setMessage(
          `${sentIds.size} image(s) envoyée(s). Session expirée : reconnecte-toi avant de réessayer.`,
        );
      } else if (failedNames.length > 0) {
        setMessage(
          `${sentIds.size} image(s) envoyée(s), ${failedNames.length} échec(s). Les images non envoyées restent sélectionnées.`,
        );
      } else {
        setMessage(
          sentIds.size === 1 ? "Image enregistrée" : "Images enregistrées",
        );
      }
    } catch {
      setMessage("Impossible de contacter le serveur ou de traiter sa réponse");
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const sendDocuments = async () => {
    if (documentsRef.current.length === 0 || sendingRef.current) {
      return;
    }

    sendingRef.current = true;
    setIsSending(true);
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setMessage(
          "Impossible de vérifier la session. Reconnecte-toi puis réessaie.",
        );
        return;
      }

      const queue = [...documentsRef.current];
      const sentIds = new Set();
      const failedNames = [];
      let sessionExpired = false;
      let firstError = "";

      for (const item of queue) {
        const formData = new FormData();

        // Correspond au champ attendu par Multer dans /items/file.
        formData.append("file", item.file);

        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/items/file`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              body: formData,
            },
          );

          if (response.status === 401) {
            sessionExpired = true;
            break;
          }

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));

            if (!firstError) {
              firstError = data.error || "Erreur lors de l'envoi";
            }

            failedNames.push(item.file.name);
            continue;
          }

          sentIds.add(item.id);
        } catch {
          failedNames.push(item.file.name);

          if (!firstError) {
            firstError = "Impossible de contacter le serveur";
          }
        }
      }

      // Conserver les fichiers qui n'ont pas été envoyés.
      updateDocuments(queue.filter((item) => !sentIds.has(item.id)));

      if (sentIds.size > 0) {
        onItemAdded?.();
      }

      if (sessionExpired) {
        setMessage(
          `${sentIds.size} fichier(s) envoyé(s). Session expirée : reconnecte-toi avant de réessayer.`,
        );
      } else if (failedNames.length > 0) {
        setMessage(
          `${sentIds.size} fichier(s) envoyé(s), ${failedNames.length} échec(s). ${firstError}. Les fichiers non envoyés restent sélectionnés.`,
        );
      } else {
        setMessage(
          sentIds.size === 1 ? "Fichier enregistré" : "Fichiers enregistrés",
        );
      }
    } catch {
      setMessage("Impossible de traiter l'envoi des fichiers");
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const totalSize = images.reduce((sum, item) => sum + item.file.size, 0);

  const sizeInMo = (bytes) =>
    (bytes / (1024 * 1024)).toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    });

  // Début du glissement avec la souris
  const startGalleryDrag = (event) => {
    if (event.button !== 0 || event.target.closest("[data-no-gallery-drag]")) {
      return;
    }

    const gallery = galleryRef.current;
    if (!gallery) return;

    ignoreNextClickRef.current = false;

    dragRef.current = {
      pressed: true,
      startX: event.clientX,
      startScrollLeft: gallery.scrollLeft,
      moved: false,
    };
  };

  // Déplacement horizontal de la galerie
  const moveGalleryDrag = (event) => {
    const drag = dragRef.current;
    const gallery = galleryRef.current;

    if (!drag.pressed || !gallery) return;

    const distance = event.clientX - drag.startX;

    if (Math.abs(distance) > 6) {
      drag.moved = true;
    }

    if (!drag.moved) return;

    event.preventDefault();

    ignoreNextClickRef.current = true;
    gallery.scrollLeft = drag.startScrollLeft - distance;
  };

  const stopGalleryDrag = () => {
    dragRef.current.pressed = false;
  };

  // Ouvrir une image uniquement si ce n'était pas un glissement
  const openPreview = (id) => {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }

    setPreviewId(id);
  };

  // Passer à l'image précédente ou suivante
  const movePreview = useCallback(
    (direction) => {
      setPreviewId((currentId) => {
        const available = imagesRef.current;

        if (available.length === 0) return null;

        const index = available.findIndex((item) => item.id === currentId);

        const currentIndex = index < 0 ? 0 : index;

        const nextIndex =
          (currentIndex + direction + available.length) % available.length;

        return available[nextIndex].id;
      });
    },
    [setPreviewId],
  );

  // Navigation au clavier dans l'aperçu agrandi
  useEffect(() => {
    if (!previewId) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setPreviewId(null);
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        movePreview(-1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        movePreview(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewId, movePreview]);

  const previewImage = images.find((item) => item.id === previewId);

  const previewIndex = images.findIndex((item) => item.id === previewId);

  return (
    <section
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900">Envoyer</h2>

        <p className="mt-1 text-sm text-slate-500">
          Transférez du texte ou des images entre vos appareils.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleImageChange}
        disabled={isSending}
        hidden
      />

      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
        multiple
        onChange={handleDocumentChange}
        disabled={isSending}
        hidden
      />

      <div className="relative">
        {isDraggingFiles && (
          <div className="pointer-events-none absolute inset-0 z-20 flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-500 bg-blue-50 p-6 text-center">
            <ImagePlus size={42} className="text-blue-600" />

            <p className="text-lg font-semibold text-blue-700">
              Déposez vos images ici
            </p>

            <p className="text-sm text-blue-600">JPG, PNG, WebP ou GIF</p>

            <p className="text-xs text-blue-500">
              10 images maximum · 10 Mo par image
            </p>
          </div>
        )}

        {images.length === 0 && documents.length === 0 ? (
          <>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Collez votre texte ici..."
              rows={7}
              disabled={isSending}
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {/* Groupe de gauche */}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={chooseImage}
                  disabled={isSending}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <ImagePlus size={18} />
                  Images
                </button>

                <button
                  type="button"
                  onClick={chooseDocument}
                  disabled={isSending}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <FileUp size={18} />
                  Fichiers
                </button>
              </div>

              {/* Bouton de droite */}
              <button
                type="button"
                onClick={sendText}
                disabled={isSending || !text.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                <Send size={17} />
                {isSending ? "Envoi en cours..." : "Envoyer le texte"}
              </button>
            </div>
          </>
        ) : images.length > 0 ? (
          <>
            {/* Galerie horizontale */}
            <div
              ref={galleryRef}
              onMouseDown={startGalleryDrag}
              onMouseMove={moveGalleryDrag}
              onMouseUp={stopGalleryDrag}
              onMouseLeave={stopGalleryDrag}
              className="flex cursor-grab select-none gap-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 pb-3 active:cursor-grabbing"
            >
              {images.map((item) => (
                <div
                  key={item.id}
                  className="relative w-[min(70vw,32rem)] shrink-0"
                >
                  {/* Image cliquable pour l'agrandir */}
                  <button
                    type="button"
                    onClick={() => openPreview(item.id)}
                    className="flex h-56 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100 sm:h-64"
                    aria-label={`Agrandir ${item.file.name}`}
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      draggable={false}
                      className="pointer-events-none h-full w-full object-contain"
                    />
                  </button>

                  {/* Retirer l'image de la sélection */}
                  <button
                    type="button"
                    data-no-gallery-drag
                    onClick={() => removeImage(item.id)}
                    disabled={isSending}
                    aria-label={`Retirer ${item.file.name}`}
                    className="absolute right-2 top-2 rounded-full bg-slate-900/70 p-2 text-white transition hover:bg-slate-900 disabled:opacity-60"
                  >
                    <X size={17} />
                  </button>

                  <p
                    className="mt-2 truncate text-sm text-slate-700"
                    title={item.file.name}
                  >
                    {item.file.name}
                  </p>
                </div>
              ))}
            </div>

            {/* Compteur et ajout */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <span>
                {images.length} / {MAX_IMAGES} images · {sizeInMo(totalSize)} Mo
                au total
              </span>

              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={chooseImage}
                  disabled={isSending}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 disabled:opacity-60"
                >
                  <ImagePlus size={17} />
                  Ajouter des images
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={clearImages}
                disabled={isSending}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <X size={17} />
                Annuler
              </button>

              <button
                type="button"
                onClick={sendImages}
                disabled={isSending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Send size={17} />
                {isSending
                  ? "Envoi en cours..."
                  : `Envoyer ${images.length} image${
                      images.length > 1 ? "s" : ""
                    }`}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Liste des documents sélectionnés */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {documents.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <FileText size={24} className="shrink-0 text-blue-600" />

                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium text-slate-800"
                      title={item.file.name}
                    >
                      {item.file.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {sizeInMo(item.file.size)} Mo
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeDocument(item.id)}
                    disabled={isSending}
                    aria-label={`Retirer ${item.file.name}`}
                    className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>

            {/* Compteur et ajout */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <span>
                {documents.length} / {MAX_DOCUMENTS} fichiers ·{" "}
                {sizeInMo(
                  documents.reduce((sum, item) => sum + item.file.size, 0),
                )}{" "}
                Mo au total
              </span>

              {documents.length < MAX_DOCUMENTS && (
                <button
                  type="button"
                  onClick={chooseDocument}
                  disabled={isSending}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 disabled:opacity-60"
                >
                  <FileUp size={17} />
                  Ajouter des fichiers
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={clearDocuments}
                disabled={isSending}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <X size={17} />
                Annuler
              </button>

              <button
                type="button"
                onClick={sendDocuments}
                disabled={isSending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Send size={17} />
                {isSending
                  ? "Envoi en cours..."
                  : `Envoyer ${documents.length} fichier${
                      documents.length > 1 ? "s" : ""
                    }`}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Aperçu agrandi */}

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPreviewId(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Prévisualisation agrandie"
            className="flex w-full max-w-5xl flex-col gap-4"
          >
            {/* Barre supérieure */}
            <div className="flex items-center justify-between text-white">
              <span className="text-sm font-medium">
                Image {previewIndex + 1} sur {images.length}
              </span>

              <button
                type="button"
                onClick={() => setPreviewId(null)}
                aria-label="Fermer l'aperçu"
                className="rounded-full bg-white/15 p-2 hover:bg-white/25"
              >
                <X size={22} />
              </button>
            </div>

            {/* Grande image */}
            <div className="flex h-[70vh] items-center justify-center">
              <img
                src={previewImage.previewUrl}
                alt={previewImage.file.name}
                draggable={false}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4 text-white">
              <button
                type="button"
                onClick={() => movePreview(-1)}
                disabled={images.length <= 1}
                className="rounded-lg bg-white/15 px-4 py-2 text-sm hover:bg-white/25 disabled:opacity-30"
              >
                ← Précédente
              </button>

              <p className="min-w-0 truncate text-center text-sm text-slate-300">
                {previewImage.file.name}
              </p>

              <button
                type="button"
                onClick={() => movePreview(1)}
                disabled={images.length <= 1}
                className="rounded-lg bg-white/15 px-4 py-2 text-sm hover:bg-white/25 disabled:opacity-30"
              >
                Suivante →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages de réussite ou d'erreur */}
      {message && (
        <p role="status" className="mt-4 text-sm text-slate-600">
          {message}
        </p>
      )}
    </section>
  );
}

export default SendClipboard;
