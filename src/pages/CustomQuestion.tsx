import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AITeacherChat } from "@/components/AITeacherChat";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CustomQuestion = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const questionText = location.state?.questionText || "";
  const sessionId = location.state?.sessionId || "";
  
  const [userAnswer, setUserAnswer] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Olá! Vi que você enviou uma foto de uma questão. Vou te ajudar a resolver:\n\n${questionText}\n\nPode resolver e me enviar sua resposta, ou se tiver dúvidas, é só perguntar!`,
    },
  ]);

  const handleSubmit = () => {
    if (!userAnswer.trim()) {
      toast({
        title: "Resposta vazia",
        description: "Por favor, digite sua resposta antes de enviar.",
        variant: "destructive",
      });
      return;
    }

    setShowFeedback(true);
    
    // Adicionar a resposta do aluno ao chat
    const newMessages: Message[] = [
      ...chatMessages,
      { role: "user", content: `Minha resposta: ${userAnswer}` },
      { 
        role: "assistant", 
        content: "Obrigado por compartilhar sua resposta! Vou analisá-la. Se tiver alguma dúvida sobre os passos da solução, pode me perguntar."
      }
    ];
    setChatMessages(newMessages);
    setChatOpen(true);
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-success/10 flex">
      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${chatOpen ? 'mr-96' : ''}`}>
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Button variant="ghost" onClick={handleBack} className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>

          <Card className="mb-6">
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                  Questão por Foto
                </span>
              </div>
              <CardTitle className="text-xl leading-relaxed">
                {questionText || "Carregando questão..."}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!showFeedback ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sua resposta</label>
                    <Input
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder="Digite sua resposta..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSubmit();
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={handleSubmit}
                      disabled={!userAnswer.trim()}
                      className="w-full"
                      size="lg"
                    >
                      Enviar Resposta
                    </Button>
                    
                    <Button
                      onClick={() => setChatOpen(true)}
                      variant="outline"
                      className="w-full"
                      size="lg"
                    >
                      Pedir Ajuda ao Professor IA
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Card className="border-l-4 border-l-primary bg-primary/5">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3 mb-4">
                        <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2">
                            Resposta Enviada! 📝
                          </h3>
                          
                          <p className="text-sm mb-3">
                            ✓ Sua resposta: {userAnswer}
                          </p>

                          <p className="text-sm text-muted-foreground">
                            Sua resposta foi registrada. Consulte o Professor IA para obter feedback detalhado e tirar dúvidas sobre a resolução.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    <Button
                      onClick={() => setChatOpen(true)}
                      className="w-full"
                      size="lg"
                    >
                      Consultar Professor IA
                    </Button>
                    
                    <Button
                      onClick={handleBack}
                      variant="outline"
                      className="w-full"
                      size="lg"
                    >
                      Voltar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Chat Sidebar */}
      {chatOpen && (
        <div className="fixed right-0 top-0 h-screen w-96 z-50">
          <AITeacherChat
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            initialMessages={chatMessages}
            onMessagesChange={setChatMessages}
            sessionId={sessionId}
          />
        </div>
      )}
    </div>
  );
};

export default CustomQuestion;
