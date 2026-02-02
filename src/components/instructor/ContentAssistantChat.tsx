import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Sparkles, Search, X, Lightbulb } from 'lucide-react';
import { useContentAssistant } from '@/hooks/useContentAssistant';
import { cn } from '@/lib/utils';

interface ContentAssistantChatProps {
  learningObjectiveId: string;
  learningObjectiveText: string;
  bloomLevel?: string;
  onSearchRequest?: (query: string) => void;
  onClose?: () => void;
}

const QUICK_PROMPTS = [
  { label: 'Why this video?', message: 'Why did you recommend the top video?' },
  { label: 'More practical', message: 'Find me something more practical and hands-on' },
  { label: 'University content', message: 'Show me alternatives from university channels only' },
  { label: 'Shorter videos', message: 'I need shorter videos, around 5-10 minutes' },
];

export function ContentAssistantChat({ 
  learningObjectiveId, 
  learningObjectiveText,
  bloomLevel,
  onSearchRequest,
  onClose 
}: ContentAssistantChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { messages, isTyping, isLoading, sendMessage, suggestedSearch } = useContentAssistant(learningObjectiveId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Handle suggested search from AI
  useEffect(() => {
    if (suggestedSearch && onSearchRequest) {
      // Show a button to execute the search
    }
  }, [suggestedSearch, onSearchRequest]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleQuickPrompt = (message: string) => {
    sendMessage(message);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <span>Content Assistant</span>
            <Badge variant="outline" className="ml-2 text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              AI
            </Badge>
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close content assistant">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
          Helping you find content for: "{learningObjectiveText}"
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick prompts */}
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lightbulb className="h-4 w-4" />
              <span>Quick actions</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <Button
                  key={prompt.label}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleQuickPrompt(prompt.message)}
                  disabled={isLoading}
                >
                  {prompt.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.length > 0 && (
          <ScrollArea className="h-64" ref={scrollRef}>
            <div className="space-y-4 pr-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3",
                    msg.role === 'user' && "justify-end"
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 max-w-[80%] text-sm",
                      msg.role === 'user' 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center">
                    <Bot className="h-3 w-3 text-primary animate-pulse" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Search suggestion from AI */}
        {suggestedSearch && onSearchRequest && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm">
              <Search className="h-4 w-4 text-primary" />
              <span className="font-medium">Suggested search:</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 mb-2">"{suggestedSearch}"</p>
            <Button 
              size="sm" 
              onClick={() => onSearchRequest(suggestedSearch)}
              className="w-full"
            >
              <Search className="h-3 w-3 mr-2" />
              Run this search
            </Button>
          </div>
        )}

        {/* Input form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about content recommendations..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
