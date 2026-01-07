import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatResponse {
  message: string;
  suggested_search: string | null;
  conversation_id?: string;
}

export function useContentAssistant(learningObjectiveId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string): Promise<ChatResponse> => {
      const { data, error } = await supabase.functions.invoke('content-assistant-chat', {
        body: {
          learning_objective_id: learningObjectiveId,
          message,
          conversation_history: messages,
        },
      });

      if (error) throw error;
      return data;
    },
    onMutate: (message) => {
      // Optimistically add user message
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);
      setIsTyping(true);
    },
    onSuccess: (data) => {
      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    },
    onError: (error) => {
      console.error('Chat error:', error);
      toast.error('Failed to get response from assistant');
      // Remove the optimistic user message
      setMessages(prev => prev.slice(0, -1));
      setIsTyping(false);
    },
  });

  const sendMessage = useCallback((message: string) => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  }, [sendMessageMutation]);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isTyping,
    isLoading: sendMessageMutation.isPending,
    sendMessage,
    clearChat,
    suggestedSearch: sendMessageMutation.data?.suggested_search,
  };
}
