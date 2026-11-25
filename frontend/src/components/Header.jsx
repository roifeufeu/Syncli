import { useState } from "react";
import {
  ClipboardCopy,
  UserRound,
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  LogIn,
} from "lucide-react";
import StorageUsage from "./StorageUsage";
import { useTheme } from "../theme-context";

function Header({ email, username, onLogout, onLogin, storageItems }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark";
  const isLoggedIn = Boolean(email);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        {/* Logo et nom */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <ClipboardCopy size={23} />
          </div>

          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            Syn<span className="text-blue-600">Cli</span>
          </span>
        </div>

        {/* Visiteur non connecté */}
        {!isLoggedIn ? (
          <div className="flex items-center gap-2">
            {/* Thème accessible sans compte */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                isDark ? "Activer le thème clair" : "Activer le thème sombre"
              }
              title={
                isDark ? "Activer le thème clair" : "Activer le thème sombre"
              }
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {isDark ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            <button
              type="button"
              onClick={() => onLogin?.()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <LogIn size={18} />
              <span>Se connecter</span>
            </button>
          </div>
        ) : (
          /* Utilisateur connecté */
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <UserRound size={18} />

              <span className="hidden max-w-40 truncate text-sm sm:inline">
                {username || "Compte"}
              </span>

              <ChevronDown size={16} />
            </button>

            {/* Menu déroulant */}
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Connecté en tant que
                </p>

                <p className="mt-1 break-all text-sm font-medium text-slate-800 dark:text-zinc-100">
                  {username || "Compte"}
                </p>

                <hr className="my-3 border-slate-200 dark:border-zinc-700" />

                <StorageUsage items={storageItems} />

                <hr className="my-3 border-slate-200 dark:border-zinc-700" />

                {/* Switch thème sombre */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-zinc-200">
                    <Moon size={18} />
                    <span>Thème sombre</span>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isDark}
                    aria-label="Activer le thème sombre"
                    onClick={toggleTheme}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                      isDark ? "bg-blue-600" : "bg-slate-300 dark:bg-zinc-600"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        isDark ? "translate-x-5" : "translate-x-0"
                      }`}
                    >
                      {isDark && (
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          className="h-3 w-3 text-blue-600"
                          aria-hidden="true"
                        >
                          <path
                            d="m3.5 8 3 3 6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                  </button>
                </div>

                <hr className="my-3 border-slate-200 dark:border-zinc-700" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout?.();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <LogOut size={17} />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
