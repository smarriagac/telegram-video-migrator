import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui/avatar";
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
  const avatarUrl = id ? `/api/dialogs/${id}/avatar${accountId ? `?account_id=${accountId}` : ""}` : undefined;
  const cleanTitle = (title || "").trim();
  const alphanumericMatch = cleanTitle.match(/[a-zA-Z0-9]/);
  const initial = alphanumericMatch
    ? alphanumericMatch[0].toUpperCase()
    : Array.from(cleanTitle)[0] || "C";

  return (
    <Avatar className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={title} />}
      <AvatarFallback className={cn("text-white font-bold select-none", avatarColor || "bg-primary")}>
        {initial}
      </AvatarFallback>
    </Avatar>
  );
};
