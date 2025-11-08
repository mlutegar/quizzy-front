import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Subject from "./pages/Subject";
import Quiz from "./pages/Quiz";
import NotFound from "./pages/NotFound";
import { AITeacherChat } from "./components/AITeacherChat";

const queryClient = new QueryClient();

const App = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="flex h-screen w-full overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/matematica" element={<Subject />} />
                <Route path="/quiz/:topicId" element={<Quiz />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>

            {/* AI Chat Sidebar */}
            <div
              className={`transition-all duration-300 ease-in-out ${
                isChatOpen ? "w-96" : "w-0"
              } overflow-hidden`}
            >
              <AITeacherChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            </div>

            {/* Floating Chat Toggle Button */}
            {!isChatOpen && (
              <Button
                onClick={() => setIsChatOpen(true)}
                className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 w-14"
                size="icon"
              >
                <MessageSquare className="w-6 h-6" />
              </Button>
            )}
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
