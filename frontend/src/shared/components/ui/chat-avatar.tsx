import React, { useState } from "react";
import { cn } from "@/shared/lib/utils";

export interface ChatAvatarProps {
  id: number;
  title: string;
  avatarColor?: string | null;
  className?: string;
  accountId?: number | null;
}

export const ChatAvatar: React.FC<ChatAvatarProps> = ({
  id,
  title,
  avatarColor,
  className = "w-8 h-8 rounded-md",
  accountId,
}) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const avatarUrl = `/api/dialogs/${id}/avatar${accountId ? `?account_id=${accountId}` : ""}`;
  const hasError = failedUrl === avatarUrl;

  const cleanTitle = (title || "").trim();
  const alphanumericMatch = cleanTitle.match(/[a-zA-Z0-9]/);
  const initial = alphanumericMatch
    ? alphanumericMatch[0].toUpperCase()
    : Array.from(cleanTitle)[0] || "C";

  if (hasError || !id) {
    return (
      <div
        className={cn(
          className,
          "flex items-center justify-center font-bold text-xs text-white shrink-0 select-none shadow-xs",
          avatarColor || "bg-primary"
        )}
      >
        {initial}
      </div>
    );
  }

  return (
    <div
      className={cn(
        className,
        "relative overflow-hidden shrink-0 bg-secondary/80 select-none flex items-center justify-center shadow-xs"
      )}
    >
      <img
        src={avatarUrl}
        alt={title}
        loading="lazy"
        onError={() => setFailedUrl(avatarUrl)}
        className="w-full h-full object-cover"
      />
    </div>
  );
};
