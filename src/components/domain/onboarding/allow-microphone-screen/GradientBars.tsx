import { StyleSheet, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Stop } from "react-native-svg";

import { darkColors } from "@/theme";

// Bar top edges from the Figma illustration (366×257 canvas, 15px pitch,
// bars end at y=254). Heights are static: this screen never records.
const BAR_TOPS = [
  78, 68, 78, 86, 71, 38, 57, 3, 29, 47, 90, 79, 71, 83, 90, 97, 105, 111, 105,
  71, 65, 47, 13, 38, 57,
];
const CANVAS_WIDTH = 366;
const CANVAS_HEIGHT = 257;
const BAR_BOTTOM = 254;
const BAR_PITCH = 15;
const BAR_WIDTH = 6;
const BAR_X_OFFSET = BAR_WIDTH / 2;
const BAR_COLOR = "#4D4D4E";

interface GradientBarsProps {
  testID?: string;
}

export const GradientBars = ({ testID }: GradientBarsProps) => (
  <View
    testID={testID}
    style={styles.root}
    pointerEvents="none"
    accessible={false}
  >
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      preserveAspectRatio="xMidYMax meet"
    >
      <Defs>
        <LinearGradient id="gradientBarsFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BAR_COLOR} />
          <Stop offset="1" stopColor={darkColors.surfaceBackground} />
        </LinearGradient>
      </Defs>
      {BAR_TOPS.map((top, i) => {
        const x = BAR_X_OFFSET + i * BAR_PITCH;
        return (
          <Line
            key={i}
            x1={x}
            x2={x}
            y1={top}
            y2={BAR_BOTTOM}
            stroke="url(#gradientBarsFade)"
            strokeWidth={BAR_WIDTH}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  root: {
    width: "100%",
    height: CANVAS_HEIGHT,
  },
});
