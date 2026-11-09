import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import SendClipboard from "./components/SendClipboard";
import ClipboardHistory from "./components/ClipboardHistory";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { ClipboardCopy, Mail, LockKeyhole, ArrowRight } from "lucide-react";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [authMode, setAuthMode] = useState("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const register = async () => {
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Compte créé. Vérifie ton email si nécessaire.");
  };

  const login = async () => {
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Connexion réussie");
  };

  const logout = async () => {
    setMessage("");

    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Déconnexion réussie");
  };

  if (session) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <Header email={session.user.email} onLogout={logout} />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          <SendClipboard
            onItemAdded={() => setHistoryVersion((version) => version + 1)}
          />

          <section className="mt-10">
            <ClipboardHistory refreshKey={historyVersion} />
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <ClipboardCopy size={27} />
            </div>

            <span className="text-3xl font-bold tracking-tight">
              Syn<span className="text-blue-600">Cli</span>
            </span>
          </div>

          {/* Carte d'authentification */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold text-slate-900">
                {authMode === "login" ? "Bon retour !" : "Créer un compte"}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                {authMode === "login"
                  ? "Connectez-vous pour retrouver vos éléments."
                  : "Créez votre espace presse-papiers personnel."}
              </p>
            </div>

            {/* Onglets */}
            <div className="mb-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setMessage("");
                }}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  authMode === "login"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Connexion
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setMessage("");
                }}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  authMode === "register"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Inscription
              </button>
            </div>

            {/* Formulaire */}
            <form
              onSubmit={(event) => {
                event.preventDefault();

                if (authMode === "login") {
                  login();
                } else {
                  register();
                }
              }}
              className="space-y-5"
            >
              {/* Email */}
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Adresse email
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="exemple@email.com"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Mot de passe
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={18}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={
                      authMode === "login" ? "current-password" : "new-password"
                    }
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Votre mot de passe"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* Message Supabase */}
              {message && (
                <p
                  role="status"
                  className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600"
                >
                  {message}
                </p>
              )}

              {/* Bouton principal */}
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                {authMode === "login" ? "Se connecter" : "Créer mon compte"}

                <ArrowRight size={18} />
              </button>
            </form>
          </div>

          {/* Description sous la carte */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Vos textes et images, accessibles sur tous vos appareils.
          </p>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default App;
