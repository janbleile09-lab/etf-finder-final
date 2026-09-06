"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { type UIMessage as Message } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";

interface ChatHistoryRecord {
  id: string;
  user_id: string;
  messages: Message[];
  updated_at: string;
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const [history, setHistory] = useState<ChatHistoryRecord | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchHistory() {
      if (!user) {
        setIsLoadingHistory(false);
        return;
      }
      const { data, error } = await supabase
        .from("chat_history")
        .select("*")
        .eq("user_id", user.id)
        .single();
        
      if (error && error.code !== "PGRST116") { // Ignore no rows error
        console.error("Error fetching chat history:", error);
      } else if (data) {
        setHistory(data as ChatHistoryRecord);
      }
      setIsLoadingHistory(false);
    }

    if (!loading) {
      fetchHistory();
    }
  }, [user, loading, supabase]);

  if (loading || isLoadingHistory) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Lade Einstellungen...</div>;
  }

  if (!user) {
    return <div className="p-8 text-center">Bitte melde dich an, um deine Einstellungen und deinen Chat-Verlauf zu sehen.</div>;
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Benutzereinstellungen</h1>
      
      <div className="space-y-8">
        <section className="bg-card rounded-xl p-6 border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Profil</h2>
          <p className="text-muted-foreground">Eingeloggt als: <span className="font-medium text-foreground">{user.email}</span></p>
        </section>

        <section className="bg-card rounded-xl p-6 border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Chat-Verlauf</h2>
          {!history || history.messages.length === 0 ? (
            <p className="text-muted-foreground">Noch kein Chat-Verlauf vorhanden.</p>
          ) : (
            <div className="space-y-4 max-h-125 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
              {history.messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`p-4 rounded-lg text-sm ${
                    message.role === "user" 
                      ? "bg-primary/10 border border-primary/20 ml-auto max-w-[85%]" 
                      : "bg-muted/50 border max-w-[85%]"
                  }`}
                >
                  <p className="font-semibold mb-1 text-xs text-muted-foreground uppercase tracking-wider">
                    {message.role === "user" ? "Du" : "KI-Berater"}
                  </p>
                  <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed max-w-none">
                    {message.role === "user" ? (
                      (message as unknown as { content: string }).content
                    ) : (
                      <ReactMarkdown>{(message as unknown as { content: string }).content}</ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
