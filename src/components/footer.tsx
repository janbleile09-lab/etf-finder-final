"use client";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/50 bg-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-6 text-center text-xs text-muted-foreground sm:text-left">
        <div className="w-full flex flex-col sm:flex-row items-center sm:justify-between gap-2">
          <span>
            Eine Website von{" "}
            <a
              href="https://appareo-digital.online"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground/70 underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Appareo
            </a>
          </span>
          <a
            href="https://appareo-digital.online/datenschutz.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Datenschutzerklärung
          </a>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed max-w-4xl text-center sm:text-left text-muted-foreground/70">
          <strong>Disclaimer:</strong> For informational and educational purposes only. Not financial advice. AI-generated insights must be independently verified.
        </p>
      </div>
    </footer>
  );
}
