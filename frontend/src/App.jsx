import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import SendClipboard from "./components/SendClipboard";
import ClipboardHistory from "./components/ClipboardHistory";
import AuthModal from "./components/AuthModal";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { LockKeyhole } from "lucide-react";

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);

  const [historyVersion, setHistoryVersion] = useState(0);
  const [storageSnapshot, setStorageSnapshot] = useState(null);
  const [logoutError, setLogoutError] = useState("");

  const openAuth = useCallback(() => {
    setAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
  }, []);

  // Récupération de la session et écoute des changements.
  useEffect(() => {
    let active = true;
    let authEventReceived = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;

      authEventReceived = true;
      setSession(newSession);
      setAuthReady(true);

      if (event === "PASSWORD_RECOVERY") {
        // L'utilisateur arrive depuis un lien de récupération.
        // On ouvre la fenêtre pour définir un nouveau mot de passe.
        setPasswordResetOpen(true);
        setAuthOpen(true);
      } else if (event === "SIGNED_IN") {
        // Connexion classique : fermer la fenêtre.
        setAuthOpen(false);
      } else if (event === "SIGNED_OUT") {
        setPasswordResetOpen(false);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || authEventReceived) return;

        if (error) {
          console.error("Erreur de session :", error);
        }

        setSession(data?.session ?? null);
        setAuthReady(true);
      })
      .catch((error) => {
        if (!active || authEventReceived) return;

        console.error("Impossible de récupérer la session :", error);
        setSession(null);
        setAuthReady(true);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) return;

    let active = true;

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Erreur récupération du pseudo :", error);
        return;
      }

      setProfile({
        userId,
        username: data?.username ?? null,
      });
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const logout = async () => {
    setLogoutError("");

    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      setLogoutError(error.message || "Impossible de se déconnecter.");
    }
  };

  const isAuthenticated = Boolean(session);

  const storageItems =
    session && storageSnapshot?.userId === session.user.id
      ? storageSnapshot.items
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-50">
      {/* En-tête */}
      <Header
        email={session?.user?.email}
        username={
          session
            ? (profile?.userId === session.user.id ? profile.username : null) ||
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              "Compte"
            : null
        }
        onLogin={openAuth}
        onLogout={logout}
        storageItems={storageItems}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {logoutError && (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          >
            {logoutError}
          </p>
        )}

        {/* Le formulaire reste monté pendant la connexion. */}
        <SendClipboard
          isAuthenticated={isAuthenticated}
          onAuthRequired={openAuth}
          onItemAdded={() => setHistoryVersion((version) => version + 1)}
        />

        <section className="mt-10">
          {!authReady ? (
            /* Vérification de la session au lancement */
            <div className="text-sm text-slate-500 dark:text-zinc-400">
              Vérification de la session...
            </div>
          ) : isAuthenticated ? (
            /* Historique du compte connecté */
            <ClipboardHistory
              key={session.user.id}
              refreshKey={historyVersion}
              onItemsChange={setStorageSnapshot}
              storageUserId={session.user.id}
            />
          ) : (
            /* Historique du visiteur */
            <div>
              <h2 className="mb-5 text-xl font-semibold text-slate-900 dark:text-zinc-50">
                Vos éléments récents
              </h2>

              <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <LockKeyhole size={24} />
                </div>

                <div>
                  <p className="font-medium text-slate-800 dark:text-zinc-100">
                    Vous n'êtes pas connecté
                  </p>

                  <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-zinc-400">
                    Connectez-vous pour retrouver votre historique et accéder à
                    vos éléments sur tous vos appareils.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openAuth}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  Se connecter
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer />

      {/* Fenêtre d'authentification superposée */}

      <AuthModal
        open={authOpen}
        onClose={closeAuth}
        passwordReset={passwordResetOpen}
        onPasswordResetComplete={() => {
          setPasswordResetOpen(false);
          setAuthOpen(false);
        }}
      />
    </div>
  );
}

export default App;
