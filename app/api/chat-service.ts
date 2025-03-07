interface StreamingCallbacks {
    onChunk: (chunk: string) => void;
    onError: (error: Error) => void;
    onComplete: (fullResponse: string) => void;
  }
  
  export interface ChatResponse {
    answer: string;
    error?: string;
  }
  
  export class ChatService {
    private static async makeStreamingRequest(
      endpoint: string,
      query: string,
      callbacks: StreamingCallbacks
    ): Promise<void> {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });
  
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
  
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to get response reader");
        }
  
        let fullResponse = "";
  
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
  
          const chunk = new TextDecoder().decode(value);
          fullResponse += chunk;
          callbacks.onChunk(chunk);
        }
  
        callbacks.onComplete(fullResponse);
      } catch (error) {
        if (error instanceof Error) {
          callbacks.onError(error);
        } else {
          callbacks.onError(new Error("Unknown error occurred"));
        }
      }
    }
  
    public static async sendResearchQuery(
      query: string,
      callbacks: StreamingCallbacks
    ): Promise<void> {
      return this.makeStreamingRequest("/api/research", query, callbacks);
    }
  }
  
  // Utility functions for text processing
  export const processStreamingText = (text: string): string[] => {
    return text.split(" ").filter(word => word.length > 0);
  };
  
  export const chunkWords = (words: string[], chunkSize: number): string[][] => {
    const chunks: string[][] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize));
    }
    return chunks;
  }; 