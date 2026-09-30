/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { SessionActionsSheet } from "./SessionActionsSheet";

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({
    t: (key: string) => key,
    loc: {
      sessionRenameTitle: "Rename",
      delete: "Delete",
      addToFolder: "Add to Folder",
      copyAsText: "Copy as Text",
      downloadMarkdown: "Download .md",
      shareVia: "Share via…",
      modifiedPrefix: "Modified",
      createdPrefix: "Created",
    },
  })),
}));

jest.mock("@/utils", () => ({
  ...jest.requireActual("@/utils"),
  formatDate: jest.fn(() => "Apr 18, 2024"),
  formatSessionSubtitle: jest.fn(
    ({ modifiedPrefix }: { modifiedPrefix: string }) =>
      `${modifiedPrefix} today`,
  ),
}));

jest.mock("../../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    return <View testID={`icon-${props.name}`} />;
  },
}));

jest.mock("../../../ui/modal/Dimmer", () => ({
  Dimmer: ({ visible, children }: any) => {
    const { View } = require("react-native");
    return visible ? <View testID="dimmer">{children}</View> : null;
  },
}));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

const flushTimers = () => {
  act(() => {
    jest.runAllTimers();
  });
};

const setup = (
  overrides: Partial<React.ComponentProps<typeof SessionActionsSheet>> = {},
) => {
  const onRename = jest.fn();
  const onDelete = jest.fn();
  const onDismiss = jest.fn();
  const utils = render(
    <SessionActionsSheet
      visible
      header={{
        title: "Morning Meeting",
        createdAt: new Date(2024, 3, 18, 10, 0, 0),
        modifiedAt: new Date(2024, 3, 19, 7, 18, 0),
      }}
      onRename={onRename}
      onDelete={onDelete}
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  flushTimers();
  return { ...utils, onRename, onDelete, onDismiss };
};

describe("SessionActionsSheet", () => {
  it("renders title, rename, and delete labels", () => {
    const { getByText } = setup();
    expect(getByText("Morning Meeting")).toBeTruthy();
    expect(getByText("Rename")).toBeTruthy();
    expect(getByText("Delete")).toBeTruthy();
  });

  it("renders the created line using formatDate", () => {
    const { getByText } = setup();
    expect(getByText("Created: Apr 18, 2024")).toBeTruthy();
  });

  it("renders the modified line from formatSessionSubtitle", () => {
    const { getByText } = setup();
    expect(getByText("Modified today")).toBeTruthy();
  });

  it("fires onRename when the rename row is pressed", () => {
    const { getByTestId, onRename } = setup();
    fireEvent.press(getByTestId(TestID.SessionRename));
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it("fires onDelete when the delete row is pressed", () => {
    const { getByTestId, onDelete } = setup();
    fireEvent.press(getByTestId(TestID.SessionDelete));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renders only rows with handlers", () => {
    const { queryByTestId } = setup();
    expect(queryByTestId(TestID.SessionAddToFolder)).toBeNull();
    expect(queryByTestId(TestID.SessionCopyText)).toBeNull();
  });

  it("fires the folder and share row handlers", () => {
    const handlers = {
      onAddToFolder: jest.fn(),
      onCopy: jest.fn(),
      onDownload: jest.fn(),
      onShare: jest.fn(),
    };
    const { getByTestId } = setup(handlers);
    fireEvent.press(getByTestId(TestID.SessionAddToFolder));
    fireEvent.press(getByTestId(TestID.SessionCopyText));
    fireEvent.press(getByTestId(TestID.SessionDownloadMarkdown));
    fireEvent.press(getByTestId(TestID.SessionShareVia));
    Object.values(handlers).forEach((fn) =>
      expect(fn).toHaveBeenCalledTimes(1),
    );
  });

  it("omits the header when none is given", () => {
    const { queryByText, getByText } = setup({
      header: undefined,
      onRename: undefined,
      onDelete: undefined,
      onCopy: jest.fn(),
    });
    expect(queryByText("Morning Meeting")).toBeNull();
    expect(queryByText("Rename")).toBeNull();
    expect(getByText("Copy as Text")).toBeTruthy();
  });

  it("does not render content when not visible", () => {
    const { queryByText } = setup({ visible: false });
    expect(queryByText("Morning Meeting")).toBeNull();
  });
});
