import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { GlassInput } from '@/src/components/ui/glass-input';
import { cosmicTheme } from '@/src/lib/theme';
import { clamp, isValidHexColor, normalizeHexColor } from '@/src/lib/star-utils';

const DEFAULT_COLOR = '#E0E7EF';
const COLOR_PAD_HEIGHT = 124;
const HUE_BAR_HEIGHT = 22;
const HUE_STOPS = [
  '#FF4D4D',
  '#FFE45C',
  '#63E26D',
  '#57D8FF',
  '#6D7BFF',
  '#D86DFF',
  '#FF4D78',
] as const;

interface HsvColor {
  h: number;
  s: number;
  v: number;
}

const componentToHex = (value: number) => Math.round(value).toString(16).padStart(2, '0').toUpperCase();

const rgbToHex = (r: number, g: number, b: number) => `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;

const hexToRgb = (value: string) => {
  const normalized = normalizeHexColor(value);
  const fallback = normalizeHexColor(DEFAULT_COLOR);
  const hex = isValidHexColor(normalized) ? normalized : fallback;
  const expanded = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const numeric = Number.parseInt(expanded.slice(1), 16);

  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
};

const rgbToHsv = ({ r, g, b }: { r: number; g: number; b: number }): HsvColor => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
  }

  return {
    h: (hue * 60 + 360) % 360,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
};

const hsvToRgb = ({ h, s, v }: HsvColor) => {
  const chroma = v * s;
  const huePrime = h / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = v - chroma;
  let r = 0;
  let g = 0;
  let b = 0;

  if (huePrime >= 0 && huePrime < 1) {
    r = chroma;
    g = x;
  } else if (huePrime < 2) {
    r = x;
    g = chroma;
  } else if (huePrime < 3) {
    g = chroma;
    b = x;
  } else if (huePrime < 4) {
    g = x;
    b = chroma;
  } else if (huePrime < 5) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  return {
    r: (r + match) * 255,
    g: (g + match) * 255,
    b: (b + match) * 255,
  };
};

const hsvToHex = (hsv: HsvColor) => {
  const { r, g, b } = hsvToRgb(hsv);
  return rgbToHex(r, g, b);
};

const getHueColor = (hue: number) => hsvToHex({ h: hue, s: 1, v: 1 });

export const ColorPicker = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) => {
  const normalized = normalizeHexColor(value);
  const safeColor = isValidHexColor(normalized) ? normalized : DEFAULT_COLOR;
  const hsv = useMemo(() => rgbToHsv(hexToRgb(safeColor)), [safeColor]);
  const [padWidth, setPadWidth] = useState(1);
  const [hueWidth, setHueWidth] = useState(1);
  const hueColor = getHueColor(hsv.h);

  const updateSaturationValue = useCallback(
    (locationX: number, locationY: number) => {
      const saturation = clamp(locationX / Math.max(padWidth, 1), 0, 1);
      const brightness = clamp(1 - locationY / COLOR_PAD_HEIGHT, 0, 1);
      onChange(hsvToHex({ ...hsv, s: saturation, v: brightness }));
    },
    [hsv, onChange, padWidth]
  );

  const updateHue = useCallback(
    (locationX: number) => {
      const hue = clamp(locationX / Math.max(hueWidth, 1), 0, 1) * 360;
      onChange(hsvToHex({ ...hsv, h: hue }));
    },
    [hsv, hueWidth, onChange]
  );

  const colorPadResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          updateSaturationValue(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderMove: (event) => {
          updateSaturationValue(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
      }),
    [updateSaturationValue]
  );

  const hueResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          updateHue(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          updateHue(event.nativeEvent.locationX);
        },
      }),
    [updateHue]
  );

  const selectorLeft = hsv.s * padWidth;
  const selectorTop = (1 - hsv.v) * COLOR_PAD_HEIGHT;
  const hueSelectorLeft = (hsv.h / 360) * hueWidth;

  return (
    <View style={styles.container}>
      <View
        {...colorPadResponder.panHandlers}
        onLayout={(event) => setPadWidth(event.nativeEvent.layout.width)}
        style={[styles.colorPad, { backgroundColor: hueColor }]}>
        <LinearGradient
          colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[
            styles.colorPadSelector,
            {
              backgroundColor: safeColor,
              left: selectorLeft,
              top: selectorTop,
            },
          ]}
        />
      </View>

      <View
        {...hueResponder.panHandlers}
        onLayout={(event) => setHueWidth(event.nativeEvent.layout.width)}
        style={styles.hueBar}>
        <LinearGradient
          colors={HUE_STOPS}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={[styles.hueSelector, { left: hueSelectorLeft }]} />
      </View>

      <View style={styles.customRow}>
        <View style={[styles.preview, { backgroundColor: safeColor }]} />
        <View style={styles.inputWrap}>
          <GlassInput
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="#E4ECF5"
            style={styles.input}
            value={normalized}
            onChangeText={(nextValue) => onChange(normalizeHexColor(nextValue))}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  colorPad: {
    height: COLOR_PAD_HEIGHT,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  colorPadSelector: {
    position: 'absolute',
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  hueBar: {
    height: HUE_BAR_HEIGHT,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  hueSelector: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: HUE_BAR_HEIGHT + 4,
    marginLeft: -4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: cosmicTheme.colors.accentLine,
    borderRadius: cosmicTheme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  preview: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    flex: 1,
    minHeight: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
