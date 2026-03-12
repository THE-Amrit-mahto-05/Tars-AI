"use client";

import { useState } from "react";
import { X, Sun, Moon, Palette, Check } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface ThemeOption {
  id: "light" | "dark" | "whatsapp";
  name: string;
  description: string;
  icon: React.ReactNode;
  bgColor: string;
  accentColor: string;
  textColor: string;
}

const THEMES: ThemeOption[] = [
  {
    id: "light",
    name: "Light",
    description: "Clean and bright interface",
    icon: <Sun className="h-5 w-5" />,
    bgColor: "#ffffff",
    accentColor: "#3b82f6",
    textColor: "#1f2937",
  },
  {
    id: "dark",
    name: "Dark",
    description: "Easy on the eyes at night",
    icon: <Moon className="h-5 w-5" />,
    bgColor: "#17212b",
    accentColor: "#3b82f6",
    textColor: "#ffffff",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Vibrant and energetic",
    icon: <Palette className="h-5 w-5" />,
    bgColor: "#0a6e47",
    accentColor: "#25d366",
    textColor: "#ffffff",
  },
];

export function ThemeSwitcher({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { theme, setTheme } = useTheme();
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 themed-bg border transition-colors"
          style={{
            borderColor: "var(--border-color, rgba(0,0,0,0.1))",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold themed-text tracking-tight">Theme</h2>
              <p className="text-xs themed-text-secondary mt-1">Choose your preferred appearance</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors duration-200"
            >
              <X className="h-5 w-5 themed-text-secondary" />
            </button>
          </div>

          {/* Theme Grid */}
          <div className="grid grid-cols-1 gap-4">
            {THEMES.map((themeOption) => (
              <button
                key={themeOption.id}
                onClick={() => {
                  setTheme(themeOption.id);
                }}
                onMouseEnter={() => setHoveredTheme(themeOption.id)}
                onMouseLeave={() => setHoveredTheme(null)}
                className={`group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 transform ${
                  theme === themeOption.id
                    ? "ring-2 scale-105"
                    : "hover:scale-102 cursor-pointer"
                }`}
                style={{
                  ringColor: "var(--accent)",
                  backgroundColor: theme === themeOption.id ? "var(--bg-chat)" : "var(--bg-message)",
                }}
              >
                {/* Background gradient indicator */}
                <div
                  className="absolute top-0 left-0 w-full h-1 transition-all duration-300"
                  style={{
                    backgroundColor: themeOption.accentColor,
                    opacity: theme === themeOption.id || hoveredTheme === themeOption.id ? 1 : 0.2,
                  }}
                />

                {/* Content */}
                <div className="relative flex items-start justify-between">
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="p-2 rounded-lg transition-all duration-300"
                        style={{
                          backgroundColor: themeOption.accentColor,
                          color: themeOption.textColor,
                        }}
                      >
                        {themeOption.icon}
                      </div>
                      <h3 className="font-semibold themed-text">{themeOption.name}</h3>
                    </div>
                    <p className="text-xs themed-text-secondary leading-relaxed">
                      {themeOption.description}
                    </p>
                  </div>

                  {/* Check icon */}
                  {theme === themeOption.id && (
                    <div
                      className="flex-shrink-0 ml-3 p-1 rounded-full animate-in scale-in duration-300"
                      style={{ backgroundColor: themeOption.accentColor }}
                    >
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>

                {/* Hover preview bar */}
                {hoveredTheme === themeOption.id && theme !== themeOption.id && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 animate-in slide-in-from-left duration-300"
                    style={{ backgroundColor: themeOption.accentColor }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Theme Preview */}
          <div className="mt-8 pt-6 border-t transition-colors" style={{ borderColor: "var(--border-color, rgba(0,0,0,0.1))" }}>
            <p className="text-xs font-semibold uppercase tracking-wider themed-text-secondary mb-4">Live Preview</p>
            <div className="flex gap-3">
              <div
                className="flex-1 rounded-xl p-3 flex flex-col items-center gap-2 transition-all duration-300"
                style={{
                  backgroundColor: THEMES.find((t) => t.id === theme)?.bgColor,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full opacity-80"
                  style={{
                    backgroundColor: THEMES.find((t) => t.id === theme)?.accentColor,
                  }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: THEMES.find((t) => t.id === theme)?.textColor,
                  }}
                >
                  Sample Text
                </span>
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <div
                  className="h-6 rounded-lg flex-1 opacity-20"
                  style={{
                    backgroundColor: THEMES.find((t) => t.id === theme)?.accentColor,
                  }}
                />
                <div
                  className="h-3 rounded-lg flex-1 opacity-10"
                  style={{
                    backgroundColor: THEMES.find((t) => t.id === theme)?.accentColor,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <div
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: THEMES.find((t) => t.id === theme)?.accentColor,
              }}
            />
            <p className="text-xs themed-text-secondary">
              Theme refreshed in real-time
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideInFromLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-in {
          animation: fadeIn 0.3s ease-in;
        }

        .fade-in {
          animation: fadeIn 0.3s ease-in;
        }

        .zoom-in-95 {
          animation: zoomIn 0.3s ease-out;
        }

        .scale-102 {
          --tw-scale-x: 1.02;
          --tw-scale-y: 1.02;
          transform: translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y))
            skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x))
            scaleY(var(--tw-scale-y));
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .slide-in-from-left {
          animation: slideInFromLeft 0.3s ease-out;
        }

        .scale-in {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
