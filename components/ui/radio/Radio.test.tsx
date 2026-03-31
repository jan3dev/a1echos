import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { Radio } from "./Radio";

describe("Radio", () => {
  it("renders selected state when value equals groupValue", () => {
    const { getByRole } = render(
      <Radio value="a" groupValue="a" onValueChange={jest.fn()} />,
    );
    const radio = getByRole("radio");
    expect(radio.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
  });

  it("renders unselected state when value differs from groupValue", () => {
    const { getByRole } = render(
      <Radio value="a" groupValue="b" onValueChange={jest.fn()} />,
    );
    const radio = getByRole("radio");
    expect(radio.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false }),
    );
  });

  it("calls onValueChange with its value on press", () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Radio
        value="option-b"
        groupValue="option-a"
        onValueChange={onValueChange}
      />,
    );
    fireEvent.press(getByRole("radio"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("option-b");
  });

  it("disabled state prevents onValueChange from being called", () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Radio
        value="a"
        groupValue="b"
        onValueChange={onValueChange}
        enabled={false}
      />,
    );
    fireEvent.press(getByRole("radio"));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("renders small size variant with smaller dimensions", () => {
    const { toJSON: toJSONLarge } = render(
      <Radio value="a" groupValue="a" size="large" />,
    );
    const { toJSON: toJSONSmall } = render(
      <Radio value="a" groupValue="a" size="small" />,
    );
    const largeSerialized = JSON.stringify(toJSONLarge());
    const smallSerialized = JSON.stringify(toJSONSmall());
    // Large uses boxSize=24, small uses boxSize=18
    expect(largeSerialized).toContain('"width":24');
    expect(largeSerialized).toContain('"height":24');
    expect(smallSerialized).toContain('"width":18');
    expect(smallSerialized).toContain('"height":18');
  });
});
