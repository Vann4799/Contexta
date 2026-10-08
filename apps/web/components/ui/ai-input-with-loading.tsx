"use client";

import { CornerRightUp } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";

interface AIInputWithLoadingProps {
  id?: string;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  onSubmit?: (value: string) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  leadingContent?: ReactNode;
  helperText?: string;
  initialValue?: string;
}

export function AIInputWithLoading({
  id = "ai-input-with-loading",
  placeholder,
  minHeight = 56,
  maxHeight = 200,
  onSubmit,
  onCancel,
  className,
  disabled = false,
  isLoading = false,
  leadingContent,
  helperText,
  initialValue = ""
}: AIInputWithLoadingProps) {
  const t = useT().chat;
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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 rounded-card border border-paper-line bg-paper-card p-3 shadow-card">
        {leadingContent ? <div className="flex flex-wrap items-center gap-2">{leadingContent}</div> : null}
        <div className="relative w-full">
          <Textarea
            id={id}
            placeholder={placeholder}
            className={cn(
              "w-full resize-none rounded-control border-none bg-paper-soft py-4 pl-5 pr-12 text-ink placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-ink/80 focus-visible:ring-offset-0",
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
            onClick={() => {
              if (isLoading) {
                onCancel?.();
                return;
              }
              void handleSubmit();
            }}
            className={cn(
              "absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-control transition-colors",
              isLoading || (inputValue.trim() && !disabled) ? "bg-night text-accent" : "bg-transparent text-ink-faint"
            )}
            type="button"
            disabled={disabled || (!isLoading && !inputValue.trim())}
            aria-label={isLoading ? t.cancelResponse : t.send}
          >
            {isLoading ? (
              <div
                className="size-4 animate-spin rounded-chip bg-accent transition duration-700"
                style={{ animationDuration: "3s" }}
              />
            ) : (
              <CornerRightUp className={cn("size-4 transition-opacity", inputValue.trim() ? "opacity-100" : "opacity-30")} />
            )}
          </button>
        </div>
        {helperText ? <p className="px-4 text-[11.5px] text-ink-muted">{helperText}</p> : null}
      </div>
    </form>
  );
}
