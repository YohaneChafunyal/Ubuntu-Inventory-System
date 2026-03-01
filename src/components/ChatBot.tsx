import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MessageSquare, Send, X, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState<'English' | 'Portuguese' | 'French'>('English');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your Ubuntu Kitchen AI Assistant. How can I help you with your inventory data or expense predictions today?' }
  ]);

  // Update initial message when language changes
  useEffect(() => {
    if (messages.length === 1) {
      const greetings = {
        English: 'Hello! I am your Ubuntu Kitchen AI Assistant. How can I help you with your inventory data or expense predictions today?',
        Portuguese: 'Olá! Sou o seu Assistente de IA da Cozinha Ubuntu. Como posso ajudá-lo com os seus dados de inventário ou previsões de despesas hoje?',
        French: 'Bonjour ! Je suis votre assistant IA de la cuisine Ubuntu. Comment puis-je vous aider avec vos données d\'inventaire ou vos prévisions de dépenses aujourd\'hui ?'
      };
      setMessages([{ role: 'model', text: greetings[language] }]);
    }
  }, [language]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // 1. Fetch current context from DB
      const contextRes = await fetch('/api/ai/context');
      const context = await contextRes.json();

      // 2. Initialize Gemini
      const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
      const model = "gemini-3.1-pro-preview";

      const systemInstruction = `
        You are the "Ubuntu Kitchen AI Assistant". 
        You have access to the real-time inventory data of the Ubuntu School Kitchen.
        
        LANGUAGE: You MUST respond in ${language}.
        
        CURRENT CONTEXT:
        - Current Stock Levels: ${JSON.stringify(context.stocks)}
        - Recent Transactions: ${JSON.stringify(context.recentTransactions)}
        - Monthly Trends (Last 12 months): ${JSON.stringify(context.monthlyTrends)}
        - Current Time: ${context.currentTime}

        YOUR TASKS:
        1. Answer questions about current stock levels, recent purchases, or consumption.
        2. Explain dashboard charts (e.g., "Inventory Volume Trend" shows units in vs out).
        3. Predict future expenses based on historical "bucks_in" and "units_out" trends.
        4. Be professional, helpful, and concise. Use MKW (Malawian Kwacha) for currency.
        5. If asked for predictions, analyze the "monthlyTrends" and provide a reasoned estimate for the next month or year.
      `;

      const chat = ai.chats.create({
        model,
        config: {
          systemInstruction,
        },
        history: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }))
      });

      const result = await chat.sendMessage({ message: userMessage });
      const responseText = result.text;

      setMessages(prev => [...prev, { role: 'model', text: responseText || 'I am sorry, I could not process that request.' }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error connecting to my brain. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[400px] h-[600px] flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-primary p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Ubuntu Kitchen AI</h3>
                  <div className="flex gap-1 mt-1">
                    {(['English', 'Portuguese', 'French'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        className={`text-[9px] px-1.5 py-0.5 rounded border ${
                          language === lang 
                            ? 'bg-white text-primary border-white' 
                            : 'border-white/30 text-white/70 hover:border-white/60'
                        }`}
                      >
                        {lang === 'English' ? 'EN' : lang === 'Portuguese' ? 'PT' : 'FR'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    m.role === 'user' 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs text-slate-500">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-100 bg-white">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about inventory or predictions..."
                  className="w-full pl-4 pr-12 py-3 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 text-center flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3" /> Powered by Gemini 3.1 Pro
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 rounded-full shadow-lg transition-all duration-300 flex items-center gap-2 ${
          isOpen ? 'bg-slate-800 text-white' : 'bg-primary text-white hover:scale-110'
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!isOpen && <span className="font-bold text-sm pr-2">Ask AI</span>}
      </button>
    </div>
  );
};
