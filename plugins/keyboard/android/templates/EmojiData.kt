package com.a1lab.echos.ime

import android.content.Context
import android.content.SharedPreferences

/**
 * Categories surfaced in the in-keyboard emoji picker. Order matches the
 * stock Android emoji panel so users land on familiar tabs. `iconName`
 * names a vector drawable (resolved by [Resources.getIdentifier] at the
 * call site) rendered into the category tab — vectors render consistently
 * across Android versions where system emoji fonts don't.
 */
enum class EmojiCategory(val displayName: String, val iconName: String) {
    RECENTS("Frequently Used", "ic_emoji_cat_recents"),
    SMILEYS("Smileys & People", "ic_emoji_cat_smileys"),
    ANIMALS("Animals & Nature", "ic_emoji_cat_animals"),
    FOOD("Food & Drink", "ic_emoji_cat_food"),
    ACTIVITY("Activity", "ic_emoji_cat_activity"),
    TRAVEL("Travel & Places", "ic_emoji_cat_travel"),
    OBJECTS("Objects", "ic_emoji_cat_objects"),
    SYMBOLS("Symbols", "ic_emoji_cat_symbols"),
    FLAGS("Flags", "ic_emoji_cat_flags"),
}

/**
 * Curated emoji dataset. Mirrors the iOS dataset so both platforms surface
 * the same characters per category. Avoids the heaviest ZWJ sequences that
 * older Android system fonts won't render.
 */
object EmojiData {

    val smileys: List<String> = listOf(
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
    )

    val animals: List<String> = listOf(
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
    )

    val food: List<String> = listOf(
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
    )

    val activity: List<String> = listOf(
        "⚽️", "🏀", "🏈", "⚾️", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱",
        "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳️",
        "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷",
        "⛸", "🥌", "🎿", "⛷", "🏂", "🪂", "🏋️", "🤼", "🤸", "⛹️",
        "🤺", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗",
        "🚵", "🚴", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖", "🏵", "🎗",
        "🎫", "🎟", "🎪", "🤹", "🎭", "🩰", "🎨", "🎬", "🎤", "🎧",
        "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻",
        "🎲", "♟", "🎯", "🎳", "🎮", "🎰", "🧩",
    )

    val travel: List<String> = listOf(
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
    )

    val objects: List<String> = listOf(
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
    )

    val symbols: List<String> = listOf(
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
        "✅", "❌", "❎", "✔️", "☑️", "❇️", "✳️", "✴️", "❄️",
        "♻️", "⚜️", "🔱", "📛", "🔰", "⭕️", "❗️", "❓", "❕", "❔",
        "‼️", "⁉️", "〰️", "©️", "®️", "™️",
        "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️", "⬆️", "↕️", "↔️",
        "↩️", "↪️", "⤴️", "⤵️", "🔃", "🔄", "🔙", "🔚", "🔛", "🔜",
        "🔝",
        "🔢", "#️⃣", "*️⃣", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣",
        "7️⃣", "8️⃣", "9️⃣", "🔟", "🔠", "🔡", "🔣", "🔤",
    )

    val flags: List<String> = listOf(
        "🏳️", "🏴", "🏁", "🚩", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️",
        "🇺🇸", "🇬🇧", "🇨🇦", "🇦🇺", "🇩🇪", "🇫🇷", "🇮🇹", "🇪🇸", "🇵🇹", "🇳🇱",
        "🇧🇪", "🇨🇭", "🇦🇹", "🇸🇪", "🇳🇴", "🇩🇰", "🇫🇮", "🇮🇸", "🇮🇪", "🇵🇱",
        "🇨🇿", "🇸🇰", "🇭🇺", "🇷🇴", "🇧🇬", "🇬🇷", "🇹🇷", "🇷🇺", "🇺🇦", "🇧🇾",
        "🇪🇪", "🇱🇻", "🇱🇹", "🇯🇵", "🇰🇷", "🇨🇳", "🇹🇼", "🇭🇰", "🇸🇬", "🇲🇾",
        "🇹🇭", "🇻🇳", "🇵🇭", "🇮🇩", "🇮🇳", "🇵🇰", "🇧🇩", "🇱🇰", "🇳🇵", "🇦🇪",
        "🇸🇦", "🇮🇱", "🇮🇷", "🇮🇶", "🇪🇬", "🇿🇦", "🇲🇦", "🇰🇪", "🇳🇬", "🇪🇹",
        "🇲🇽", "🇧🇷", "🇦🇷", "🇨🇱", "🇨🇴", "🇵🇪", "🇻🇪", "🇨🇺", "🇩🇴", "🇵🇷",
        "🇳🇿", "🇪🇺", "🇺🇳",
    )

    fun emojis(category: EmojiCategory, context: Context): List<String> = when (category) {
        EmojiCategory.RECENTS -> RecentEmojis.all(context)
        EmojiCategory.SMILEYS -> smileys
        EmojiCategory.ANIMALS -> animals
        EmojiCategory.FOOD -> food
        EmojiCategory.ACTIVITY -> activity
        EmojiCategory.TRAVEL -> travel
        EmojiCategory.OBJECTS -> objects
        EmojiCategory.SYMBOLS -> symbols
        EmojiCategory.FLAGS -> flags
    }
}

/**
 * Persists the last ~30 picked emojis so the Recents tab feels useful
 * across IME sessions. Backed by SharedPreferences in the IME's package,
 * so each install of Echos has its own list.
 */
object RecentEmojis {

    private const val PREFS_NAME = "EchosKeyboardPrefs"
    private const val KEY_RECENTS = "recentEmojis"
    private const val MAX_COUNT = 30
    private const val SEPARATOR = "" // unit separator — never appears in emoji

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun all(context: Context): List<String> {
        val raw = prefs(context).getString(KEY_RECENTS, null) ?: return emptyList()
        if (raw.isEmpty()) return emptyList()
        return raw.split(SEPARATOR).filter { it.isNotEmpty() }
    }

    fun record(context: Context, emoji: String) {
        val current = all(context).toMutableList()
        current.removeAll { it == emoji }
        current.add(0, emoji)
        val trimmed = if (current.size > MAX_COUNT) current.take(MAX_COUNT) else current
        prefs(context).edit()
            .putString(KEY_RECENTS, trimmed.joinToString(SEPARATOR))
            .apply()
    }
}

/**
 * Fitzpatrick skin-tone modifiers (U+1F3FB–U+1F3FF). Applied as a suffix
 * to base emojis that opt into modification — see [toneableBases]. The
 * picker UI defaults to "no tone" (yellow) and the user can pick a global
 * default via long-press on any toneable emoji.
 *
 * v1 scope: single-person bases only. Multi-person ZWJ sequences (e.g.
 * 🤝, 👨‍❤️‍👨) are intentionally excluded since they need per-person tones.
 */
object SkinTone {

    /** All five modifiers in order from lightest (🏻) to darkest (🏿). */
    val modifiers: List<String> = listOf("🏻", "🏼", "🏽", "🏾", "🏿")

    /**
     * Bases that accept a tone modifier. Stored in normalized form (no
     * trailing U+FE0F variation selector) — call [normalize] before
     * looking up. Curated against `EmojiData.smileys` (gestures + body +
     * person blocks). Keep in sync if that data is extended.
     */
    private val toneableBases: Set<String> = setOf(
        // Gestures
        "👋", "🤚", "✋", "🖖", "👌", "🤏", "✌", "🤞", "🤟", "🤘",
        "🤙", "👈", "👉", "👆", "🖕", "👇", "☝", "👍", "👎", "✊",
        "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🙏",
        // Body parts
        "💪", "🦵", "🦶", "👂", "🦻", "👃",
        // People (single-person only — no ZWJ couples / families)
        "👶", "🧒", "👦", "👧", "🧑", "👨", "👩", "🧓", "👴", "👵",
        "🙍", "🙎", "🙅", "🙆", "💁", "🙋", "🧏", "🙇", "🤦", "🤷",
        "💆", "💇", "🚶", "🏃", "💃", "🕺", "🧖", "🧗",
        // Sports / activity poses (toneable per Unicode; multi-person
        // sports like 🤼 stay out)
        "🤺", "🏇", "⛷", "🏂", "🏌", "🏄", "🚣", "🏊", "⛹", "🏋",
        "🚴", "🤸", "🤾", "🧘", "🤽", "🚵",
    )

    private const val VARIATION_SELECTOR_16: Char = '\uFE0F'

    /**
     * Strips a trailing U+FE0F variation selector so emojis stored with
     * an emoji-presentation hint (e.g. "✌️" = U+270C U+FE0F) match the
     * bare codepoint form used in [toneableBases]. Tone modifiers replace
     * the variation selector at the end of the sequence — passing an
     * FE0F-suffixed base into the tone-application code would produce
     * mis-encoded output.
     */
    fun normalize(emoji: String): String =
        if (emoji.isNotEmpty() && emoji.last() == VARIATION_SELECTOR_16) {
            emoji.dropLast(1)
        } else {
            emoji
        }

    /** True if [emoji] (with or without FE0F) is in the toneable set. */
    fun isToneable(emoji: String): Boolean = toneableBases.contains(normalize(emoji))

    /**
     * The six variants (base + five tones) for a toneable emoji. Returns
     * null if [emoji] is not toneable so callers can skip the popup.
     */
    fun variantsFor(emoji: String): List<String>? {
        val base = normalize(emoji)
        if (!toneableBases.contains(base)) return null
        return buildList(modifiers.size + 1) {
            add(base)
            for (m in modifiers) add(base + m)
        }
    }

    /**
     * Returns [emoji] with [tone] appended, or [emoji] unchanged when:
     *   - [tone] is null (yellow / no tone), or
     *   - [emoji] is not in [toneableBases].
     */
    fun applyTone(emoji: String, tone: String?): String {
        if (tone == null) return emoji
        val base = normalize(emoji)
        if (!toneableBases.contains(base)) return emoji
        return base + tone
    }

    /**
     * Drops any trailing Fitzpatrick modifier so a toned commit can be
     * stored in [RecentEmojis] as its base — keeps the Recents list a
     * "what I use" list rather than a "what I use × tone" list, and lets
     * a tone-default change re-apply across all recents instantly.
     */
    fun stripTone(emoji: String): String {
        for (mod in modifiers) {
            if (emoji.endsWith(mod)) return emoji.dropLast(mod.length)
        }
        return emoji
    }
}

/**
 * Persists the user's chosen default skin tone — a single global value
 * applied to every toneable emoji in the picker, search results, and
 * commit path. `null` means no tone (yellow). Backed by the same
 * `EchosKeyboardPrefs` file as [RecentEmojis].
 */
object SkinTonePreference {

    private const val PREFS_NAME = "EchosKeyboardPrefs"
    private const val KEY = "skinTone"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** Returns the stored modifier string, or null for the yellow default. */
    fun get(context: Context): String? = prefs(context).getString(KEY, null)

    /** Persists [tone] as the new global default. Pass null to reset to yellow. */
    fun set(context: Context, tone: String?) {
        val editor = prefs(context).edit()
        if (tone == null) editor.remove(KEY) else editor.putString(KEY, tone)
        editor.apply()
    }
}
