import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, Pattern as SvgPattern, Polygon, Rect } from 'react-native-svg';

export type PatternKind = 'zacken' | 'streifen' | 'pfeile';

/**
 * Eigene geometrische Muster in Zweifarb-Paaren (Vorlage des Nutzers als Stimmung,
 * Formen neu gezeichnet). Rein dekorativ: für Screenreader unsichtbar.
 */
export function Pattern({ kind, fg, bg, tile = 24, style }: {
  kind: PatternKind; fg: string; bg: string; tile?: number; style?: ViewStyle;
}) {
  const s = tile;
  const id = `p-${kind}-${fg.slice(1)}-${bg.slice(1)}-${s}`;
  let shapes;
  let w = s;
  let h = s;
  if (kind === 'zacken') {
    // Spitzes Dreieck nach unten, versetzt zur Nachbarreihe
    w = s; h = s;
    shapes = <Polygon points={`${s * 0.08},0 ${s * 0.92},0 ${s * 0.5},${s * 0.86}`} fill={fg} />;
  } else if (kind === 'streifen') {
    // Schräge Balken
    w = s * 0.75; h = s;
    shapes = <Polygon points={`${s * 0.3},0 ${s * 0.6},0 ${s * 0.3},${s} 0,${s}`} fill={fg} />;
  } else {
    // Liegende Pfeilspitze
    w = s; h = s * 0.75;
    shapes = <Polygon points={`0,0 ${s * 0.85},${s * 0.375} 0,${s * 0.75} ${s * 0.3},${s * 0.375}`} fill={fg} />;
  }
  return (
    <View style={[StyleSheet.absoluteFill, style]} accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <SvgPattern id={id} width={w} height={h} patternUnits="userSpaceOnUse">
            <Rect width={w} height={h} fill={bg} />
            {shapes}
          </SvgPattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
