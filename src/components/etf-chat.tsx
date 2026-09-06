"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { Send, User as UserIcon, Bot, Lock, Square } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth/auth-dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { QuizAnswers } from "./etf-quiz";
import { createClient } from "@/lib/supabase/client";
import { ETFChatCard } from "@/components/etf-chat-card";
import { useMarketData } from "@/hooks/use-market-data";
import etfsData from "../../public/data/etfs.json";
import type { ETF } from "../../types/etf";

export interface ETFChatProps {
  quizAnswers: QuizAnswers;
  onReset: () => void;
}

const REGION_LABELS: Record<string, string> = {
  world: "Weltweit",
  usa: "USA",
  europe: "Europa",
  emerging: "Schwellenländer",
};

const DISTRIBUTION_LABELS: Record<string, string> = {
  acc: "Thesaurierend",
  dist: "Ausschüttend",
};

const ESG_LABELS: Record<string, string> = {
  any: "Keine Einschränkung",
  article_8: "Artikel 8 / ESG",
  article_9: "Artikel 9 / SRI",
};

const RISK_LABELS: Record<string, string> = {
  low_vol: "Geringe Volatilität",
  balanced: "Ausgewogen",
  max_div: "Maximale Diversifikation",
};

const SECTOR_LABELS: Record<string, string> = {
  none: "Kein Fokus",
  tech: "Technologie",
  dividend: "Dividenden",
  healthcare: "Gesundheitswesen",
};

function formatQuizAnswers(answers: QuizAnswers): string {
  const lines: string[] = [
    "Meine Quiz-Antworten:",
    `- Region: ${REGION_LABELS[answers.region ?? ""] ?? answers.region}`,
    `- Ausschüttung: ${DISTRIBUTION_LABELS[answers.distribution ?? ""] ?? answers.distribution}`,
    `- Nachhaltigkeit (ESG): ${ESG_LABELS[answers.esg ?? ""] ?? answers.esg}`,
    `- Risiko: ${RISK_LABELS[answers.risk ?? ""] ?? answers.risk}`,
    `- Sektor-Fokus: ${SECTOR_LABELS[answers.sectorTilt ?? ""] ?? answers.sectorTilt}`,
    "",
    "Basierend auf diesen Antworten, welche ETFs aus deiner Datenbank empfiehlst du mir?",
  ];
  return lines.join("\n");
}

export function ETFChat({ quizAnswers, onReset }: ETFChatProps) {
  const { user } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const hasStarted = useRef(false);
  const initTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // useChat v4 / ai v7: uses transport + sendMessage(string)
  const { messages, sendMessage, stop, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { quizAnswers },
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-start: send initial message once on mount
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    
    initTimerRef.current = setTimeout(() => {
      // Embed quiz answers directly in the message so the LLM always sees them
      sendMessage({ text: formatQuizAnswers(quizAnswers) });
    }, 100);

    return () => {
      clearTimeout(initTimerRef.current);
      hasStarted.current = false;
    };
  }, [sendMessage, quizAnswers]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) {
      window.localStorage.setItem("etf-finder:chat", JSON.stringify(messages));

      if (user) {
        supabase
          .from("chat_history")
          .upsert(
            { user_id: user.id, messages, quiz_answers: quizAnswers },
            { onConflict: "user_id" }
          )
          .then(({ error }) => {
            if (error) {
              console.error("Failed to save chat to Supabase:", JSON.stringify(error, null, 2));
            }
          });
      }
    }
  }, [messages, user, quizAnswers, supabase]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInputValue("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Extract text content from a message (UIMessage uses parts in v7)
  const getMessageText = (message: any): string => {
    if (message.parts && Array.isArray(message.parts)) {
      return message.parts
        .filter((p: any) => p.type === "text" || p.type === "reasoning")
        .map((p: any) => p.type === "reasoning" ? `\n\n> 🤔 ${p.text}\n\n` : p.text)
        .join("");
    }
    return message.content ?? "";
  };

  // Pre-build a lookup map for O(1) ETF lookups by ISIN
  const etfByIsin = useMemo(() => {
    const map = new Map<string, ETF>();
    for (const etf of etfsData as unknown as ETF[]) {
      if (etf.isin && etf.isin !== "N/A") {
        map.set(etf.isin.toUpperCase(), etf);
      }
    }
    return map;
  }, []);

  /** Extract unique ISINs from message text using the standard ISIN regex. */
  const extractEtfs = (text: string): ETF[] => {
    const isinRegex = /[A-Z]{2}[A-Z0-9]{10}/g;
    const seen = new Set<string>();
    const found: ETF[] = [];
    for (const match of text.matchAll(isinRegex)) {
      const isin = match[0];
      if (seen.has(isin)) continue;
      seen.add(isin);
      const etf = etfByIsin.get(isin);
      if (etf) found.push(etf);
    }
    return found;
  };

  // ── Live market data for all ISINs mentioned in any message ──

  /** Collect all ISIN+name pairs that appear across all messages (assistant + user). */
  const allMentionedEtfs = useMemo(() => {
    const seen = new Map<string, { isin: string; name: string }>();
    for (const msg of messages) {
      const text = getMessageText(msg);
      for (const etf of extractEtfs(text)) {
        if (etf.isin && etf.isin !== "N/A" && !seen.has(etf.isin)) {
          seen.set(etf.isin, { isin: etf.isin, name: etf.name });
        }
      }
    }
    return [...seen.values()];
  }, [messages]);

  const { quotes: marketQuotes, loading: marketDataLoading } =
    useMarketData(allMentionedEtfs);

  return (
    <div className="flex w-full h-[calc(100dvh-5.5rem)] sm:h-[85vh] max-w-4xl flex-col overflow-hidden rounded-none sm:rounded-2xl border-0 sm:border border-border/50 bg-background/50 shadow-none sm:shadow-xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">AI ETF Berater</h2>
          <p className="text-xs text-muted-foreground">Powered by NVIDIA LLM</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem("etf-finder:chat");
            }
            onReset();
          }}
        >
          Quiz neu starten
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 scrollbar-thin scrollbar-thumb-muted">
        <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
          <AnimatePresence initial={false}>
            {messages.map((message: any) => {
              const text = getMessageText(message) || "[Leere Antwort vom KI-Modell empfangen. Dies deutet auf ein API-Problem hin.]";
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 280, damping: 26 }}
                  className="flex gap-4 items-start"
                >
                  {/* Avatar */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted border border-border/60"
                    }`}
                  >
                    {message.role === "user" ? (
                      <UserIcon size={15} />
                    ) : (
                      <Bot size={15} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {message.role === "user" ? "Du" : "AI Berater"}
                    </p>
                    {message.role === "user" ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
                    ) : (
                      <>
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-li:my-0.5">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                        </div>
                        {/* ETF cards for ISINs found in the message */}
                        {extractEtfs(text).map((etf) => (
                          <ETFChatCard
                            key={etf.isin}
                            etf={etf}
                            marketData={marketQuotes.get(etf.isin) ?? null}
                            marketDataLoading={marketDataLoading}
                          />
                        ))}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-4 items-start"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted border border-border/60">
                  <Bot size={15} />
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">AI Berater</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Error display */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 items-start"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                  <Square size={15} />
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-xs font-medium text-destructive mb-2">Systemfehler</p>
                  <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20 whitespace-pre-wrap">
                    {error.message || "Es ist ein unerwarteter Fehler aufgetreten. Bitte versuche es später noch einmal."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t px-4 sm:px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          {user ? (
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all shadow-sm">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Frag etwas zu deinen ETF-Empfehlungen..."
                disabled={isLoading}
                className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80 transition-colors"
                  title="Stopp"
                >
                  <Square size={13} className="fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                  title="Senden"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/30 py-6 text-center">
              <Lock className="size-5 text-muted-foreground/60" />
              <div className="flex flex-col gap-1 px-4">
                <p className="text-sm font-medium">Weitere Fragen stellen?</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Melde dich an, um direkt mit dem KI-Berater zu chatten.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAuthDialogOpen(true)}
                className="mt-1 rounded-full px-5"
              >
                Anmelden
              </Button>
            </div>
          )}
        </div>
        <p className="text-[10px] text-center text-muted-foreground/60 mt-3 max-w-3xl mx-auto px-4">
          Disclaimer: For informational and educational purposes only. Not financial advice. AI-generated insights must be independently verified.
        </p>
      </div>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
}
