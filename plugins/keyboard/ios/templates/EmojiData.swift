import Foundation

/// Categories surfaced in the in-keyboard emoji picker. The order matches the
/// stock iOS emoji keyboard so users land on familiar tabs.
enum EmojiCategory: String, CaseIterable {
    case recents
    case smileys
    case animals
    case food
    case activity
    case travel
    case objects
    case symbols
    case flags

    /// SF Symbol shown in the category strip. Tracks the native iOS 18+
    /// emoji keyboard: bear for animals, buildings for travel/places, etc.
    /// All outline variants — the native bottom strip uses the lighter
    /// stroke style, not the filled glyph. Falls back to the pre-iOS-18
    /// symbol where the newer one isn't available so the strip still
    /// renders on iOS 16/17.
    var symbolName: String {
        switch self {
        case .recents: return "clock"
        case .smileys: return "face.smiling"
        case .animals:
            if #available(iOS 18.0, *) { return "teddybear" }
            return "pawprint"
        case .food: return "fork.knife"
        case .activity: return "soccerball"
        case .travel: return "building.2"
        case .objects: return "lightbulb"
        case .symbols: return "music.note"
        case .flags: return "flag"
        }
    }

    /// VoiceOver label for the category button.
    var displayName: String {
        switch self {
        case .recents: return "Frequently Used"
        case .smileys: return "Smileys & People"
        case .animals: return "Animals & Nature"
        case .food: return "Food & Drink"
        case .activity: return "Activity"
        case .travel: return "Travel & Places"
        case .objects: return "Objects"
        case .symbols: return "Symbols"
        case .flags: return "Flags"
        }
    }
}

/// Curated emoji dataset. Avoids ZWJ-heavy variants the host text engine may
/// not render in older iOS versions; prioritises the most frequently used
/// glyphs from each category.
enum EmojiData {

    static let smileys: [String] = [
        "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
        "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙",
        "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
        "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
        "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
        "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐",
        "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦",
        "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞",
        "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿",
        "💀", "💩", "🤡", "👹", "👺", "👻", "👽", "🤖", "😺", "😸",
        "😹", "😻", "😼", "😽", "🙀", "😿", "😾",
        "👋", "🤚", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟", "🤘",
        "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊",
        "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏",
        "💪", "🦾", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🦷", "🦴",
        "👀", "👁", "👅", "👄", "💋",
        "👶", "🧒", "👦", "👧", "🧑", "👨", "👩", "🧓", "👴", "👵",
        "🙍", "🙎", "🙅", "🙆", "💁", "🙋", "🧏", "🙇", "🤦", "🤷",
        "💆", "💇", "🚶", "🏃", "💃", "🕺", "👯", "🧖", "🧗", "🤺",
        "🏇", "⛷", "🏂", "🏌", "🏄", "🚣", "🏊", "⛹", "🏋", "🚴",
        "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
        "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟",
    ]

    static let animals: [String] = [
        "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨",
        "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊",
        "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉",
        "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞",
        "🐜", "🦟", "🦗", "🕷", "🕸", "🦂", "🐢", "🐍", "🦎", "🦖",
        "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬",
        "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘",
        "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐂", "🐄", "🐎",
        "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐕‍🦺",
        "🐈", "🐓", "🦃", "🦚", "🦜", "🦢", "🦩", "🕊", "🐇", "🦝",
        "🦨", "🦡", "🦦", "🦥", "🐁", "🐀", "🐿", "🦔",
        "🌵", "🎄", "🌲", "🌳", "🌴", "🌱", "🌿", "☘️", "🍀", "🎍",
        "🎋", "🍃", "🍂", "🍁", "🍄", "🐚", "🌾", "💐", "🌷", "🌹",
        "🥀", "🌺", "🌸", "🌼", "🌻", "🌞", "🌝", "🌛", "🌜", "🌚",
        "🌕", "🌖", "🌗", "🌘", "🌑", "🌒", "🌓", "🌔", "🌙", "🌎",
        "🌍", "🌏", "🪐", "💫", "⭐️", "🌟", "✨", "⚡️", "☄️", "💥",
        "🔥", "🌪", "🌈", "☀️", "🌤", "⛅️", "🌥", "☁️", "🌦", "🌧",
        "⛈", "🌩", "🌨", "❄️", "☃️", "⛄️", "🌬", "💨", "💧", "💦",
        "☔️", "☂️", "🌊", "🌫",
    ]

    static let food: [String] = [
        "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐",
        "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑",
        "🥦", "🥬", "🥒", "🌶", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅",
        "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳",
        "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔",
        "🍟", "🍕", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🥘",
        "🫕", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪",
        "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧",
        "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫",
        "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "🍼", "🫖", "☕️",
        "🍵", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃",
        "🍸", "🍹", "🧉", "🍾", "🧊", "🥄", "🍴", "🍽", "🥣", "🥡",
        "🥢", "🧂",
    ]

    static let activity: [String] = [
        "⚽️", "🏀", "🏈", "⚾️", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱",
        "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳️",
        "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷",
        "⛸", "🥌", "🎿", "⛷", "🏂", "🪂", "🏋️", "🤼", "🤸", "⛹️",
        "🤺", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗",
        "🚵", "🚴", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖", "🏵", "🎗",
        "🎫", "🎟", "🎪", "🤹", "🎭", "🩰", "🎨", "🎬", "🎤", "🎧",
        "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻",
        "🎲", "♟", "🎯", "🎳", "🎮", "🎰", "🧩",
    ]

    static let travel: [String] = [
        "🚗", "🚕", "🚙", "🚌", "🚎", "🏎", "🚓", "🚑", "🚒", "🚐",
        "🛻", "🚚", "🚛", "🚜", "🦯", "🦽", "🦼", "🛴", "🚲", "🛵",
        "🏍", "🛺", "🚨", "🚔", "🚍", "🚘", "🚖", "🚡", "🚠", "🚟",
        "🚃", "🚋", "🚞", "🚝", "🚄", "🚅", "🚈", "🚂", "🚆", "🚇",
        "🚊", "🚉", "✈️", "🛫", "🛬", "🛩", "💺", "🛰", "🚀", "🛸",
        "🚁", "🛶", "⛵️", "🚤", "🛥", "🛳", "⛴", "🚢", "⚓️", "⛽️",
        "🚧", "🚦", "🚥", "🚏", "🗺", "🗿", "🗽", "🗼", "🏰", "🏯",
        "🏟", "🎡", "🎢", "🎠", "⛲️", "⛱", "🏖", "🏝", "🏜", "🌋",
        "⛰", "🏔", "🗻", "🏕", "⛺️", "🛖", "🏠", "🏡", "🏘", "🏚",
        "🏗", "🏭", "🏢", "🏬", "🏣", "🏤", "🏥", "🏦", "🏨", "🏪",
        "🏫", "🏩", "💒", "🏛", "⛪️", "🕌", "🕍", "🛕", "🕋", "⛩",
        "🛤", "🛣", "🗾", "🎑", "🏞", "🌅", "🌄", "🌠", "🎇", "🎆",
        "🌇", "🌆", "🏙", "🌃", "🌌", "🌉", "🌁",
    ]

    static let objects: [String] = [
        "⌚️", "📱", "📲", "💻", "⌨️", "🖥", "🖨", "🖱", "🖲", "🕹",
        "🗜", "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥",
        "📽", "🎞", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙", "🎚",
        "🎛", "🧭", "⏱", "⏲", "⏰", "🕰", "⌛️", "⏳", "📡", "🔋",
        "🔌", "💡", "🔦", "🕯", "🪔", "🧯", "🛢", "💸", "💵", "💴",
        "💶", "💷", "💰", "💳", "💎", "⚖️", "🪜", "🧰", "🔧", "🔨",
        "⚒", "🛠", "⛏", "🪓", "🪚", "🔩", "⚙️", "🪤", "🧱", "⛓",
        "🧲", "🔫", "💣", "🧨", "🪒", "🪦", "🔪", "🗡", "⚔️", "🛡",
        "🚬", "⚰️", "⚱️", "🏺", "🔮", "📿", "🧿", "💈", "⚗️", "🔭",
        "🔬", "🕳", "🩹", "🩺", "💊", "💉", "🩸", "🧬", "🦠", "🧫",
        "🧪", "🌡", "🧹", "🧺", "🧻", "🚽", "🚰", "🚿", "🛁", "🛀",
        "🧼", "🪥", "🪒", "🧽", "🪣", "🧴", "🛎", "🔑", "🗝", "🚪",
        "🪑", "🛋", "🛏", "🛌", "🧸", "🪆", "🖼", "🪞", "🪟", "🛍",
        "🛒", "🎁", "🎈", "🎏", "🎀", "🪄", "🪅", "🎊", "🎉", "🎎",
        "🏮", "🎐", "🧧", "✉️", "📩", "📨", "📧", "💌", "📥", "📤",
        "📦", "🏷", "📪", "📫", "📬", "📭", "📮", "📯", "📜", "📃",
        "📄", "📑", "🧾", "📊", "📈", "📉", "🗒", "🗓", "📆", "📅",
        "🗑", "📇", "🗃", "🗳", "🗄", "📋", "📁", "📂", "🗂", "🗞",
        "📰", "📓", "📔", "📒", "📕", "📗", "📘", "📙", "📚", "📖",
        "🔖", "🧷", "🔗", "📎", "🖇", "📐", "📏", "🧮", "📌", "📍",
        "✂️", "🖊", "🖋", "✒️", "🖌", "🖍", "📝", "✏️", "🔍", "🔎",
        "🔏", "🔐", "🔒", "🔓",
    ]

    static let symbols: [String] = [
        "💯", "💢", "💥", "💫", "💦", "💨", "🕳", "💣", "💬", "👁‍🗨",
        "🗨", "🗯", "💭", "💤",
        "♠️", "♥️", "♦️", "♣️", "♟",
        "🆎", "🆑", "🆒", "🆓", "🆔", "🆕", "🆖", "🆗", "🆘", "🆙",
        "🆚",
        "🅰️", "🅱️", "🅾️", "🅿️", "🈁", "🈂️", "🈷️", "🈶", "🈯️", "🉐",
        "🈹", "🈚️", "🈲", "🉑", "🈸", "🈴", "🈳", "㊗️", "㊙️", "🈺",
        "🈵",
        "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫️", "⚪️",
        "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛️", "⬜️", "◼️",
        "◻️", "◾️", "◽️", "▪️", "▫️", "🔶", "🔷", "🔸", "🔹", "🔺",
        "🔻", "💠", "🔘", "🔳", "🔲",
        "✅", "❌", "❎", "✔️", "☑️", "❇️", "✳️", "✴️", "❄️", "🆎",
        "♻️", "⚜️", "🔱", "📛", "🔰", "⭕️", "❗️", "❓", "❕", "❔",
        "‼️", "⁉️", "〰️", "©️", "®️", "™️",
        "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️", "⬆️", "↕️", "↔️",
        "↩️", "↪️", "⤴️", "⤵️", "🔃", "🔄", "🔙", "🔚", "🔛", "🔜",
        "🔝",
        "🔢", "#️⃣", "*️⃣", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣",
        "7️⃣", "8️⃣", "9️⃣", "🔟", "🔠", "🔡", "🔣", "🔤",
    ]

    static let flags: [String] = [
        "🏳️", "🏴", "🏁", "🚩", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️",
        "🇺🇸", "🇬🇧", "🇨🇦", "🇦🇺", "🇩🇪", "🇫🇷", "🇮🇹", "🇪🇸", "🇵🇹", "🇳🇱",
        "🇧🇪", "🇨🇭", "🇦🇹", "🇸🇪", "🇳🇴", "🇩🇰", "🇫🇮", "🇮🇸", "🇮🇪", "🇵🇱",
        "🇨🇿", "🇸🇰", "🇭🇺", "🇷🇴", "🇧🇬", "🇬🇷", "🇹🇷", "🇷🇺", "🇺🇦", "🇧🇾",
        "🇪🇪", "🇱🇻", "🇱🇹", "🇯🇵", "🇰🇷", "🇨🇳", "🇹🇼", "🇭🇰", "🇸🇬", "🇲🇾",
        "🇹🇭", "🇻🇳", "🇵🇭", "🇮🇩", "🇮🇳", "🇵🇰", "🇧🇩", "🇱🇰", "🇳🇵", "🇦🇪",
        "🇸🇦", "🇮🇱", "🇮🇷", "🇮🇶", "🇪🇬", "🇿🇦", "🇲🇦", "🇰🇪", "🇳🇬", "🇪🇹",
        "🇲🇽", "🇧🇷", "🇦🇷", "🇨🇱", "🇨🇴", "🇵🇪", "🇻🇪", "🇨🇺", "🇩🇴", "🇵🇷",
        "🇳🇿", "🇪🇺", "🇺🇳",
    ]

    static func emojis(for category: EmojiCategory) -> [String] {
        switch category {
        case .recents: return RecentEmojis.shared.all()
        case .smileys: return smileys
        case .animals: return animals
        case .food: return food
        case .activity: return activity
        case .travel: return travel
        case .objects: return objects
        case .symbols: return symbols
        case .flags: return flags
        }
    }
}

// MARK: - Skin tones

/// Skin-tone support for the hand/finger emojis. Applying a tone strips the
/// variation selector (U+FE0F) and appends the Fitzpatrick modifier — the
/// standard composition for single-person emojis (✌️ → U+270C U+1F3FB).
enum EmojiSkinTones {

    /// Fitzpatrick modifiers, light → dark.
    static let tones: [String] = [
        "\u{1F3FB}", "\u{1F3FC}", "\u{1F3FD}", "\u{1F3FE}", "\u{1F3FF}",
    ]

    /// The hand/finger emojis from the picker dataset that get the
    /// long-press skin-tone popover.
    static let supportedBases: Set<String> = [
        "👋", "🤚", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟", "🤘",
        "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊",
        "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪",
    ]

    static func supports(_ emoji: String) -> Bool {
        supportedBases.contains(emoji)
    }

    static func applying(_ tone: String?, to base: String) -> String {
        guard let tone else { return base }
        // A modifier implies emoji presentation, so the variation selector
        // must not remain (U+270C U+FE0F U+1F3FB doesn't render as one glyph).
        return base.replacingOccurrences(of: "\u{FE0F}", with: "") + tone
    }
}

/// Remembers the user's skin-tone choice per emoji (not one global tone —
/// matching native iOS, where each hand emoji keeps its own variant). Same
/// app-group backing as `RecentEmojis`.
final class SkinTonePreferences {

    static let shared = SkinTonePreferences()

    private static let storageKey = "EchosKeyboard.emojiSkinTones"

    private let defaults: UserDefaults
    // Cached in memory so `display(_:)` — called per cell dequeue while
    // scrolling the grid and per result button on every search keystroke —
    // doesn't deserialize the whole app-group dictionary on the main thread
    // each time. The keyboard is the sole writer during a session, so the
    // cache stays authoritative; `setTone` writes through.
    private var map: [String: String]

    private init() {
        let defaults = UserDefaults(suiteName: KeyboardSettings.appGroupID) ?? .standard
        self.defaults = defaults
        self.map = defaults.dictionary(forKey: SkinTonePreferences.storageKey)
            as? [String: String] ?? [:]
    }

    /// The remembered Fitzpatrick modifier for `base`, or nil for the
    /// golden default.
    func tone(for base: String) -> String? {
        map[base]
    }

    /// Passing nil resets `base` back to the golden default.
    func setTone(_ tone: String?, for base: String) {
        map[base] = tone
        defaults.set(map, forKey: SkinTonePreferences.storageKey)
    }

    /// The emoji to render and insert for `base` — its remembered tone
    /// applied. Data stays keyed by base everywhere (grid, recents, search
    /// index) so a tone change retints every surface at once.
    func display(_ base: String) -> String {
        EmojiSkinTones.applying(tone(for: base), to: base)
    }
}

/// Persists the last ~30 emojis the user picked, so the Recents tab feels
/// useful across keyboard sessions. Backed by the app group's UserDefaults
/// so the host app can read the same data later if we ever want to.
final class RecentEmojis {

    static let shared = RecentEmojis()

    private static let suiteName = "group.com.a1lab.echos.shared"
    private static let storageKey = "EchosKeyboard.recentEmojis"
    private static let maxCount = 30

    private let defaults: UserDefaults

    private init() {
        // Fall back to standard defaults if the app group isn't reachable
        // (shouldn't happen in production — the entitlement is set up by
        // the Expo plugin — but keeps the picker functional in dev builds
        // that haven't enabled the group yet).
        self.defaults = UserDefaults(suiteName: RecentEmojis.suiteName) ?? .standard
    }

    func all() -> [String] {
        defaults.stringArray(forKey: RecentEmojis.storageKey) ?? []
    }

    func record(_ emoji: String) {
        var current = all()
        current.removeAll { $0 == emoji }
        current.insert(emoji, at: 0)
        if current.count > RecentEmojis.maxCount {
            current = Array(current.prefix(RecentEmojis.maxCount))
        }
        defaults.set(current, forKey: RecentEmojis.storageKey)
    }
}
