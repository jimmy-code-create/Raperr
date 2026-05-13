import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Send, Loader2, Sparkles, Zap, RefreshCw, Bot } from "lucide-react";

interface Message { role: "user" | "assistant"; content: string; id: string; }

const QUICK_PROMPTS = [
  "Write me a fire Instagram caption 🔥",
  "What's trending in music rn?",
  "Give me gaming tips for ranked",
  "Help me write a bio that slays",
  "What anime should I watch next?",
  "How do I get more followers?",
];

const JIMMY_INTRO = "Hey bestie! 👋 I'm Jimmy, your personal Rizz AI tutor. I'm here to help with anything — captions, advice, creative ideas, music recs, gaming tips, or just vibing fr fr. What can I help you with today? ✨";

export default function JimmyPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: JIMMY_INTRO, id: "intro" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content, id: Date.now().toString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/jimmy/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages
            .filter(m => m.id !== "intro")
            .map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      const reply = data.reply ?? "My brain glitched bestie 😅 Try again!";
      setMessages(prev => [...prev, { role: "assistant", content: reply, id: Date.now().toString() }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Oof, connection issues bestie 😅 Check your internet!", id: Date.now().toString() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const reset = () => {
    setMessages([{ role: "assistant", content: JIMMY_INTRO, id: "intro" }]);
    setInput("");
  };

  return (
    <Layout>
      <div className="flex flex-col h-screen max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4 border-b border-border/40 flex-shrink-0"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(280 80% 60% / 0.04))" }}>
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl btn-primary flex items-center justify-center shadow-lg glow-primary-sm float">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-background shadow-sm" style={{ boxShadow: "0 0 8px rgba(74,222,128,0.7)" }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-foreground">Jimmy</h1>
              <span className="text-[10px] font-black px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">AI Tutor</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
              Always online · Powered by Rizz AI
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reset} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all" title="New chat">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
          {messages.map((msg) => {
            const isJimmy = msg.role === "assistant";
            return (
              <div key={msg.id} className={cn("flex items-end gap-2.5 slide-up", isJimmy ? "justify-start" : "justify-end")}>
                {isJimmy && (
                  <div className="w-8 h-8 rounded-2xl btn-primary flex items-center justify-center flex-shrink-0 shadow-md">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                  isJimmy
                    ? "bg-card border border-border/40 text-foreground rounded-bl-sm"
                    : "btn-primary text-primary-foreground rounded-br-sm glow-primary-sm"
                )}>
                  {msg.content}
                </div>
                {!isJimmy && (
                  <Avatar src={user?.profileImageUrl} name={user?.firstName || "Me"} size="xs" />
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-end gap-2.5 slide-up">
              <div className="w-8 h-8 rounded-2xl btn-primary flex items-center justify-center flex-shrink-0 shadow-md">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-card border border-border/40 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts */}
        {messages.length <= 2 && !loading && (
          <div className="px-4 pb-3 flex-shrink-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Quick prompts</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => send(p)}
                  className="flex-shrink-0 px-3 py-2 bg-card border border-border/40 text-foreground text-xs rounded-2xl hover:border-primary/40 hover:bg-primary/5 transition-all font-medium whitespace-nowrap">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-border/40 flex-shrink-0">
          <div className="flex items-center gap-2 bg-card border border-border/40 rounded-2xl px-4 py-2.5 focus-within:border-primary/40 transition-all shadow-sm">
            <Zap className="w-4 h-4 text-primary/60 flex-shrink-0" />
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && input.trim()) { e.preventDefault(); send(); } }}
              placeholder="Ask Jimmy anything… ✨"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                input.trim() && !loading ? "btn-primary text-white glow-primary-sm hover:scale-110 active:scale-95" : "text-muted-foreground"
              )}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground/50 mt-1.5">Jimmy can make mistakes. Use your own judgment fr fr.</p>
        </div>
      </div>
    </Layout>
  );
}
