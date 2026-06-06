"use client";

import { CornerRightUp } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";

interface AIInputWithLoadingProps {
  id?: string;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  onSubmit?: (value: string) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  leadingContent?: ReactNode;
  helperText?: string;
  initialValue?: string;
}

export function AIInputWithLoading({
  id = "ai-input-with-loading",
  placeholder = "Ask me anything!",
  minHeight = 56,
  maxHeight = 200,
  onSubmit,
  className,
  disabled = false,
  isLoading = false,
  leadingContent,
  helperText,
  initialValue = ""
}: AIInputWithLoadingProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight, maxHeight });

  useEffect(() => {
    setInputValue(initialValue);
    window.requestAnimationFrame(() => adjustHeight());
  }, [adjustHeight, initialValue]);

  async function handleSubmit() {
    const value = inputValue.trim();
    if (!value || disabled || isLoading) {
      return;
    }

    await onSubmit?.(value);
    setInputValue("");
    adjustHeight(true);
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSubmit();
  }

  return (
    <form className={cn("w-full", className)} onSubmit={handleFormSubmit}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 rounded-lg border border-[#c3c6d7] bg-white p-3 shadow-sm">
        {leadingContent ? <div className="flex flex-wrap items-center gap-2">{leadingContent}</div> : null}
        <div className="relative w-full">
          <Textarea
            id={id}
            placeholder={placeholder}
            className={cn(
              "w-full resize-none rounded-3xl border-none bg-black/5 py-4 pl-6 pr-12 text-ink placeholder:text-subtle focus-visible:ring-1 focus-visible:ring-primary",
              "min-h-14"
            )}
            style={{ minHeight }}
            ref={textareaRef}
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              adjustHeight();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            disabled={disabled || isLoading}
          />
          <button
            onClick={() => void handleSubmit()}
            className={cn(
              "absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl transition",
              inputValue.trim() && !disabled && !isLoading ? "bg-black/5 text-ink" : "bg-transparent text-subtle"
            )}
            type="button"
            disabled={disabled || isLoading || !inputValue.trim()}
            aria-label="Send message"
          >
            <CornerRightUp className={cn("size-4 transition-opacity", inputValue.trim() ? "opacity-100" : "opacity-30")} />
          </button>
        </div>
        {helperText ? <p className="px-4 text-xs text-subtle">{helperText}</p> : null}
      </div>
    </form>
  );
}
