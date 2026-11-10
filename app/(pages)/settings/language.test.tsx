/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { Routes, TestID } from "@/constants";

import LanguageSettingsScreen from "./language";

// --- Mocks ---

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockParams: { model?: string } = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

const mockShowOmnilingualDownload = jest.fn();
const mockSetModelId = jest.fn().mockResolvedValue(undefined);

const mockSetLanguage = jest.fn();

const mockLanguages = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
];

jest.mock("@/theme", () => ({
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfaceBackground: "#fff",
        surfacePrimary: "#fff",
        surfaceBorderPrimary: "#ccc",
        textPrimary: "#000",
        textSecondary: "#666",
      },
    },
  })),
}));

const {
  mockMakeLoc,
} = require("../../../src/test-utils/mock-localization/mockLocalization");

jest.mock("@/hooks", () => ({
  useScrollSurface: jest.fn(() => ({
    scrolled: false,
    contentBelow: false,
    onScroll: jest.fn(),
    onContentSizeChange: jest.fn(),
    onLayout: jest.fn(),
  })),
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
  useLanguageSearch: jest.requireActual(
    "@/hooks/use-language-search/useLanguageSearch",
  ).useLanguageSearch,
}));

jest.mock("@/models", () => ({
  getModelInfo: jest.fn(() => ({
    supportedLanguageCodes: undefined,
    languages: 1650,
    sizeBytes: 365_438_543,
  })),
  ModelId: { WHISPER_TINY: "whisper_tiny", OMNILINGUAL: "omnilingual" },
  ...jest.requireActual("@/models/omnilingual/OmnilingualLanguages"),
  shouldSuggestLargerModel: jest.requireActual(
    "@/models/model-registry/ModelRegistry",
  ).shouldSuggestLargerModel,
  SupportedLanguages: {
    get all() {
      return mockLanguages;
    },
    forCodes: jest.fn(() => mockLanguages),
    search: jest.requireActual("@/models/spoken-language/SpokenLanguage")
      .SupportedLanguages.search,
    pickerOrder: jest.requireActual("@/models/spoken-language/SpokenLanguage")
      .SupportedLanguages.pickerOrder,
    defaultLanguage: { code: "en", name: "English" },
  },
}));

const mockShowLargerModelSuggestion = jest.fn();

jest.mock("@/stores", () => ({
  useSelectedLanguage: jest.fn(() => ({ code: "en", name: "English" })),
  useSelectedModelId: jest.fn(() => "whisper_tiny"),
  useSetLanguage: jest.fn(() => mockSetLanguage),
  useSetModelId: jest.fn(() => mockSetModelId),
  useIsModelDownloaded: jest.fn(() => false),
  useShowOmnilingualDownload: jest.fn(() => mockShowOmnilingualDownload),
  useHasSeenLargerModelSuggestion: jest.fn(() => false),
  useShowLargerModelSuggestion: jest.fn(() => mockShowLargerModelSuggestion),
}));

jest.mock("@/utils", () => ({
  delay: jest.fn(() => Promise.resolve()),
  iosPressed: jest.fn(() => 1),
  logError: jest.fn(),
  FeatureFlag: { settings: "settings" },
}));

jest.mock("@/components/ui/ripple-pressable/RipplePressable", () => {
  const { TouchableOpacity } = require("react-native");
  return {
    RipplePressable: ({ children, testID, onPress }: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        {children}
      </TouchableOpacity>
    ),
  };
});

jest.mock("@/components", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  const { TestID: TID, dynamicTestID: dTID } = require("@/constants");
  return {
    AppBarBlurTarget: ({ children }: any) => <View>{children}</View>,
    Card: ({ children }: any) => <View testID={TID.Card}>{children}</View>,
    Divider: () => <View testID={TID.Divider} />,
    Icon: () => null,
    LanguageListItem: ({ language, selected, enabled, onSelect }: any) => {
      const select = enabled ? () => onSelect(language) : undefined;
      return (
        <TouchableOpacity
          testID={dTID.listItem(language.name)}
          onPress={select}
        >
          <Text>{language.name}</Text>
          <TouchableOpacity testID={dTID.radio(language.code)} onPress={select}>
            <Text testID={dTID.radioSelected(language.code)}>
              {selected ? "selected" : "unselected"}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    OmnilingualLanguageListItem: ({ language, onPress, testID }: any) => (
      <TouchableOpacity testID={testID} onPress={onPress} disabled={!onPress}>
        <Text>{language.name}</Text>
        <Text>{language.script}</Text>
      </TouchableOpacity>
    ),
    NoLanguagesFound: () => <View testID="no-languages-found" />,
    Screen: ({ children }: any) => <View>{children}</View>,
    Text: ({ children }: any) => <Text>{String(children)}</Text>,
    TextField: ({ value, onChangeText }: any) => {
      const { TextInput } = require("react-native");
      return (
        <TextInput testID="search" value={value} onChangeText={onChangeText} />
      );
    },
    TopAppBar: ({ title, actions }: any) => (
      <View testID={TID.TopAppBar}>
        <Text>{String(title)}</Text>
        {actions}
      </View>
    ),
  };
});

describe("LanguageSettingsScreen", () => {
  it("renders the description above the list", () => {
    const { getByText } = render(<LanguageSettingsScreen />);
    expect(getByText("spokenLanguageDescription")).toBeTruthy();
  });

  it("renders language list items", () => {
    const { getByTestId } = render(<LanguageSettingsScreen />);
    expect(getByTestId("list-item-English")).toBeTruthy();
    expect(getByTestId("list-item-Spanish")).toBeTruthy();
    expect(getByTestId("list-item-French")).toBeTruthy();
  });

  it("current language radio is selected", () => {
    const { getByTestId } = render(<LanguageSettingsScreen />);
    expect(getByTestId("radio-selected-en")).toHaveTextContent("selected");
    expect(getByTestId("radio-selected-es")).toHaveTextContent("unselected");
    expect(getByTestId("radio-selected-fr")).toHaveTextContent("unselected");
  });

  it("selecting same language navigates back without calling setLanguage", () => {
    const { getByTestId } = render(<LanguageSettingsScreen />);
    fireEvent.press(getByTestId("list-item-English"));
    expect(mockBack).toHaveBeenCalled();
    expect(mockSetLanguage).not.toHaveBeenCalled();
  });

  it("selecting different language calls setLanguage and navigates back", async () => {
    mockSetLanguage.mockResolvedValue(undefined);

    const { getByTestId } = render(<LanguageSettingsScreen />);
    fireEvent.press(getByTestId("list-item-French"));

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith({
        code: "fr",
        name: "French",
      });
      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe("search", () => {
    let now: number;
    beforeEach(() => {
      now = 0;
      jest.spyOn(Date, "now").mockImplementation(() => now);
    });
    afterEach(() => jest.restoreAllMocks());

    const open = (utils: ReturnType<typeof render>) => {
      fireEvent.press(utils.getByTestId(TestID.LanguageSearchOpen));
      now += 1000;
    };

    it("swaps the description for the field and filters the list", () => {
      const utils = render(<LanguageSettingsScreen />);
      const { getByTestId, queryByTestId, queryByText } = utils;
      expect(queryByTestId("search")).toBeNull();

      open(utils);
      expect(queryByText("spokenLanguageDescription")).toBeNull();

      fireEvent.changeText(getByTestId("search"), "fre");
      expect(queryByTestId("list-item-English")).toBeNull();
      expect(getByTestId("list-item-French")).toBeTruthy();

      fireEvent.changeText(getByTestId("search"), "Klingon");
      expect(getByTestId("no-languages-found")).toBeTruthy();

      fireEvent.changeText(getByTestId("search"), "");
      expect(queryByTestId("no-languages-found")).toBeNull();
      expect(getByTestId("list-item-Spanish")).toBeTruthy();
    });

    it("x closes and clears search first, then leaves", () => {
      const utils = render(<LanguageSettingsScreen />);
      open(utils);
      fireEvent.changeText(utils.getByTestId("search"), "fre");

      fireEvent.press(utils.getByTestId(TestID.LanguageSearchClose));
      expect(utils.queryByTestId("search")).toBeNull();
      expect(utils.getByText("spokenLanguageDescription")).toBeTruthy();
      expect(utils.getByTestId("list-item-English")).toBeTruthy();
      expect(mockBack).not.toHaveBeenCalled();

      now += 1000;
      fireEvent.press(utils.getByTestId(TestID.LanguageSearchClose));
      expect(mockBack).toHaveBeenCalled();
    });

    it("ignores the x while the search animation runs", () => {
      const utils = render(<LanguageSettingsScreen />);
      fireEvent.press(utils.getByTestId(TestID.LanguageSearchOpen));
      fireEvent.press(utils.getByTestId(TestID.LanguageSearchClose));
      expect(utils.getByTestId("search")).toBeTruthy();
      expect(mockBack).not.toHaveBeenCalled();
    });
  });

  it("lists the selected language first", () => {
    const { useSelectedLanguage } = require("@/stores");
    (useSelectedLanguage as jest.Mock).mockReturnValueOnce({
      code: "fr",
      name: "French",
    });
    const { getAllByTestId } = render(<LanguageSettingsScreen />);
    expect(getAllByTestId(/^list-item-/)[0].props.testID).toBe(
      "list-item-French",
    );
    expect(mockLanguages[0].code).toBe("en");
  });

  it("handles error when setLanguage fails", async () => {
    const { logError } = require("@/utils");
    mockSetLanguage.mockRejectedValue(new Error("language error"));

    const { getByTestId } = render(<LanguageSettingsScreen />);
    fireEvent.press(getByTestId("list-item-Spanish"));

    await waitFor(() => {
      expect(logError).toHaveBeenCalled();
    });
  });

  it("shows pending language as selected while saving", async () => {
    let resolveSetLanguage: () => void;
    mockSetLanguage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSetLanguage = resolve;
        }),
    );

    const { getByTestId } = render(<LanguageSettingsScreen />);
    fireEvent.press(getByTestId("list-item-Spanish"));

    // While saving, Spanish should appear selected (pendingLanguageCode)
    await waitFor(() => {
      expect(getByTestId("radio-selected-es")).toHaveTextContent("selected");
    });

    resolveSetLanguage!();
    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it("does not call handleSelect when isSaving is true", async () => {
    mockSetLanguage.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
    );

    const { getByTestId } = render(<LanguageSettingsScreen />);

    // First press starts saving
    fireEvent.press(getByTestId("list-item-Spanish"));

    // Second press while saving should be ignored
    fireEvent.press(getByTestId("list-item-French"));

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledTimes(1);
      expect(mockSetLanguage).toHaveBeenCalledWith({
        code: "es",
        name: "Spanish",
      });
    });
  });

  it("Radio onValueChange triggers handleSelect for Spanish", async () => {
    mockSetLanguage.mockResolvedValue(undefined);

    const { getByTestId } = render(<LanguageSettingsScreen />);
    fireEvent.press(getByTestId("radio-es"));

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith({
        code: "es",
        name: "Spanish",
      });
    });
  });

  describe("larger model suggestion", () => {
    beforeEach(() => {
      mockShowLargerModelSuggestion.mockClear();
      mockSetLanguage.mockResolvedValue(undefined);
      const {
        useSelectedModelId,
        useHasSeenLargerModelSuggestion,
      } = require("@/stores");
      (useSelectedModelId as jest.Mock).mockReturnValue("whisper_tiny");
      (useHasSeenLargerModelSuggestion as jest.Mock).mockReturnValue(false);
    });

    it("shows for a non-English language on the bundled model", async () => {
      const { getByTestId } = render(<LanguageSettingsScreen />);
      fireEvent.press(getByTestId("list-item-French"));

      await waitFor(() => {
        expect(mockShowLargerModelSuggestion).toHaveBeenCalled();
      });
    });

    it("does not show when English is selected", async () => {
      const { useSelectedLanguage } = require("@/stores");
      (useSelectedLanguage as jest.Mock).mockReturnValue({
        code: "fr",
        name: "French",
      });

      const { getByTestId } = render(<LanguageSettingsScreen />);
      fireEvent.press(getByTestId("list-item-English"));

      await waitFor(() => {
        expect(mockSetLanguage).toHaveBeenCalled();
      });
      expect(mockShowLargerModelSuggestion).not.toHaveBeenCalled();

      (useSelectedLanguage as jest.Mock).mockReturnValue({
        code: "en",
        name: "English",
      });
    });

    it("does not show when already on a larger model", async () => {
      const { useSelectedModelId } = require("@/stores");
      (useSelectedModelId as jest.Mock).mockReturnValue("nemo_parakeet_v3");

      const { getByTestId } = render(<LanguageSettingsScreen />);
      fireEvent.press(getByTestId("list-item-French"));

      await waitFor(() => {
        expect(mockSetLanguage).toHaveBeenCalled();
      });
      expect(mockShowLargerModelSuggestion).not.toHaveBeenCalled();
    });

    it("does not show when it has already been seen", async () => {
      const { useHasSeenLargerModelSuggestion } = require("@/stores");
      (useHasSeenLargerModelSuggestion as jest.Mock).mockReturnValue(true);

      const { getByTestId } = render(<LanguageSettingsScreen />);
      fireEvent.press(getByTestId("list-item-French"));

      await waitFor(() => {
        expect(mockSetLanguage).toHaveBeenCalled();
      });
      expect(mockShowLargerModelSuggestion).not.toHaveBeenCalled();
    });

    it("does not show when setLanguage fails", async () => {
      mockSetLanguage.mockRejectedValue(new Error("language error"));
      const { logError } = require("@/utils");

      const { getByTestId } = render(<LanguageSettingsScreen />);
      fireEvent.press(getByTestId("list-item-French"));

      await waitFor(() => {
        expect(logError).toHaveBeenCalled();
      });
      expect(mockShowLargerModelSuggestion).not.toHaveBeenCalled();
    });
  });

  describe("Omnilingual", () => {
    let now: number;
    beforeEach(() => {
      now = 0;
      jest.spyOn(Date, "now").mockImplementation(() => now);
      mockReplace.mockClear();
      mockSetModelId.mockClear();
      mockShowOmnilingualDownload.mockClear();
    });
    afterEach(() => {
      jest.restoreAllMocks();
      delete mockParams.model;
      const { useSelectedModelId, useIsModelDownloaded } = require("@/stores");
      (useSelectedModelId as jest.Mock).mockReturnValue("whisper_tiny");
      (useIsModelDownloaded as jest.Mock).mockReturnValue(false);
    });

    const search = (query: string) => {
      const utils = render(<LanguageSettingsScreen />);
      fireEvent.press(utils.getByTestId(TestID.LanguageSearchOpen));
      now += 1000;
      fireEvent.changeText(utils.getByTestId("search"), query);
      return utils;
    };

    it("stays hidden while the current model has a match", () => {
      const { queryByText, queryByTestId } = search("fre");
      expect(queryByText("availableWithOmnilingual")).toBeNull();
      expect(queryByTestId("language-yue")).toBeNull();
    });

    it("shows its matches when the current model has none", () => {
      const { getByText, getByTestId, queryByTestId } = search("Cantonese");
      expect(getByText("availableWithOmnilingual")).toBeTruthy();
      expect(getByTestId("language-yue")).toHaveTextContent("CantoneseHan");
      expect(queryByTestId("no-languages-found")).toBeNull();
    });

    it("matches the ISO name too", () => {
      expect(search("Yue Chinese").getByTestId("language-yue")).toBeTruthy();
    });

    it("offers the download when it isn't downloaded", () => {
      const { getByTestId } = search("Cantonese");
      fireEvent.press(getByTestId("language-yue"));
      expect(mockShowOmnilingualDownload).toHaveBeenCalledTimes(1);
      expect(mockSetModelId).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("activates it when already downloaded", () => {
      const { useIsModelDownloaded } = require("@/stores");
      (useIsModelDownloaded as jest.Mock).mockReturnValue(true);
      const { getByTestId } = search("Cantonese");

      fireEvent.press(getByTestId("language-yue"));
      expect(mockShowOmnilingualDownload).not.toHaveBeenCalled();
      expect(mockSetModelId).toHaveBeenCalledWith("omnilingual");
      expect(mockReplace).toHaveBeenCalledWith(Routes.settingsModel);
    });

    it("shows try another spelling when nothing matches it either", () => {
      const { getByTestId, queryByText } = search("Klingon");
      expect(getByTestId("no-languages-found")).toBeTruthy();
      expect(queryByText("availableWithOmnilingual")).toBeNull();
    });

    it.each([
      [
        "while active",
        () => {
          const { useSelectedModelId } = require("@/stores");
          (useSelectedModelId as jest.Mock).mockReturnValue("omnilingual");
        },
      ],
      [
        "from its language count",
        () => {
          mockParams.model = "omnilingual";
        },
      ],
    ])("lists every language %s, with no action", (_, setup) => {
      setup();
      const { getByText, getByTestId, queryByTestId } = render(
        <LanguageSettingsScreen />,
      );
      expect(getByText("omnilingualLanguagesTitle")).toBeTruthy();
      expect(getByText("omnilingualLanguagesDescription_1650")).toBeTruthy();
      expect(getByTestId("language-kbt")).toHaveTextContent("AbadiLatin");
      expect(queryByTestId("list-item-English")).toBeNull();
      expect(getByTestId("language-kbt")).toBeDisabled();
    });

    it("keeps search while active", () => {
      const { useSelectedModelId } = require("@/stores");
      (useSelectedModelId as jest.Mock).mockReturnValue("omnilingual");
      const { getByTestId, queryByTestId, queryByText } = search("Canto");
      expect(getByTestId("language-yue")).toBeDisabled();
      expect(queryByTestId("language-kbt")).toBeNull();
      expect(queryByText("availableWithOmnilingual")).toBeNull();
    });
  });
});
