// Generiert aus replica/design/tokens.json mit build_tokens.py. Nicht von Hand ändern.
export const tokens = {
  "palette": {
    "white": "#FFFFFF",
    "lavender": "#C0C3F0",
    "darkBlue": "#252940",
    "orange": "#E6732C",
    "beige": "#FAEBD4",
    "burgundy": "#5A253E",
    "rose": "#F8E0E7",
    "moos": "#003332",
    "mint": "#D3F7E4"
  },
  "color": {
    "light": {
      "bg": "#FFFFFF",
      "surface": "#F5F5FC",
      "surfaceRaised": "#FFFFFF",
      "border": "#E2E3F3",
      "borderInput": "#7D8099",
      "text": "#252940",
      "textMuted": "#5C6078",
      "accent": "#252940",
      "onAccent": "#FFFFFF",
      "accentSoft": "#C0C3F0",
      "onAccentSoft": "#252940",
      "highlight": "#E6732C",
      "onHighlight": "#252940",
      "highlightSoft": "#FAEBD4",
      "onHighlightSoft": "#A84E12",
      "danger": "#5A253E",
      "onDanger": "#FFFFFF",
      "dangerSoft": "#F8E0E7",
      "onDangerSoft": "#5A253E",
      "success": "#003332",
      "onSuccess": "#FFFFFF",
      "successSoft": "#D3F7E4",
      "onSuccessSoft": "#003332",
      "focus": "#252940",
      "catVollzeit": "#C0C3F0",
      "onCatVollzeit": "#252940",
      "catTeilzeit": "#D3F7E4",
      "onCatTeilzeit": "#003332",
      "catAushilfe": "#FAEBD4",
      "onCatAushilfe": "#A84E12"
    },
    "dark": {
      "bg": "#1A1D2E",
      "surface": "#252940",
      "surfaceRaised": "#2E3350",
      "border": "#3A3F5C",
      "borderInput": "#8C90AD",
      "text": "#FFFFFF",
      "textMuted": "#B4B7D6",
      "accent": "#C0C3F0",
      "onAccent": "#252940",
      "accentSoft": "#3A3F6B",
      "onAccentSoft": "#E4E5FA",
      "highlight": "#E6732C",
      "onHighlight": "#252940",
      "highlightSoft": "#4A2E1F",
      "onHighlightSoft": "#FAEBD4",
      "danger": "#F8E0E7",
      "onDanger": "#5A253E",
      "dangerSoft": "#4A2134",
      "onDangerSoft": "#F8E0E7",
      "success": "#D3F7E4",
      "onSuccess": "#003332",
      "successSoft": "#0F3F3D",
      "onSuccessSoft": "#D3F7E4",
      "focus": "#C0C3F0",
      "catVollzeit": "#3A3F6B",
      "onCatVollzeit": "#E4E5FA",
      "catTeilzeit": "#0F3F3D",
      "onCatTeilzeit": "#D3F7E4",
      "catAushilfe": "#4A2E1F",
      "onCatAushilfe": "#FAEBD4"
    }
  },
  "font": {
    "display": "Barlow Semi Condensed",
    "sans": "Inter"
  },
  "type": {
    "label": {
      "size": 12,
      "line": 16,
      "weight": 600,
      "family": "display",
      "tracking": 1.2,
      "case": "upper"
    },
    "xs": {
      "size": 12,
      "line": 16,
      "weight": 500,
      "family": "sans"
    },
    "sm": {
      "size": 14,
      "line": 20,
      "weight": 400,
      "family": "sans"
    },
    "base": {
      "size": 16,
      "line": 24,
      "weight": 400,
      "family": "sans"
    },
    "lg": {
      "size": 20,
      "line": 28,
      "weight": 600,
      "family": "display"
    },
    "xl": {
      "size": 28,
      "line": 34,
      "weight": 700,
      "family": "display"
    },
    "display": {
      "size": 40,
      "line": 44,
      "weight": 700,
      "family": "display"
    }
  },
  "space": [
    0,
    4,
    8,
    12,
    16,
    24,
    32,
    48,
    64
  ],
  "radius": {
    "sm": 4,
    "md": 8,
    "lg": 12,
    "pill": 999
  },
  "shadow": {
    "card": {
      "color": "#252940",
      "opacity": 0.06,
      "radius": 6,
      "offsetY": 2,
      "elevation": 1
    },
    "pop": {
      "color": "#252940",
      "opacity": 0.16,
      "radius": 24,
      "offsetY": 12,
      "elevation": 8
    }
  },
  "motion": {
    "fast": 120,
    "base": 200,
    "easing": [
      0.2,
      0.8,
      0.2,
      1
    ]
  },
  "size": {
    "touchMin": 44,
    "buttonSm": 36,
    "buttonMd": 44,
    "buttonLg": 52,
    "input": 48,
    "tabbar": 56,
    "header": 56
  },
  "layout": {
    "phoneMax": 600,
    "tabletMin": 768,
    "contentMax": 1200,
    "plannerColumnsTablet": 3,
    "plannerColumnsDesktop": 7
  }
} as const;

export type ColorRole = keyof typeof tokens.color.light;
export type TypeRole = keyof typeof tokens.type;
