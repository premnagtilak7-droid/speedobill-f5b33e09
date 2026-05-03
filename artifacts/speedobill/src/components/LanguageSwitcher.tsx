import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";

interface LanguageSwitcherProps {
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "icon" | "default";
  className?: string;
  showLabel?: boolean;
}

const LanguageSwitcher = ({
  variant = "ghost",
  size = "icon",
  className,
  showLabel = false,
}: LanguageSwitcherProps) => {
  const { i18n } = useTranslation();
  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ||
    SUPPORTED_LANGUAGES.find((l) => i18n.language?.startsWith(l.code)) ||
    SUPPORTED_LANGUAGES[0];

  const handleSelect = (code: string) => {
    void i18n.changeLanguage(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          aria-label="Change language"
        >
          <Globe className="h-4 w-4" />
          {showLabel && <span className="ml-1.5 text-xs font-medium">{currentLang.native}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = lang.code === currentLang.code;
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className="flex items-center justify-between gap-3 cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{lang.native}</span>
                <span className="text-[10px] text-muted-foreground">{lang.english}</span>
              </div>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
