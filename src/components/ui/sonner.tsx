import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      expand={true}
      visibleToasts={5}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl group-[.toaster]:p-4",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          error: "group-[.toast]:bg-red-500/10 group-[.toast]:text-red-600 group-[.toast]:border-red-500/20",
          success: "group-[.toast]:bg-emerald-500/10 group-[.toast]:text-emerald-600 group-[.toast]:border-emerald-500/20",
          info: "group-[.toast]:bg-blue-500/10 group-[.toast]:text-blue-600 group-[.toast]:border-blue-500/20",
          warning: "group-[.toast]:bg-amber-500/10 group-[.toast]:text-amber-600 group-[.toast]:border-amber-500/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
