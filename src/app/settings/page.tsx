"use client";

import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { type UIMessage as Message } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import { getProfile, updateProfile, deleteAccountData, exportAccountData } from "./actions";

interface ChatHistoryRecord {
  id: string;
  user_id: string;
  messages: Message[];
  updated_at: string;
}

export default function SettingsPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  const [history, setHistory] = useState<ChatHistoryRecord | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const supabase = createClient();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      const { data: pData } = await getProfile();
      if (pData) {
        setProfile(pData);
      }

      const { data, error } = await supabase
        .from("chat_history")
        .select("*")
        .eq("user_id", user.id)
        .single();
        
      if (error && error.code !== "PGRST116") {
        console.error("Error fetching chat history:", error);
      } else if (data) {
        setHistory(data as ChatHistoryRecord);
      }
      setIsLoadingHistory(false);
    }

    if (!loading && user) {
      fetchData();
    }
  }, [user, loading, supabase]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSaveMessage("");

    startTransition(async () => {
      const res = await updateProfile(formData);
      if (res.error) {
        setSaveMessage(`Fehler: ${res.error}`);
      } else {
        setSaveMessage("Einstellungen erfolgreich gespeichert.");
        // optionally refetch profile here or let optimistic UI handle it
      }
    });
  };

  const handleExport = async () => {
    const { data, error } = await exportAccountData();
    if (error || !data) {
      alert("Fehler beim Exportieren der Daten");
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etf_finder_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    const res = await deleteAccountData();
    if (res.success) {
      await signOut();
      router.push("/");
    } else {
      alert("Fehler beim Löschen der Daten: " + res.error);
      setIsDeleting(false);
    }
  };

  if (loading || isLoadingHistory) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Lade Einstellungen...</div>;
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 tracking-tight">Einstellungen</h1>
      
      <div className="space-y-8">

        {/* Profile Settings */}
        <section className="bg-card rounded-xl p-6 border border-border/50 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 tracking-tight">Profil & Präferenzen</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="display_name" className="text-sm font-medium">Anzeigename</label>
                <input
                  type="text"
                  id="display_name"
                  name="display_name"
                  defaultValue={profile?.display_name || ""}
                  className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  placeholder="Max Mustermann"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="risk_tolerance" className="text-sm font-medium">Risikotoleranz</label>
                <select
                  id="risk_tolerance"
                  name="risk_tolerance"
                  defaultValue={profile?.risk_tolerance || ""}
                  className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="">Keine Angabe</option>
                  <option value="conservative">Konservativ</option>
                  <option value="balanced">Ausgewogen</option>
                  <option value="aggressive">Aggressiv</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="base_currency" className="text-sm font-medium">Basiswährung</label>
                <select
                  id="base_currency"
                  name="base_currency"
                  defaultValue={profile?.base_currency || "EUR"}
                  className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="investment_horizon_years" className="text-sm font-medium">Anlagehorizont (Jahre)</label>
                <input
                  type="number"
                  id="investment_horizon_years"
                  name="investment_horizon_years"
                  min="0"
                  max="100"
                  defaultValue={profile?.investment_horizon_years || ""}
                  className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  placeholder="z.B. 10"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="data_sharing_consent"
                name="data_sharing_consent"
                defaultChecked={profile?.data_sharing_consent || false}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
              />
              <label htmlFor="data_sharing_consent" className="text-sm font-medium leading-none">
                Ich stimme der Datenverarbeitung für personalisierte Empfehlungen zu.
              </label>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-border/50">
              <p className="text-sm text-muted-foreground">Eingeloggt als: <span className="font-medium text-foreground">{user.email}</span></p>
              <div className="flex items-center gap-3">
                {saveMessage && (
                  <span className={`text-sm ${saveMessage.startsWith("Fehler") ? "text-destructive" : "text-green-600"}`}>
                    {saveMessage}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Speichern..." : "Speichern"}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Data Privacy & Account Controls */}
        <section className="bg-card rounded-xl p-6 border border-border/50 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 tracking-tight text-destructive">Datenschutz & Konto</h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Verwalte deine persönlichen Daten gemäß DSGVO. Du kannst deine Daten jederzeit exportieren oder vollständig löschen.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExport}
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Meine Daten exportieren (JSON)
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
              >
                Konto & Daten löschen
              </button>
            </div>
          </div>
        </section>

        {/* Chat History */}
        <section className="bg-card rounded-xl p-6 border border-border/50 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 tracking-tight">Letzter Chat-Verlauf</h2>
          {!history || history.messages.length === 0 ? (
            <p className="text-muted-foreground text-sm">Noch kein Chat-Verlauf vorhanden.</p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
              {history.messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`p-4 rounded-xl text-sm ${
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
                      (message as any).content
                    ) : (
                      <ReactMarkdown>{(message as any).content}</ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md p-6 rounded-xl border shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Bist du sicher?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Diese Aktion kann nicht rückgängig gemacht werden. Alle deine gespeicherten ETFs, Einstellungen und Chat-Verläufe werden dauerhaft gelöscht.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="inline-flex h-9 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {isDeleting ? "Lösche..." : "Ja, unwiderruflich löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
