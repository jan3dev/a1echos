/* eslint-disable @typescript-eslint/no-require-imports, react/display-name */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";
import { Session } from "@/models";
import { useSessionStore, useSettingsStore } from "@/stores";

import { HomeContent } from "./HomeContent";

jest.mock("../../session/session-list-item/SessionListItem", () => ({
  SessionListItem: (props: any) => {
    const { Pressable, Text, View } = require("react-native");
    return (
      <View testID={`session-row-${props.session.id}`}>
        <Pressable
          testID={`session-row-tap-${props.session.id}`}
          onPress={props.onTap}
        >
          <Text>{props.session.name}</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock("../incognito-empty-state/IncognitoEmptyState", () => ({
  IncognitoEmptyState: () => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.IncognitoEmptyState} />;
  },
}));

const makeSession = (i: number): Session => ({
  id: `s${i}`,
  name: `Session ${i}`,
  // Newer sessions have later lastModified so the store-level sort places them
  // first; we set sorted sessions directly so the order here is the visible
  // order.
  timestamp: new Date(2024, 0, 1 + i),
  lastModified: new Date(2024, 0, 1 + i),
  isIncognito: false,
});

const seedSessions = (count: number) => {
  useSessionStore.setState({
    sessions: Array.from({ length: count }, (_, i) => makeSession(count - i)),
    needsSort: false,
  } as any);
};

const defaultProps = {
  selectionMode: false,
  selectedSessionIds: new Set<string>(),
  onSessionLongPress: jest.fn(),
  onSessionTap: jest.fn(),
  onSessionMorePress: jest.fn(),
};

describe("HomeContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ isIncognitoMode: false });
    seedSessions(5);
  });

  it("renders the session FlatList when incognito mode is off", () => {
    const { getByTestId, queryByTestId } = render(
      <HomeContent {...defaultProps} />,
    );
    expect(getByTestId(TestID.SessionList)).toBeTruthy();
    expect(queryByTestId(TestID.IncognitoEmptyState)).toBeNull();
  });

  it("shows quick actions but no folder grid without folders", () => {
    const { getByText, queryByText } = render(
      <HomeContent {...defaultProps} onCreateFolderPress={jest.fn()} />,
    );
    expect(getByText("homeFolder")).toBeTruthy();
    expect(getByText("homeUpload")).toBeTruthy();
    expect(queryByText("AQUA")).toBeNull();
  });

  it("hides quick actions in selection mode but keeps the folder grid", () => {
    const { getByText, queryByText } = render(
      <HomeContent
        {...defaultProps}
        selectionMode
        folders={[
          { id: "f1", name: "AQUA", createdAt: new Date(), sessionCount: 2 },
        ]}
      />,
    );
    expect(queryByText("homeFolder")).toBeNull();
    expect(queryByText("homeUpload")).toBeNull();
    expect(getByText("AQUA")).toBeTruthy();
  });

  it("fires onCreateFolderPress from the folder quick action", () => {
    const onCreateFolderPress = jest.fn();
    const { getByText } = render(
      <HomeContent
        {...defaultProps}
        onCreateFolderPress={onCreateFolderPress}
      />,
    );
    fireEvent.press(getByText("homeFolder"));
    expect(onCreateFolderPress).toHaveBeenCalled();
  });

  it("opens a folder from the grid", () => {
    const onFolderPress = jest.fn();
    const folder = {
      id: "f1",
      name: "AQUA",
      createdAt: new Date(),
      sessionCount: 0,
    };
    const { getByText } = render(
      <HomeContent
        {...defaultProps}
        folders={[folder]}
        onFolderPress={onFolderPress}
      />,
    );
    fireEvent.press(getByText("AQUA"));
    expect(onFolderPress).toHaveBeenCalledWith(folder);
  });

  it("lists only sessions that are not filed in a folder", () => {
    useSessionStore.setState({
      sessions: [{ ...makeSession(1), folderId: "f1" }, makeSession(2)],
      needsSort: false,
    } as any);
    const { queryByTestId } = render(<HomeContent {...defaultProps} />);
    expect(queryByTestId("session-row-s1")).toBeNull();
    expect(queryByTestId("session-row-s2")).toBeTruthy();
  });

  it("lists a folder's sessions and hides the folder action", () => {
    useSessionStore.setState({
      sessions: [{ ...makeSession(1), folderId: "f1" }, makeSession(2)],
      needsSort: false,
    } as any);
    const { queryByTestId, queryByText } = render(
      <HomeContent {...defaultProps} folderId="f1" />,
    );
    expect(queryByTestId("session-row-s1")).toBeTruthy();
    expect(queryByTestId("session-row-s2")).toBeNull();
    expect(queryByText("homeFolder")).toBeNull();
    expect(queryByText("homeUpload")).toBeTruthy();
  });

  it("shows the folder grid when folders exist", () => {
    const { getByText } = render(
      <HomeContent
        {...defaultProps}
        folders={[
          { id: "f1", name: "AQUA", createdAt: new Date(), sessionCount: 2 },
        ]}
      />,
    );
    expect(getByText("AQUA")).toBeTruthy();
  });

  it("renders IncognitoEmptyState instead of the list when incognito mode is on", () => {
    useSettingsStore.setState({ isIncognitoMode: true });
    const { getByTestId, queryByTestId } = render(
      <HomeContent {...defaultProps} />,
    );
    expect(getByTestId(TestID.IncognitoEmptyState)).toBeTruthy();
    expect(queryByTestId(TestID.SessionList)).toBeNull();
  });

  it("renders only the first 30 sessions initially when more exist", () => {
    seedSessions(50);
    const { UNSAFE_getByType } = render(<HomeContent {...defaultProps} />);
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    expect(flatList.props.data).toHaveLength(30);
    // Sessions are pre-sorted newest-first via seedSessions; the slice covers
    // ids s50 → s21.
    expect(flatList.props.data[0].id).toBe("s50");
    expect(flatList.props.data[29].id).toBe("s21");
  });

  it("loadMore extends the visible window by another page", () => {
    seedSessions(50);
    const { UNSAFE_getByType } = render(<HomeContent {...defaultProps} />);
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    expect(flatList.props.data).toHaveLength(30);
    act(() => {
      flatList.props.onEndReached();
    });
    const refreshed = UNSAFE_getByType(FlatList);
    expect(refreshed.props.data).toHaveLength(50);
  });

  it("onEndReached is a no-op when there is nothing more to load", () => {
    seedSessions(5);
    const { UNSAFE_getByType } = render(<HomeContent {...defaultProps} />);
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    act(() => {
      flatList.props.onEndReached();
      flatList.props.onEndReached();
    });
    const refreshed = UNSAFE_getByType(FlatList);
    expect(refreshed.props.data).toHaveLength(5);
  });

  it("scroll-to-top button stays hidden near the top of the list", () => {
    const { queryByLabelText, UNSAFE_getByType } = render(
      <HomeContent {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    act(() => {
      flatList.props.onScroll({ nativeEvent: { contentOffset: { y: 10 } } });
    });
    const button = queryByLabelText("scrollToTop");
    expect(button).toBeTruthy();
    expect(button?.props.accessibilityLabel).toBe("scrollToTop");
  });

  it("scroll-to-top button becomes interactive after scrolling past the threshold", () => {
    const { getByLabelText, UNSAFE_getByType } = render(
      <HomeContent {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    // The default window height in tests is ~896; 99999 is well past the 50%
    // threshold no matter how the runtime resolves window dims.
    act(() => {
      flatList.props.onScroll({ nativeEvent: { contentOffset: { y: 99999 } } });
    });
    fireEvent.press(getByLabelText("scrollToTop"));
    expect(getByLabelText("scrollToTop")).toBeTruthy();
  });

  it("forwards scrollRef so scrollToOffset is callable", () => {
    const ref = React.createRef<any>();
    render(<HomeContent {...defaultProps} scrollRef={ref} />);
    expect(typeof ref.current?.scrollToOffset).toBe("function");
  });

  it("forwards row taps to onSessionTap and onLongPress", () => {
    const onSessionTap = jest.fn();
    const onSessionLongPress = jest.fn();

    jest.requireMock(
      "../../session/session-list-item/SessionListItem",
    ).SessionListItem = (props: any) => {
      const { Pressable, View } = require("react-native");
      return (
        <View testID={`session-row-${props.session.id}`}>
          <Pressable testID={`tap-${props.session.id}`} onPress={props.onTap} />
          <Pressable
            testID={`long-${props.session.id}`}
            onPress={props.onLongPress}
          />
        </View>
      );
    };

    seedSessions(3);
    const { getByTestId, rerender } = render(
      <HomeContent
        {...defaultProps}
        onSessionTap={onSessionTap}
        onSessionLongPress={onSessionLongPress}
      />,
    );

    fireEvent.press(getByTestId("tap-s3"));
    expect(onSessionTap).toHaveBeenCalledWith("s3");
    fireEvent.press(getByTestId("long-s2"));
    expect(onSessionLongPress).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s2" }),
    );

    rerender(
      <HomeContent
        {...defaultProps}
        selectionMode
        onSessionTap={onSessionTap}
        onSessionLongPress={onSessionLongPress}
      />,
    );
    fireEvent.press(getByTestId("tap-s1"));
    expect(onSessionTap).toHaveBeenCalledWith("s1");
  });

  it("renders a separator between session rows", () => {
    seedSessions(3);
    const { UNSAFE_getByType } = render(<HomeContent {...defaultProps} />);
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    expect(flatList.props.ItemSeparatorComponent).toBeDefined();
  });

  it("forwards scroll, content-size and layout events to the surface tracker", () => {
    const onScroll = jest.fn();
    const onContentSizeChange = jest.fn();
    const onLayout = jest.fn();
    const { UNSAFE_getByType } = render(
      <HomeContent
        {...defaultProps}
        onScroll={onScroll}
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
      />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);

    const event = { nativeEvent: { contentOffset: { y: 20 } } };
    act(() => {
      flatList.props.onScroll(event);
      flatList.props.onContentSizeChange(0, 1000);
      flatList.props.onLayout({ nativeEvent: { layout: { height: 800 } } });
    });

    expect(onScroll).toHaveBeenCalledWith(event);
    expect(onContentSizeChange).toHaveBeenCalledWith(0, 1000);
    expect(onLayout).toHaveBeenCalledWith({
      nativeEvent: { layout: { height: 800 } },
    });
  });
});
