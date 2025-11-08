import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, BookOpen, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
      }
      setLoading(false);
    });
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até a próxima!",
    });
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-success/10">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">MathMaster AI</h1>
              <p className="text-sm text-muted-foreground">Olá, {user?.user_metadata?.full_name || "Estudante"}!</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
            Aprenda Matemática de Forma Inteligente
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Seu professor particular de IA identifica suas dificuldades e adapta o ensino especialmente para você
          </p>
        </div>

        {/* Subject Card */}
        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-semibold mb-6 text-foreground">Escolha sua matéria</h3>
          <Card 
            className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary"
            onClick={() => navigate("/matematica")}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-xl">
                  <BookOpen className="w-10 h-10 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">Matemática</CardTitle>
                  <CardDescription className="text-base">
                    Funções, logaritmos, trigonometria e muito mais
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg">
                Começar a Estudar
              </Button>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-3xl mb-2">🎯</div>
                <h4 className="font-semibold mb-2">Diagnóstico Preciso</h4>
                <p className="text-sm text-muted-foreground">
                  Identifica exatamente onde está sua dificuldade
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-3xl mb-2">🤖</div>
                <h4 className="font-semibold mb-2">IA Personalizada</h4>
                <p className="text-sm text-muted-foreground">
                  Adapta o ensino ao seu ritmo e nível
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-3xl mb-2">📈</div>
                <h4 className="font-semibold mb-2">Progresso Real</h4>
                <p className="text-sm text-muted-foreground">
                  Acompanhe seu domínio em cada tópico
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
