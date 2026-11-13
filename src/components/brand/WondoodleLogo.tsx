import { cn } from "@/lib/utils";

type WondoodleLogoProps = {
  variant?: "full" | "icon";
  className?: string;
};

const sources = {
  full: {
    src: "/brand/logo-with-text.png",
    alt: "Wondoodle",
  },
  icon: {
    src: "/brand/logo-icon.png",
    alt: "Wondoodle",
  },
} as const;

export function WondoodleLogo({
  variant = "full",
  className,
}: WondoodleLogoProps) {
  const { src, alt } = sources[variant];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(
        "block max-h-full max-w-full select-none object-contain",
        variant === "icon" && "h-full w-full",
        className
      )}
      draggable={false}
      data-testid={
        variant === "full" ? "wondoodle-logo-full" : "wondoodle-logo-icon"
      }
    />
  );
}
