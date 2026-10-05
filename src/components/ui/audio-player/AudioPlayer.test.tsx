import { act, fireEvent, render } from "@testing-library/react-native";
import { setAudioModeAsync } from "expo-audio";
import { File } from "expo-file-system";
import React from "react";

import { AudioPlayer, formatPlaybackTime, readWavPeaks } from "./AudioPlayer";

const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
};
let mockStatus: Record<string, unknown>;

jest.mock("expo-audio", () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioPlayer: jest.fn(() => mockPlayer),
  useAudioPlayerStatus: jest.fn(() => mockStatus),
}));

const wavWithSamples = (samples: number[]) => {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, s, true));
  return bytes;
};

const mockWav = (bytes: Uint8Array) => {
  const handle: {
    size: number;
    offset: number | null;
    readBytes: jest.Mock;
    close: jest.Mock;
  } = {
    size: bytes.length,
    offset: 0 as number | null,
    readBytes: jest.fn(
      (length: number): Uint8Array =>
        bytes.slice(handle.offset!, handle.offset! + length),
    ),
    close: jest.fn(),
  };
  (File as unknown as jest.Mock).mockImplementation(() => ({
    open: () => handle,
  }));
  return handle;
};

const barCount = (waves: any) =>
  waves.children.filter((c: any) => c.props?.style).length;

const layoutWaves = (getByTestId: (id: string) => any, width: number) =>
  act(() => {
    fireEvent(getByTestId("player-waves"), "layout", {
      nativeEvent: { layout: { width, height: 14 } },
    });
  });

describe("readWavPeaks", () => {
  it("returns per-window peaks normalized to the loudest", () => {
    const handle = mockWav(wavWithSamples([100, -200, 50, -25]));

    expect(readWavPeaks("file:///a.wav", 2)).toEqual([1, 0.25]);
    expect(handle.close).toHaveBeenCalled();
  });

  it("returns zeros for silence or too-short audio", () => {
    mockWav(wavWithSamples([0, 0]));
    expect(readWavPeaks("file:///a.wav", 2)).toEqual([0, 0]);

    mockWav(wavWithSamples([]));
    expect(readWavPeaks("file:///a.wav", 3)).toEqual([0, 0, 0]);
  });
});

describe("formatPlaybackTime", () => {
  it("formats m:ss", () => {
    expect(formatPlaybackTime(3.7)).toBe("0:03");
    expect(formatPlaybackTime(125)).toBe("2:05");
  });
});

describe("AudioPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = {
      playing: false,
      currentTime: 0,
      duration: 3,
      isLoaded: true,
      didJustFinish: false,
    };
    mockWav(wavWithSamples([100, -200, 50, -25, 10, 0]));
  });

  it("shows the duration and a bar per 3px of width", () => {
    const { getByText, getByTestId } = render(
      <AudioPlayer uri="file:///a.wav" testID="player" />,
    );
    layoutWaves(getByTestId, 9);

    expect(getByText("0:03")).toBeTruthy();
    expect(barCount(getByTestId("player-waves"))).toBe(3);
  });

  it("switches to playback mode before playing", async () => {
    const { getByTestId } = render(
      <AudioPlayer uri="file:///a.wav" testID="player" />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("player-toggle"));
    });

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      allowsRecording: false,
    });
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it("still plays when the audio mode can't be set", async () => {
    (setAudioModeAsync as jest.Mock).mockRejectedValueOnce(new Error("busy"));
    const { getByTestId } = render(
      <AudioPlayer uri="file:///a.wav" testID="player" />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("player-toggle"));
    });

    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it("pauses while playing and shows the current time", async () => {
    mockStatus = { ...mockStatus, playing: true, currentTime: 1.2 };
    const { getByTestId, getByText } = render(
      <AudioPlayer uri="file:///a.wav" testID="player" />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("player-toggle"));
    });

    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(getByText("0:01")).toBeTruthy();
  });

  it("seeks to the tapped waveform position", () => {
    const { getByTestId } = render(
      <AudioPlayer uri="file:///a.wav" testID="player" />,
    );
    layoutWaves(getByTestId, 90);

    fireEvent.press(getByTestId("player-waves"), {
      nativeEvent: { locationX: 30 },
    });

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(1);
  });

  it("rewinds when playback finishes", () => {
    mockStatus = { ...mockStatus, didJustFinish: true };
    render(<AudioPlayer uri="file:///a.wav" />);

    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
  });

  it("renders flat bars while the file is unavailable or unreadable", () => {
    (File as unknown as jest.Mock).mockImplementation(() => {
      throw new Error("missing");
    });
    const { getByTestId, rerender } = render(
      <AudioPlayer uri={null} testID="player" />,
    );
    layoutWaves(getByTestId, 6);
    expect(barCount(getByTestId("player-waves"))).toBe(2);

    rerender(<AudioPlayer uri="file:///missing.wav" testID="player" />);
    expect(barCount(getByTestId("player-waves"))).toBe(2);
  });

  it("calls onDelete from the trash button", () => {
    const onDelete = jest.fn();
    const { getByTestId } = render(
      <AudioPlayer uri="file:///a.wav" onDelete={onDelete} testID="player" />,
    );

    fireEvent.press(getByTestId("player-delete"));

    expect(onDelete).toHaveBeenCalled();
  });
});
