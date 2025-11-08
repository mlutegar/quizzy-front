import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { X, Send, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AITeacherChatProps {
  isOpen: boolean;
  onClose: () => void;
  onMessagesChange?: (messages: Message[]) => void;
  initialMessages?: Message[];
  sessionId?: string;
}

const FLASK_API_URL = "http://localhost:5000";

export const AITeacherChat = ({ isOpen, onClose, onMessagesChange, initialMessages, sessionId }: AITeacherChatProps) => {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages || [
      {
        role: "assistant",
        content: "Olá! Sou seu professor particular de IA. Pode me perguntar qualquer coisa sobre matemática ou tirar dúvidas sobre os exercícios. Como posso te ajudar?",
      },
    ]
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync external messages
  useEffect(() => {
    if (initialMessages && initialMessages.length !== messages.length) {
      setMessages(initialMessages);
    }
  }, [initialMessages?.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  const sendToFlask = async (userMessage: string) => {
    const response = await fetch(`${FLASK_API_URL}/respond`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        response: userMessage,
        session_id: sessionId
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao enviar mensagem: ${response.status}`);
    }

    const data = await response.json();
    
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: data.question || data.message || "Desculpe, não entendi." }
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      if (sessionId) {
        await sendToFlask(userMessage);
      } else {
        throw new Error("Session ID não disponível");
      }
    } catch (error) {
      console.error("Erro no chat:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Desculpe, tive um problema para processar sua mensagem. Pode tentar novamente?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="h-full flex flex-col border-l-2 border-primary/20 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary/5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Professor IA</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg p-3",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
};
