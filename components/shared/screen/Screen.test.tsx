import { render } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";

import { Screen } from "./Screen";

jest.mock("@/theme", () => ({
  useTheme: jest.fn(() => ({
    theme: { colors: { surfaceBackground: "#abcdef" } },
  })),
}));

describe("Screen", () => {
  it("renders children", () => {
    const { getByText } = render(
      <Screen>
        <Text>hello</Text>
      </Screen>,
    );
    expect(getByText("hello")).toBeTruthy();
  });

  it("applies surfaceBackground from theme and flex:1", () => {
    const { toJSON } = render(
      <Screen>
        <Text>child</Text>
      </Screen>,
    );
    const tree = toJSON() as { props: { style: unknown[] } };
    const flatStyle = Object.assign({}, ...tree.props.style.flat(Infinity));
    expect(flatStyle.flex).toBe(1);
    expect(flatStyle.backgroundColor).toBe("#abcdef");
  });

  it("merges caller style over defaults", () => {
    const { toJSON } = render(
      <Screen style={{ backgroundColor: "red", padding: 12 }}>
        <View />
      </Screen>,
    );
    const tree = toJSON() as { props: { style: unknown[] } };
    const flatStyle = Object.assign({}, ...tree.props.style.flat(Infinity));
    expect(flatStyle.backgroundColor).toBe("red");
    expect(flatStyle.padding).toBe(12);
    expect(flatStyle.flex).toBe(1);
  });
});
