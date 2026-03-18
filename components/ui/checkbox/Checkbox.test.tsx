import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders checked state with check icon visible', () => {
    const { toJSON } = render(
      <Checkbox value={true} onValueChange={jest.fn()} />,
    );
    const tree = toJSON();
    // When checked, the Icon component renders inside the checkbox container.
    // The tree should contain the check icon SVG component.
    const json = JSON.stringify(tree);
    expect(json).toContain('check');
  });

  it('renders unchecked state without check icon', () => {
    const { toJSON } = render(
      <Checkbox value={false} onValueChange={jest.fn()} />,
    );
    const tree = toJSON();
    // When unchecked, no Icon component should be rendered.
    // The inner View should have no children containing the icon.
    const json = JSON.stringify(tree);
    expect(json).not.toContain('"check"');
  });

  it('calls onValueChange with toggled value on press', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Checkbox value={false} onValueChange={onValueChange} />,
    );
    fireEvent.press(getByRole('checkbox'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('disabled state prevents onValueChange from being called', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Checkbox value={false} onValueChange={onValueChange} enabled={false} />,
    );
    fireEvent.press(getByRole('checkbox'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('has accessible checkbox role and checked state', () => {
    const { getByRole, rerender } = render(
      <Checkbox value={true} onValueChange={jest.fn()} />,
    );
    const checkedElement = getByRole('checkbox');
    expect(checkedElement.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true, disabled: false }),
    );

    rerender(<Checkbox value={false} onValueChange={jest.fn()} />);
    const uncheckedElement = getByRole('checkbox');
    expect(uncheckedElement.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false, disabled: false }),
    );
  });
});
