"use client";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/50 bg-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-5 py-4 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
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
    </footer>
  );
}
