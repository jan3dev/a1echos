import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { FolderGrid } from "./FolderGrid";
import { FolderGroupItem, type FolderSummary } from "./FolderGroupItem";

const folders: FolderSummary[] = [
  { id: "a", name: "AQUA", createdAt: new Date(2025, 3, 1), sessionCount: 2 },
  { id: "b", name: "JAN3", createdAt: new Date(2025, 2, 23), sessionCount: 1 },
  { id: "c", name: "PR", createdAt: new Date(2025, 0, 17), sessionCount: 4 },
];

describe("FolderGrid", () => {
  it("renders nothing without folders", () => {
    const { queryAllByRole } = render(<FolderGrid folders={[]} />);
    expect(queryAllByRole("button")).toHaveLength(0);
  });

  it("renders the New Folder item", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <FolderGroupItem variant="addNew" onPress={onPress} />,
    );
    fireEvent.press(getByText("homeNewFolder"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders name, date and session count for each folder", () => {
    const { getByText, getAllByText, queryByText } = render(
      <FolderGrid folders={folders} />,
    );
    expect(getByText("AQUA")).toBeTruthy();
    expect(getByText("Apr 1, 2025")).toBeTruthy();
    expect(getAllByText("sessionCount")).toHaveLength(3);
    expect(getByText("PR")).toBeTruthy();
    expect(queryByText("homeNewFolder")).toBeNull();
  });

  it("forwards folder and more presses with the folder", () => {
    const onFolderPress = jest.fn();
    const onFolderMorePress = jest.fn();
    const { getByText, getAllByLabelText } = render(
      <FolderGrid
        folders={folders}
        onFolderPress={onFolderPress}
        onFolderMorePress={onFolderMorePress}
      />,
    );
    fireEvent.press(getByText("JAN3"));
    expect(onFolderPress).toHaveBeenCalledWith(folders[1]);
    fireEvent.press(getAllByLabelText("folderMoreOptions")[2]);
    expect(onFolderMorePress).toHaveBeenCalledWith(folders[2]);
  });

  it("exposes more options as an accessibility action", () => {
    const onFolderMorePress = jest.fn();
    const { getByLabelText } = render(
      <FolderGrid folders={folders} onFolderMorePress={onFolderMorePress} />,
    );
    fireEvent(
      getByLabelText("AQUA, Apr 1, 2025, sessionCount"),
      "accessibilityAction",
      { nativeEvent: { actionName: "more" } },
    );
    expect(onFolderMorePress).toHaveBeenCalledWith(folders[0]);
  });
});
