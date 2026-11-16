import { useState } from "react";
import { ClipboardCopy, UserRound, ChevronDown, LogOut } from "lucide-react";
import StorageUsage from "./StorageUsage";

function Header({ email, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        {/* Logo et nom */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <ClipboardCopy size={23} />
          </div>

          <span className="text-xl font-bold tracking-tight text-slate-900">
            Syn<span className="text-blue-600">Cli</span>
          </span>
        </div>

        {/* Compte utilisateur */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-700 transition hover:bg-slate-50"
          >
            <UserRound size={18} />

            <span className="hidden max-w-40 truncate text-sm sm:inline">
              {email}
            </span>

            <ChevronDown size={16} />
          </button>

          {/* Menu déroulant */}
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
              <p className="text-xs text-slate-500">Connecté en tant que</p>

              <p className="mt-1 break-all text-sm font-medium text-slate-800">
                {email}
              </p>

              <hr className="my-3 border-slate-200" />

              <StorageUsage />

              <hr className="my-3 border-slate-200" />

              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
              >
                <LogOut size={17} />
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
