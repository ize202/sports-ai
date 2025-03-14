"use client";

import "ios-vibrator-pro-max";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import parse from "html-react-parser";
import {
  Search,
  Plus,
  Lightbulb,
  ArrowUp,
  Menu,
  PenSquare,
  RefreshCcw,
  Copy,
  Share2,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ChatService,
  processStreamingText,
  chunkWords,
} from "@/app/api/chat-service";
import { RateLimitService } from "@/app/api/rate-limit-service";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Add CSS animations and HTML styles
const animationStyles = `
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }
  
  .animate-pulse-subtle {
    animation: pulse-subtle 2s infinite;
  }

  /* HTML Content Styles */
  .chat-content {
    line-height: 1.5;
    color: #ECECF1;
  }
  
  .chat-content h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1rem 0;
    color: #ECECF1;
  }
  
  .chat-content h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0.75rem 0;
    color: #ECECF1;
  }
  
  .chat-content h3, .chat-content h4, .chat-content h5, .chat-content h6 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0.5rem 0;
    color: #ECECF1;
  }
  
  .chat-content p {
    margin: 0.5rem 0;
    color: #ECECF1;
  }
  
  .chat-content ul, .chat-content ol {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
    color: #ECECF1;
  }
  
  .chat-content ul {
    list-style-type: disc;
  }
  
  .chat-content ol {
    list-style-type: decimal;
  }
  
  .chat-content li {
    margin: 0.25rem 0;
  }
  
  .chat-content strong {
    font-weight: 600;
    
  }
  
  .chat-content em {
    font-style: italic;
    color: #ECECF1;
  }
  
  .chat-content table {
    border-collapse: collapse;
    margin: 1rem 0;
    width: 100%;
  }
  
  .chat-content th, .chat-content td {
    border: 1px solid #40414F;
    padding: 0.5rem;
    text-align: left;
  }
  
  .chat-content th {
    background-color: #202123;
    font-weight: 600;
  }

  .chat-content img {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    margin: 1rem 0;
    display: block;
  }

  .chat-content a {
    color: #3B82F6;
    text-decoration: none;
    transition: opacity 0.2s ease;
  }

  .chat-content a:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  .chat-content br {
    content: "";
    display: block;
    margin: 0.5rem 0;
  }
`;

type ActiveButton = "none" | "add" | "deepSearch" | "think";
type MessageType = "user" | "system";

interface Message {
  id: string;
  content: string;
  type: MessageType;
  completed?: boolean;
  newSection?: boolean;
}

interface MessageSection {
  id: string;
  messages: Message[];
  isNewSection: boolean;
  isActive?: boolean;
  sectionIndex: number;
}

interface StreamingWord {
  id: number;
  text: string;
}

// Faster word delay for smoother streaming
const WORD_DELAY = 40; // ms per word
const CHUNK_SIZE = 2; // Number of words to add at once

export default function ChatInterface() {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const newSectionRef = useRef<HTMLDivElement>(null);
  const [hasTyped, setHasTyped] = useState(false);
  const [activeButton, setActiveButton] = useState<ActiveButton>("none");
  const [isMobile, setIsMobile] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageSections, setMessageSections] = useState<MessageSection[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingWords, setStreamingWords] = useState<StreamingWord[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  );
  const [viewportHeight, setViewportHeight] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [completedMessages, setCompletedMessages] = useState<Set<string>>(
    new Set()
  );
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const shouldFocusAfterStreamingRef = useRef(false);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  // Store selection state
  const selectionStateRef = useRef<{
    start: number | null;
    end: number | null;
  }>({ start: null, end: null });
  const queryCountTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showQueryCount, setShowQueryCount] = useState(false);
  const [remainingQueries, setRemainingQueries] = useState(5);
  const [isWaitlistMode, setIsWaitlistMode] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailError, setEmailError] = useState(false);

  // Constants for layout calculations to account for the padding values
  const HEADER_HEIGHT = 48; // 12px height + padding
  const INPUT_AREA_HEIGHT = 100; // Approximate height of input area with padding
  const TOP_PADDING = 48; // pt-12 (3rem = 48px)
  const BOTTOM_PADDING = 128; // pb-32 (8rem = 128px)
  const ADDITIONAL_OFFSET = 16; // Reduced offset for fine-tuning

  // Check if device is mobile and get viewport height
  useEffect(() => {
    const checkMobileAndViewport = () => {
      const isMobileDevice = window.innerWidth < 768;
      setIsMobile(isMobileDevice);

      // Capture the viewport height
      const vh = window.innerHeight;
      setViewportHeight(vh);

      // Apply fixed height to main container on mobile
      if (isMobileDevice && mainContainerRef.current) {
        mainContainerRef.current.style.height = `${vh}px`;
      }
    };

    checkMobileAndViewport();

    // Set initial height
    if (mainContainerRef.current) {
      mainContainerRef.current.style.height = isMobile
        ? `${viewportHeight}px`
        : "100svh";
    }

    // Check if queries are already exhausted on initial load
    if (RateLimitService.getRemainingQueries() === 0) {
      setIsWaitlistMode(true);
    }

    // Update on resize
    window.addEventListener("resize", checkMobileAndViewport);

    return () => {
      window.removeEventListener("resize", checkMobileAndViewport);
    };
  }, [isMobile, viewportHeight]);

  // Organize messages into sections
  useEffect(() => {
    if (messages.length === 0) {
      setMessageSections([]);
      setActiveSectionId(null);
      return;
    }

    const sections: MessageSection[] = [];
    let currentSection: MessageSection = {
      id: `section-${Date.now()}-0`,
      messages: [],
      isNewSection: false,
      sectionIndex: 0,
    };

    messages.forEach((message) => {
      if (message.newSection) {
        // Start a new section
        if (currentSection.messages.length > 0) {
          // Mark previous section as inactive
          sections.push({
            ...currentSection,
            isActive: false,
          });
        }

        // Create new active section
        const newSectionId = `section-${Date.now()}-${sections.length}`;
        currentSection = {
          id: newSectionId,
          messages: [message],
          isNewSection: true,
          isActive: true,
          sectionIndex: sections.length,
        };

        // Update active section ID
        setActiveSectionId(newSectionId);
      } else {
        // Add to current section
        currentSection.messages.push(message);
      }
    });

    // Add the last section if it has messages
    if (currentSection.messages.length > 0) {
      sections.push(currentSection);
    }

    setMessageSections(sections);
  }, [messages]);

  // Scroll to maximum position when new section is created, but only for sections after the first
  useEffect(() => {
    if (messageSections.length > 1) {
      setTimeout(() => {
        const scrollContainer = chatContainerRef.current;

        if (scrollContainer) {
          // Scroll to maximum possible position
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 100);
    }
  }, [messageSections]);

  // Focus the textarea on component mount (only on desktop)
  useEffect(() => {
    if (textareaRef.current && !isMobile) {
      textareaRef.current.focus();
    }
  }, [isMobile]);

  // Set focus back to textarea after streaming ends (only on desktop)
  useEffect(() => {
    if (!isStreaming && shouldFocusAfterStreamingRef.current && !isMobile) {
      focusTextarea();
      shouldFocusAfterStreamingRef.current = false;
    }
  }, [isStreaming, isMobile]);

  // Calculate available content height (viewport minus header and input)
  const getContentHeight = () => {
    // Calculate available height by subtracting the top and bottom padding from viewport height
    return viewportHeight - TOP_PADDING - BOTTOM_PADDING - ADDITIONAL_OFFSET;
  };

  // Save the current selection state
  const saveSelectionState = () => {
    if (textareaRef.current) {
      selectionStateRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }
  };

  // Restore the saved selection state
  const restoreSelectionState = () => {
    const textarea = textareaRef.current;
    const { start, end } = selectionStateRef.current;

    if (textarea && start !== null && end !== null) {
      // Focus first, then set selection range
      textarea.focus();
      textarea.setSelectionRange(start, end);
    } else if (textarea) {
      // If no selection was saved, just focus
      textarea.focus();
    }
  };

  const focusTextarea = () => {
    if (textareaRef.current && !isMobile) {
      textareaRef.current.focus();
    }
  };

  const handleInputContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only focus if clicking directly on the container, not on buttons or other interactive elements
    if (
      e.target === e.currentTarget ||
      (e.currentTarget === inputContainerRef.current &&
        !(e.target as HTMLElement).closest("button"))
    ) {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const simulateTextStreaming = async (text: string) => {
    // Split text into words
    const words = text.split(" ");
    let currentIndex = 0;
    setStreamingWords([]);
    setIsStreaming(true);

    return new Promise<void>((resolve) => {
      const streamInterval = setInterval(() => {
        if (currentIndex < words.length) {
          // Add a few words at a time
          const nextIndex = Math.min(currentIndex + CHUNK_SIZE, words.length);
          const newWords = words.slice(currentIndex, nextIndex);

          setStreamingWords((prev) => [
            ...prev,
            {
              id: Date.now() + currentIndex,
              text: newWords.join(" ") + " ",
            },
          ]);

          currentIndex = nextIndex;
        } else {
          clearInterval(streamInterval);
          resolve();
        }
      }, WORD_DELAY);
    });
  };

  const getAIResponse = async (userMessage: string) => {
    // Check rate limit before proceeding
    const canProceed = await RateLimitService.incrementQueryCount();
    if (!canProceed) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          content:
            "You've reached your daily limit of 5 queries. Please try again tomorrow or join our waitlist to get notified when we launch the app.",
          type: "system",
          completed: true,
        },
      ]);
      setIsWaitlistMode(true); // Automatically switch to waitlist mode
      return;
    }

    // Update remaining queries
    setRemainingQueries(RateLimitService.getRemainingQueries());

    // Show query count notification
    setShowQueryCount(true);
    if (queryCountTimerRef.current) {
      clearTimeout(queryCountTimerRef.current);
    }
    queryCountTimerRef.current = setTimeout(() => {
      setShowQueryCount(false);
      // Check if this was the last query and switch to waitlist mode if so
      if (RateLimitService.getRemainingQueries() === 0) {
        setIsWaitlistMode(true);
      }
    }, 3000);

    // Create a new message with empty content
    const messageId = Date.now().toString();
    setStreamingMessageId(messageId);

    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        content: "",
        type: "system",
      },
    ]);

    // Add a delay before the second vibration
    setTimeout(() => {
      // Add vibration when streaming begins
      navigator.vibrate(50);
    }, 200);

    setIsStreaming(true);
    let fullResponse = "";
    // Clear streaming words at the start
    setStreamingWords([]);

    try {
      await ChatService.sendResearchQuery(userMessage, {
        onChunk: (chunk) => {
          // Process the incoming chunk
          const words = processStreamingText(chunk);

          // Update the full response
          fullResponse += chunk;

          // Instead of updating streaming words, update the message content directly
          // This provides a smoother experience
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, content: fullResponse } : msg
            )
          );
        },
        onError: (error) => {
          console.error("API error:", error);
          const errorMessage =
            error.message ||
            "Sorry, an error occurred while processing your request.";
          const userFriendlyMessage = errorMessage.includes("404")
            ? "Sorry, the research service is currently unavailable. Please try again later."
            : `Error: ${errorMessage}`;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, content: userFriendlyMessage, completed: true }
                : msg
            )
          );
          setIsStreaming(false);
          setStreamingMessageId(null);
        },
        onComplete: (completeResponse) => {
          // Update with complete message
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, content: completeResponse, completed: true }
                : msg
            )
          );

          // Add to completed messages set to prevent re-animation
          setCompletedMessages((prev) => new Set(prev).add(messageId));

          // Add vibration when streaming ends
          navigator.vibrate(50);

          // Reset streaming state
          setStreamingMessageId(null);
          setIsStreaming(false);
        },
      });
    } catch (error) {
      console.error("Failed to get AI response:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const userFriendlyMessage = errorMessage.includes("404")
        ? "Sorry, the research service is currently unavailable. Please try again later."
        : `Error: ${errorMessage}`;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, content: userFriendlyMessage, completed: true }
            : msg
        )
      );
      setIsStreaming(false);
      setStreamingMessageId(null);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const newValue = e.target.value;

    // Only allow input changes when not streaming
    if (!isStreaming) {
      setInputValue(newValue);

      if (newValue.trim() !== "" && !hasTyped) {
        setHasTyped(true);
      } else if (newValue.trim() === "" && hasTyped) {
        setHasTyped(false);
      }

      // Only adjust textarea height when not in waitlist mode
      if (!isWaitlistMode) {
        const textarea = textareaRef.current as HTMLTextAreaElement;
        if (textarea) {
          textarea.style.height = "auto";
          const newHeight = Math.max(24, Math.min(textarea.scrollHeight, 160));
          textarea.style.height = `${newHeight}px`;
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isStreaming) {
      // Add vibration when message is submitted
      navigator.vibrate(50);

      const userMessage = inputValue.trim();

      // Add as a new section if messages already exist
      const shouldAddNewSection = messages.length > 0;

      const newUserMessage = {
        id: `user-${Date.now()}`,
        content: userMessage,
        type: "user" as MessageType,
        newSection: shouldAddNewSection,
      };

      // Reset input before starting the AI response
      setInputValue("");
      setHasTyped(false);
      setActiveButton("none");

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Add the message after resetting input
      setMessages((prev) => [...prev, newUserMessage]);

      // Only focus the textarea on desktop, not on mobile
      if (!isMobile) {
        focusTextarea();
      } else {
        // On mobile, blur the textarea to dismiss the keyboard
        if (textareaRef.current) {
          textareaRef.current.blur();
        }
      }

      // Start AI response with real API
      getAIResponse(userMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Cmd+Enter on both mobile and desktop
    if (!isStreaming && e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      handleSubmit(e);
      return;
    }

    // Only handle regular Enter key (without Shift) on desktop
    if (!isStreaming && !isMobile && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleButton = (button: ActiveButton) => {
    if (!isStreaming) {
      // Save the current selection state before toggling
      saveSelectionState();

      setActiveButton((prev) => (prev === button ? "none" : button));

      // Restore the selection state after toggling
      setTimeout(() => {
        restoreSelectionState();
      }, 0);
    }
  };

  const renderMessage = (message: Message) => {
    const isCompleted = completedMessages.has(message.id);
    const isStreaming = message.id === streamingMessageId;

    return (
      <div
        key={message.id}
        className={cn(
          "flex flex-col w-full",
          message.type === "user" ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "max-w-[80%] px-4 py-2",
            message.type === "user"
              ? "bg-[#303030] rounded-2xl rounded-br-none"
              : "text-[#ececec]"
          )}
        >
          {message.type === "system" && isStreaming && !message.content && (
            <div className="flex items-center gap-2 text-[#9b9b9b]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#9b9b9b] border-t-transparent" />
              <span>thinking...</span>
            </div>
          )}
          {message.content && (
            <div
              className={cn(
                "chat-content",
                message.type === "system" &&
                  isStreaming &&
                  "animate-pulse-subtle",
                message.type === "system" &&
                  !isCompleted &&
                  !isStreaming &&
                  "animate-fade-in"
              )}
            >
              {parse(message.content)}
            </div>
          )}
        </div>

        {message.type === "system" && message.completed && (
          <div className="flex items-center gap-2 px-4 mt-1 mb-2">
            <button className="text-[#ececec] opacity-60 hover:opacity-100 transition-opacity">
              <RefreshCcw className="h-4 w-4" />
            </button>
            <button className="text-[#ececec] opacity-60 hover:opacity-100 transition-opacity">
              <Copy className="h-4 w-4" />
            </button>
            <button className="text-[#ececec] opacity-60 hover:opacity-100 transition-opacity">
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button className="text-[#ececec] opacity-60 hover:opacity-100 transition-opacity">
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Determine if a section should have fixed height (only for sections after the first)
  const shouldApplyHeight = (sectionIndex: number) => {
    return sectionIndex > 0;
  };

  // Handle waitlist submission
  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(inputValue)) {
      setEmailError(true);
      setTimeout(() => setEmailError(false), 3000);
      return;
    }

    setEmailSubmitting(true);
    try {
      const { error } = await supabase
        .from("waitlist")
        .insert([{ email: inputValue }]);

      if (error) {
        // Check if it's a duplicate email error
        if (error.code === "23505") {
          setEmailError(true);
          setInputValue("");
          setTimeout(() => setEmailError(false), 3000);
          return;
        }
        throw error;
      }

      setEmailSubmitted(true);
      setInputValue("");
      // Show success message for 3 seconds then return to chat mode
      setTimeout(() => {
        setIsWaitlistMode(false);
        setEmailSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error("Error submitting to waitlist:", error);
      setEmailError(true);
      setTimeout(() => setEmailError(false), 3000);
    } finally {
      setEmailSubmitting(false);
    }
  };

  // Toggle waitlist mode
  const handleWaitlistClick = () => {
    if (isWaitlistMode) {
      setIsWaitlistMode(false);
      setEmailSubmitted(false);
    } else {
      setIsWaitlistMode(true);
      setInputValue("");
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div
      ref={mainContainerRef}
      className="bg-[#212121] flex flex-col overflow-hidden"
      style={{ height: isMobile ? `${viewportHeight}px` : "100svh" }}
    >
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      <header className="fixed top-0 left-0 right-0 h-12 flex items-center px-4 z-20 bg-[#212121]">
        <div className="w-full flex items-center justify-center px-2">
          <h1 className="text-base font-medium text-[#ececec]">Slipshark AI</h1>
        </div>
      </header>

      <div
        ref={chatContainerRef}
        className="flex-grow pb-32 pt-12 px-4 overflow-y-auto bg-[#212121]"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {messageSections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-250px)]">
              <Image
                src="/clear logo.png"
                alt="Slipshark AI Logo"
                width={200}
                height={200}
                className="mb-6"
                priority
              />
              <h2 className="text-[#ececec] text-2xl font-medium mb-2">
                ChatGPT for Sports
              </h2>
            </div>
          ) : (
            messageSections.map((section, sectionIndex) => (
              <div
                key={section.id}
                ref={
                  sectionIndex === messageSections.length - 1 &&
                  section.isNewSection
                    ? newSectionRef
                    : null
                }
              >
                {section.isNewSection && (
                  <div
                    style={
                      section.isActive &&
                      shouldApplyHeight(section.sectionIndex)
                        ? { height: `${getContentHeight()}px` }
                        : {}
                    }
                    className="pt-4 flex flex-col justify-start"
                  >
                    {section.messages.map((message) => renderMessage(message))}
                  </div>
                )}

                {!section.isNewSection && (
                  <div>
                    {section.messages.map((message) => renderMessage(message))}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#212121]">
        <form
          onSubmit={isWaitlistMode ? handleWaitlistSubmit : handleSubmit}
          className="max-w-3xl mx-auto"
        >
          {showQueryCount && !isWaitlistMode && (
            <div className="mb-2 text-center">
              <span className="text-[#9b9b9b] text-sm">
                {remainingQueries}{" "}
                {remainingQueries === 1 ? "query" : "queries"} remaining today
              </span>
            </div>
          )}

          <div
            ref={inputContainerRef}
            className={cn(
              "relative w-full rounded-2xl border border-[#303030] bg-[#303030] p-3 cursor-text shadow-lg",
              (isStreaming || remainingQueries === 0) &&
                !isWaitlistMode &&
                "opacity-80"
            )}
            onClick={handleInputContainerClick}
          >
            <div className="pb-12">
              {isWaitlistMode ? (
                <input
                  type="email"
                  ref={textareaRef as any}
                  placeholder={
                    emailSubmitted
                      ? "Thanks! We'll be in touch soon."
                      : "Enter your email to join the waitlist..."
                  }
                  className="min-h-[24px] w-full rounded-2xl border-0 bg-transparent text-white placeholder:text-[#9b9b9b] placeholder:text-base focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base pl-2 pr-4 pt-0 pb-0 leading-tight"
                  value={inputValue}
                  onChange={handleInputChange}
                  disabled={emailSubmitted}
                />
              ) : (
                <Textarea
                  ref={textareaRef}
                  placeholder={
                    remainingQueries === 0
                      ? "Daily limit reached."
                      : isStreaming
                      ? "Waiting for response..."
                      : "Ask anything about sports..."
                  }
                  className="min-h-[24px] max-h-[160px] w-full rounded-2xl border-0 bg-transparent text-white placeholder:text-[#9b9b9b] placeholder:text-base focus-visible:ring-0 focus-visible:ring-offset-0 text-base pl-2 pr-4 pt-0 pb-0 resize-none overflow-y-auto leading-tight"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={remainingQueries === 0}
                  onFocus={() => {
                    if (textareaRef.current) {
                      textareaRef.current.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }
                  }}
                />
              )}
            </div>

            <div className="absolute bottom-3 left-3 right-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "rounded-2xl h-8 px-3 flex items-center border gap-1.5 transition-colors",
                      isWaitlistMode
                        ? "bg-[#423F21] border-[#FFD700] text-[#FFD700] hover:bg-[#4d4926]"
                        : "border-[#454444] bg-[#303030] hover:bg-[#404040] hover:border-[#505050]"
                    )}
                    onClick={handleWaitlistClick}
                    disabled={emailSubmitting}
                  >
                    <span
                      className={cn(
                        "text-sm transition-colors",
                        isWaitlistMode ? "text-[#FFD700]" : "text-[#9b9b9b]"
                      )}
                    >
                      Join our waitlist
                    </span>
                  </Button>
                </div>

                <Button
                  type="submit"
                  variant="outline"
                  size="icon"
                  className={cn(
                    "rounded-2xl h-8 w-8 border border-[#454444] flex-shrink-0 transition-all duration-200",
                    hasTyped || isWaitlistMode
                      ? "bg-[#ffffff] border-transparent scale-110"
                      : "bg-[#303030]"
                  )}
                  disabled={
                    emailSubmitted ||
                    emailSubmitting ||
                    (!isWaitlistMode &&
                      (!inputValue.trim() ||
                        isStreaming ||
                        remainingQueries === 0))
                  }
                >
                  {emailSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#212121] border-t-transparent" />
                  ) : (
                    <ArrowUp
                      className={cn(
                        "h-4 w-4 transition-colors",
                        hasTyped || isWaitlistMode
                          ? "text-[#212121]"
                          : "text-[#9b9b9b]"
                      )}
                    />
                  )}
                  <span className="sr-only">Submit</span>
                </Button>
              </div>
            </div>
          </div>
          <div className="text-center mt-2">
            <p
              className={cn(
                "text-xs transition-colors",
                emailError ? "text-red-400" : "text-[#9b9b9b]"
              )}
            >
              {isWaitlistMode
                ? emailError
                  ? "This email is already on the waitlist or there was an error. Please try again."
                  : emailSubmitted
                  ? "Thanks for joining! We'll be in touch soon."
                  : "Join our waitlist to get notified when we launch the app."
                : remainingQueries === 0
                ? "You've reached your daily limit. Join our waitlist for the app launch."
                : "Slipshark AI can make mistakes. Please double check important information."}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
