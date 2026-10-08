import { useCallback } from "react";
import { useT } from "@/lib/i18n";

/**
 * Server text is authored in English, so a message the dictionary does not
 * list stays verbatim instead of rendering as if it were translated.
 */
export function useServerError() {
  const copy = useT().errors.server as Record<string, string>;
  return useCallback(
    (message: string | null | undefined) => {
      if (!message) {
        return "";
      }
      const trimmed = message.trim();
      return copy[trimmed] ?? trimmed;
    },
    [copy]
  );
}
