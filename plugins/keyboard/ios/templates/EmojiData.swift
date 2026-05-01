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

    /// SF Symbol shown in the category strip.
    var symbolName: String {
        switch self {
        case .recents: return "clock"
        case .smileys: return "face.smiling"
        case .animals: return "pawprint"
        case .food: return "fork.knife"
        case .activity: return "soccerball"
        case .travel: return "airplane"
        case .objects: return "lightbulb"
        case .symbols: return "heart"
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
