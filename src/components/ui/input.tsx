import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-8 w-full rounded-none border border-line bg-raised px-2 text-xs text-fg placeholder:text-subtle outline-none transition-colors duration-150 focus:border-accent/50",
        className,
      )}
      {...props}
    />
  );
}
