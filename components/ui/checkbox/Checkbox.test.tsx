import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("renders checked state with check icon visible", () => {
    const { toJSON } = render(
      <Checkbox value={true} onValueChange={jest.fn()} />,
    );
    const tree = toJSON();
    // When checked, the Icon component renders inside the checkbox container.
    // The tree should contain the check icon SVG component.
    const json = JSON.stringify(tree);
    expect(json).toContain("check");
  });

  it("renders unchecked state without check icon", () => {
    const { toJSON } = render(
      <Checkbox value={false} onValueChange={jest.fn()} />,
    );
    const tree = toJSON();
    // When unchecked, no Icon component should be rendered.
    // The inner View should have no children containing the icon.
    const json = JSON.stringify(tree);
    expect(json).not.toContain('"check"');
  });

  it("calls onValueChange with toggled value on press", () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Checkbox value={false} onValueChange={onValueChange} />,
    );
    fireEvent.press(getByRole("checkbox"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it("disabled state prevents onValueChange from being called", () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Checkbox value={false} onValueChange={onValueChange} enabled={false} />,
    );
    fireEvent.press(getByRole("checkbox"));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("has accessible checkbox role and checked state", () => {
    const { getByRole, rerender } = render(
      <Checkbox value={true} onValueChange={jest.fn()} />,
    );
    const checkedElement = getByRole("checkbox");
    expect(checkedElement.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true, disabled: false }),
    );

    rerender(<Checkbox value={false} onValueChange={jest.fn()} />);
    const uncheckedElement = getByRole("checkbox");
    expect(uncheckedElement.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false, disabled: false }),
    );
  });

  it("disabled state shows disabled accessibilityState", () => {
    const { getByRole } = render(
      <Checkbox value={false} onValueChange={jest.fn()} enabled={false} />,
    );
    const checkbox = getByRole("checkbox");
    expect(checkbox.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it("renders small size variant", () => {
    const { toJSON } = render(
      <Checkbox value={true} onValueChange={jest.fn()} size="small" />,
    );
    const json = JSON.stringify(toJSON());
    // Small size uses 18x18 box
    expect(json).toContain('"width":18');
    expect(json).toContain('"height":18');
  });

  it("renders large size variant (default)", () => {
    const { toJSON } = render(
      <Checkbox value={true} onValueChange={jest.fn()} size="large" />,
    );
    const json = JSON.stringify(toJSON());
    // Large size uses 24x24 box
    expect(json).toContain('"width":24');
    expect(json).toContain('"height":24');
  });

  it("toggles from checked to unchecked on press", () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Checkbox value={true} onValueChange={onValueChange} />,
    );
    fireEvent.press(getByRole("checkbox"));
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it("does not call onValueChange when enabled but no handler provided", () => {
    const { getByRole } = render(<Checkbox value={false} />);
    // Should not throw when pressing
    fireEvent.press(getByRole("checkbox"));
  });
});
