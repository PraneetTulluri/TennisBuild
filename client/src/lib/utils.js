import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/animate-ui helper: merges conditional class-name
// fragments (clsx) then resolves conflicting Tailwind utility classes so
// the last one wins (twMerge) - e.g. cn("px-2", condition && "px-4")
// correctly ends up as just "px-4", not "px-2 px-4" both applying.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
