import "./Footer.css";
import { ClipboardCopy } from "lucide-react";

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-brand">
        <div className="footer-icon">
          <ClipboardCopy size={19} />
        </div>

        <span className="footer-name">
          Syn<span>Cli</span>
        </span>
      </div>

      <p className="footer-description">
        Votre presse-papiers, accessible partout.
      </p>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} SynCli</span>
        <span className="footer-separator">·</span>
        <a
          href="https://github.com/roifeufeu/Presse-Papier"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
