// components/nav/nav-user/nav-user.tsx
"use client";

import {
  useEffect,
  useState,
  useCallback,
  type FormEventHandler,
} from "react";
import {
  IconDotsVertical,
  IconLogout,
  IconUserCircle,
  IconColorPicker,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";

import type { ColorLike } from "color"; // 👈 on récupère le vrai ColorLike du lib

import { createClient } from "@/lib/supabase/client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  ColorPicker,
  ColorPickerAlpha,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
} from "@/components/ui/shadcn-io/color-picker";

type NavUserProps = {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
};

type SessionUser = {
  name: string;
  email: string;
  avatar: string;
};

// EyeDropper typings
type EyeDropperResult = {
  sRGBHex: string;
};

type EyeDropperInstance = {
  open: () => Promise<EyeDropperResult>;
};

type EyeDropperConstructor = new () => EyeDropperInstance;

type WindowWithEyeDropper = Window & {
  EyeDropper?: EyeDropperConstructor;
};

// helper pour les initiales
function getInitials(name: string | undefined | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0];
  const second = parts[1]?.[0];
  return `${first ?? ""}${second ?? ""}`.toUpperCase() || "?";
}

// helper [0-255] -> "00".."FF"
function toHexPart(value: number) {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, "0");
}

// type guard pour AbortError
function isAbortError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if (!("name" in err)) return false;
  const name = (err as { name: unknown }).name;
  return name === "AbortError";
}

export function NavUser({ user }: NavUserProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isMobile, setIsMobile] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser>({
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  });

  const [accountOpen, setAccountOpen] = useState(false);

  // couleur utilisée pour les events de calendrier
  const [eventColor, setEventColor] = useState<string>("#F97316"); // orange par défaut

  // simple détection mobile pour la position du menu
  useEffect(() => {
    const update = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth < 768);
      }
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // récupération de l'utilisateur Supabase + couleur
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        return;
      }

      const u = data.user;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;

      const fullName =
        (meta.full_name as string | undefined) ||
        (meta.name as string | undefined) ||
        (u.email ? u.email.split("@")[0] : null) ||
        user.name;

      const avatarUrl =
        (meta.avatar_url as string | undefined) ||
        (meta.picture as string | undefined) ||
        user.avatar;

      const metaColor = (meta.event_color as string | undefined) || "#F97316";

      setCurrentUser({
        name: fullName ?? user.name,
        email: u.email ?? user.email,
        avatar: avatarUrl ?? "",
      });
      setEventColor(metaColor);
    };

    void loadUser();
  }, [supabase, user.name, user.email, user.avatar]);

  const initials = getInitials(currentUser.name);

  // applique la couleur dans le state + supabase
  const applyHexColor = useCallback(
    async (hex: string) => {
      setEventColor(hex);
      await supabase.auth.updateUser({
        data: {
          event_color: hex,
        },
      });
    },
    [supabase],
  );

  // appelé par le color picker (ColorLike du lib "color")
  const handleColorChange = useCallback(
    (value: ColorLike) => {
      let hex: string | null = null;

      if (typeof value === "string") {
        hex = value;
      } else if (Array.isArray(value)) {
        // [r, g, b] ou [r,g,b,a]
        const [r, g, b] = value;
        hex = `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;
      } else if (
        typeof value === "object" &&
        value !== null &&
        "r" in value &&
        "g" in value &&
        "b" in value
      ) {
        const { r, g, b } = value as { r: number; g: number; b: number };
        hex = `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;
      }

      if (!hex) return;
      void applyHexColor(hex);
    },
    [applyHexColor],
  );

  // wrapper typé qui satisfait le type chelou: FormEventHandler & (ColorLike)=>void
  const colorPickerOnChange: FormEventHandler<HTMLDivElement> &
    ((value: ColorLike) => void) = ((value: ColorLike) => {
      handleColorChange(value);
    }) as unknown as FormEventHandler<HTMLDivElement> &
    ((value: ColorLike) => void);

  // bouton pipette → EyeDropper API native
  const handleEyeDropper = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const win = window as WindowWithEyeDropper;

    if (!win.EyeDropper) {
      console.warn("EyeDropper API non disponible dans ce navigateur.");
      return;
    }

    try {
      const eyeDropper = new win.EyeDropper();
      const result = await eyeDropper.open();
      await applyHexColor(result.sRGBHex);
    } catch (err: unknown) {
      if (isAbortError(err)) return; // l'utilisateur a juste annulé
      console.error("EyeDropper error:", err);
    }
  }, [applyHexColor]);

  const quickColors: string[] = [
    "#F97316", // orange
    "#3B82F6", // bleu
    "#22C55E", // vert
    "#EC4899", // rose
    "#A855F7", // violet
    "#FACC15", // jaune
  ];

  return (
    <div className="mt-auto border-t px-2 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="flex w-full items-center gap-2 rounded-md px-2 py-6 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Avatar className="h-8 w-8 rounded-lg grayscale">
              {currentUser.avatar && (
                <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
              )}
              <AvatarFallback className="rounded-lg">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex min-w-0 flex-1 flex-col text-left leading-tight">
              <span className="truncate text-sm font-medium">
                {currentUser.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {currentUser.email}
              </span>
            </div>

            <IconDotsVertical className="ml-auto h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="min-w-56 rounded-lg"
          side={isMobile ? "bottom" : "right"}
          align="end"
          sideOffset={4}
        >
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                {currentUser.avatar && (
                  <AvatarImage
                    src={currentUser.avatar}
                    alt={currentUser.name}
                  />
                )}
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{currentUser.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {currentUser.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setAccountOpen(true)}>
              <IconUserCircle className="mr-2 h-4 w-4" />
              <span>Mon compte</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive focus:text-destructive data-[highlighted]:bg-destructive/10"
            onClick={async () => {
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error(error);
                return;
              }
              router.push("/auth/login");
            }}
          >
            <IconLogout className="mr-2 h-4 w-4" />
            <span>Se déconnecter</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog "Mon compte" */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mon compte</DialogTitle>
            <DialogDescription>
              Informations liées à ton compte utilisateur.
            </DialogDescription>
          </DialogHeader>

          {/* header du compte */}
          <div className="flex items-center gap-4 py-2">
            <Avatar className="h-12 w-12 rounded-lg">
              {currentUser.avatar && (
                <AvatarImage
                  src={currentUser.avatar}
                  alt={currentUser.name}
                />
              )}
              <AvatarFallback className="rounded-lg text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{currentUser.name}</span>
              <span className="text-xs text-muted-foreground">
                {currentUser.email}
              </span>
            </div>
          </div>

          {/* Couleur d'événement calendrier */}
          <div className="mt-4 space-y-3 rounded-md border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium">
                  Couleur des événements calendrier
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Utilisée comme étiquette pour tes événements dans le
                  calendrier.
                </p>
              </div>

              {/* Chip de preview */}
              <div className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1">
                <span
                  className="h-3 w-3 rounded-full border"
                  style={{ backgroundColor: eventColor }}
                />
                <span className="text-[10px] font-mono text-muted-foreground">
                  {eventColor.toUpperCase()}
                </span>
              </div>
            </div>

            {/* couleurs rapides */}
            <div className="flex flex-wrap items-center gap-2">
              {quickColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => void applyHexColor(color)}
                  className="h-6 w-6 rounded-full border shadow-sm transition hover:-translate-y-0.5 hover:shadow"
                  style={{ backgroundColor: color }}
                  aria-label={`Choisir ${color}`}
                />
              ))}
            </div>

            {/* ColorPicker complet */}
            <div className="mt-2 space-y-2 rounded-md border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Ajuster manuellement
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={handleEyeDropper}
                  title="Choisir une couleur sur l'écran"
                >
                  <IconColorPicker className="h-4 w-4" />
                </Button>
              </div>

              <ColorPicker
                key={eventColor}
                defaultValue={eventColor}
                onChange={colorPickerOnChange}
                className="space-y-2"
              >
                <ColorPickerSelection className="h-36 rounded-md" />
                <div className="flex items-center gap-3">
                  <div className="grid w-full gap-1">
                    <ColorPickerHue />
                    <ColorPickerAlpha />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ColorPickerOutput />
                  <ColorPickerFormat />
                </div>
              </ColorPicker>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAccountOpen(false)}
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}