import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { problem, workShown, response: studentResponse, session_id } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;

    // Check if this is a response to a previous hint
    if (studentResponse && session_id) {
      console.log("Processing student response for session:", session_id);
      
      systemPrompt = `Você é um professor de matemática experiente que usa o método socrático. 
O aluno acabou de responder uma pergunta sua. Analise a resposta e:
- Se a resposta está no caminho certo, faça uma nova pergunta que avance para o próximo conceito
- Se a resposta precisa de correção, faça uma pergunta que ajude o aluno a perceber o erro
NÃO dê a resposta direta. Faça UMA pergunta que continue guiando o raciocínio.
Seja breve e direto - apenas UMA pergunta curta e clara.`;

      userPrompt = `Resposta do aluno: "${studentResponse}"

Faça UMA pergunta socrática que ajude o aluno a continuar avançando no raciocínio.`;
    } else {
      console.log("Generating initial hint for problem:", problem);
      
      systemPrompt = `Você é um professor de matemática experiente que usa o método socrático. 
Seu objetivo é fazer uma pergunta instigante que ajude o aluno a pensar e descobrir o caminho correto por si mesmo.
NÃO dê a resposta direta. Faça UMA pergunta que direcione o raciocínio do aluno.
A pergunta deve ser sobre um conceito específico necessário para resolver o problema.
Seja breve e direto - apenas UMA pergunta curta e clara.`;

      userPrompt = `O aluno está tentando resolver: "${problem}"

Desenvolvimento do aluno até agora: "${workShown || 'O aluno ainda não escreveu nada'}"

Faça UMA pergunta socrática que ajude o aluno a pensar no próximo passo ou conceito necessário.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Entre em contato com o suporte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const question = data.choices[0].message.content;

    console.log("Generated hint successfully");

    // Use existing session_id or generate a new one
    const sessionId = session_id || crypto.randomUUID();

    return new Response(
      JSON.stringify({ 
        created_at: new Date().toISOString(),
        hint_level: 0,
        phase: "UNDERSTANDING",
        problem: problem || "",
        question,
        session_id: sessionId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-hint function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao gerar dica" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
