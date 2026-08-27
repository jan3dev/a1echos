# Keyboard LM distillation prompts (M1.5)

Teacher: **DeepSeek-V4-Flash** via OpenRouter (`deepseek/deepseek-v4-flash-0731`, MIT weights).
Student: **EleutherAI/pythia-31m**, continue-pretrained as a causal LM.

Generator (stdlib only, resumes by appending):

```
python3 scripts/keyboard-lm/distill-generate.py --self-test
python3 scripts/keyboard-lm/distill-generate.py --dry-run 4
python3 scripts/keyboard-lm/distill-generate.py \
    --out data/keyboard-lm/synthetic.jsonl --target-tokens 250000000
python3 scripts/keyboard-lm/distill-generate.py \
    --out data/keyboard-lm/synthetic.jsonl --only literal --add-tokens 3000000
```

Requires `OPENROUTER_API_KEY`. Restrict slices with `--only literal homophone`.
`--target-tokens` is a cap on the whole file (or on `--only` tasks). `--add-tokens` appends that many new tokens this run.
Drop `--rejects data/keyboard-lm/synthetic.rejects.jsonl` to debug keep-rate.

The on-device model is not a chatbot and not a spellchecker. At
inference `LmReranker` scores `P(" " + word | leftContext)` with a
128-token budget (`bench.py` / `LmReranker.swift`). Training data must
therefore be **plain typing-register English**, not instruction pairs,
not "fix this typo" examples, and not chat-templated assistant turns.

## 0. Do not generate the whole 1B from the teacher

A 31M model overfits teacher cadence long before it learns English.
Gboard's production recipe (arXiv:2404.04360) and `docs/keyboard-lm-roadmap.md`
are the same idea: **filter real text + a smaller synthetic slice**.

Target mix for **~1.2B tokens after filtering** (1B is the floor):

| Slice                         | Tokens | How                                                          |
| ----------------------------- | ------ | ------------------------------------------------------------ |
| WildChat-1M **user turns only** | 250M | `allenai/WildChat-1M`, drop assistant, keep English          |
| SODA                          | 250M   | `allenai/soda`, flatten to speaker turns                     |
| Register-filtered FineWeb/C4  | 350M   | `extract-fineweb.py` on `sample-10BT` (do not download FineWeb); **not** FineWeb-Edu |
| DeepSeek-V4-Flash synthetic   | 250M   | prompts in this file; generate ~400M, keep ~250M             |
| NUS SMS + Tatoeba (en)        | 50M    | `extract-sms-tatoeba.py`; upsample SMS; hold out 5k SMS for eval |
| Targeted confusable/homophone | 50M    | oversample both sides of I'll/Ill, its/it's, there/their/…   |

```
python3 scripts/keyboard-lm/extract-sms-tatoeba.py --self-test
python3 scripts/keyboard-lm/extract-sms-tatoeba.py --dry-run 8
python3 scripts/keyboard-lm/extract-sms-tatoeba.py \
    --sms ~/Downloads/smsCorpus_en_2015.03.09_all.json \
    --tatoeba ~/Downloads/eng_sentences.tsv \
    --tatoeba-cc0 ~/Downloads/eng_sentences_CC0.tsv \
    --out data/keyboard-lm/sms-tatoeba.jsonl --target-tokens 50000000
```

Put the dumps in `data/keyboard-lm/raw/` (or `~/Downloads`) to omit the path flags. CC0 sentences are tagged and not duplicated; `--cc0-only` drops the CC BY remainder. Held-out SMS is `data/keyboard-lm/sms-eval.txt` (`bench.py --corpus`). Continuation seeds: `--openings data/keyboard-lm/openings.txt`.

If you insist on a teacher-heavy run, cap DeepSeek at **≤40%**. Past
that you are paying to clone one model's style, not to cover the
keyboard distribution.

**Do not logit-distill DeepSeek into pythia-31m.** Tokenizers differ
(DeepSeek BPE vs GPT-NeoX 50k). Sequence-level distillation — teacher
writes text, student does next-token CE — is the only cheap, correct
method for M1.5. Save on-policy / KL distillation for M2, when the
student has its own 16k vocab and a same-tokenizer teacher.

**Do not put typos in the LM corpus.** The spatial model in
`decoder.js` already owns fat-finger errors. The LM must score the
*intended* word. Training on "teh" → "the" teaches the wrong
objective for this reranker.

## 1. Training format (no labels)

One JSONL, one document per line. The only field the trainer reads is
`text`. Everything else is mix/filter metadata and is stripped before
packing.

```json
{"text": "hey are you free later", "source": "synthetic-sms", "slice": "register-casual", "teacher": "deepseek/deepseek-v4-flash-0731"}
{"text": "Yeah I'll be there in ten", "source": "synthetic-sms", "slice": "confusable-contract", "teacher": "deepseek/deepseek-v4-flash-0731"}
{"text": "the cat cleaned its paws", "source": "synthetic-literal", "slice": "confusable-literal", "teacher": "deepseek/deepseek-v4-flash-0731"}
```

Pack at train time: join documents with pythia's EOS
(`<|endoftext|>`) into 512-token packs (inference only uses 128; 512
is enough margin and wastes less than 2048). Standard causal LM loss.
No chat template, no BOS-per-turn, no loss mask, no preference pairs.

Optional second-stage file, **only if** you later want a tiny DPO/cDPO
head on confusables — not required for M1.5 and **not** the 1B corpus:

```json
{"prompt": "Yeah. ", "chosen": "I'll", "rejected": "Ill", "slice": "confusable-contract"}
```

That is the same shape as `bench/cases.json` pairwise items. Keep it
to tens of thousands of pairs, not billions of tokens.

### What "labeled" would mean, and why you don't need it

| Format                         | Use here? | Why                                              |
| ------------------------------ | --------- | ------------------------------------------------ |
| `{text}` causal LM             | **yes**   | matches `scores(leftContext, word)`              |
| `{instruction, output}` SFT    | no        | pythia-31m has no chat template; inference isn't instruction-following |
| `{typo, correction}`           | no        | wrong objective; spatial model already does this |
| `{leftContext, gold, distractors}` | eval / optional DPO only | the golden set already lives in `bench/cases.json` |
| Teacher logits / top-k soft labels | no for M1.5 | vocab mismatch                                   |

## 2. Teacher call settings

Use the **non-thinking** Flash checkpoint. Thinking tokens are wasted
money and leak "let me reason" into the corpus.

```
base_url:     https://openrouter.ai/api/v1
model:        deepseek/deepseek-v4-flash-0731
api_key_env:  OPENROUTER_API_KEY
temperature:  0.95
top_p:        0.92
max_tokens:   900
json_object:  true
n:            1
```

Many small diverse calls beat few huge ones. Cache the system prompt
(Flash cache-hit input is cheap). Reject and retry any response that
fails the parse/filter in §5.

Cost ballpark at published Flash prices (~$0.14/M in, $0.28/M out):
generate 400M output tokens to keep 250M → roughly **$150–250**
including prompt tokens and retries. A full 1B-from-teacher run is
~$500–800 and is the worse dataset.

Self-host the MIT weights if you want a cleaner paper trail than the
API ToS. DeepSeek-R1's API note explicitly allowed distillation;
Flash weights are MIT. Still do not mix OpenAI / Claude / Llama
outputs into this corpus (roadmap license bar).

## 3. Shared system prompt

Use this system message on **every** generation call. Do not add
"you are a helpful assistant".

```
You write realistic phone-keyboard English for training a tiny
on-device language model that reranks autocorrect candidates.

You are simulating a human typing on a phone. You are not an
assistant, not a narrator, and not a writer.

Hard rules:
- Output valid JSON only. No markdown, no code fences, no preamble.
- Every message is something a person would actually type into iMessage,
  WhatsApp, SMS, Slack DM, or a notes app.
- English only.
- Length: 2 to 40 words per message. Fragments are fine. One thought
  per message.
- Contractions are normal (I'll, don't, it's, you're, they're, gonna,
  wanna). Use them when a person would.
- Casual register is the default: yeah, ok, tbh, lol, ngl, omw, np,
  haha, idk, brb. Not every message needs slang.
- Mixed capitalization is fine (all-lowercase is common; sentence case
  is fine; ALL CAPS only for a shout).
- Light punctuation. Many messages have none. Never use ; em-dashes,
  or nested quotes.
- No lists, no bullet points, no numbered steps, no headings.
- No hashtags, no URLs, no emails, no phone numbers, no @handles.
- No real names of living private people. Use first names only
  (Sam, Priya, Jae, Omar, Liz).
- No medical/legal/financial advice voice. No news-anchor prose.
- No "As an AI", no "Sure!", no "Here are", no "I hope this helps".
- No stage directions, no *actions*, no emoji walls. At most one
  emoji, and only if that person would send it.
- Never invent typos (teh, recieve, definately). Type the intended
  words correctly. Informal spellings that are real words are fine
  (gonna, wanna, 'cause, til, tho, u, ur — use u/ur sparingly).
- Never mention that you are generating training data.
```

## 4. Task prompts

Each user prompt is a template. Fill `{…}` from the seed banks in §6.
Ask for 8–16 messages per call so one bad sample doesn't waste the
whole completion.

The required JSON shape for **all** task prompts:

```json
{
  "messages": [
    {"speaker": "a", "text": "…"},
    {"speaker": "b", "text": "…"}
  ]
}
```

Flatten to training rows by taking each `text` (and, separately,
concatenating a thread with newlines to make a 40–120 token context
document — that matches how `leftContext` looks at inference).

### 4.1 SMS / iMessage threads  —  `slice: register-casual`  (~35% of synthetic)

```
Write {n} text messages between two people.

Relationship: {relationship}
Situation: {situation}
Tone: {tone}
Setting: {setting}
Speaker A: {persona_a}
Speaker B: {persona_b}

Constraints:
- Alternate speakers. A starts.
- This is a real back-and-forth, not a scene description.
- At least 3 messages should be under 8 words.
- At least 1 message should be a single-word reply (ok, yeah, lol, np, wait, omw).
- Do not resolve the situation neatly. People leave things hanging.

Return {"messages":[{"speaker":"a"|"b","text":"..."}]}.
```

### 4.2 Seeded continuation  —  `slice: register-casual`  (~15%)

Seed `{opening}` from real WildChat-user / NUS-SMS / Tatoeba lines
**that are not in the train shard**. This anchors the teacher to real
openings instead of its own prior.

```
Continue this text thread. The first message is already written and
must be copied verbatim as speaker "a".

Opening: {opening}

Then write {n} more messages (mix of a and b) that a normal person
would send next. Same hard rules as the system prompt.

Relationship: {relationship}
Tone: {tone}

Return {"messages":[...]} including the opening as the first item.
```

### 4.3 Sentence-initial contractions  —  `slice: confusable-contract`  (~10%)

Stock pythia-31m prefers `I'll/It's/I'd/Let's` at sentence start in
some cases and is still weak. We need many *correct* contraction
openings so the reranker keeps beating `Ill/Its/Id/Lets` when the
next word is a verb.

```
Write {n} standalone phone messages that START with the contraction
"{anchor}".

Allowed anchors (pick exactly one per call): I'll | I'd | I've | I'm |
It's | That's | What's | Let's | Don't | Can't | Won't | You're |
They're | He's | She's | We'll | They'll | Who's | There's | Here's

Each message:
- Starts with that exact contraction (capitalized or not — mix both).
- Continues with a natural verb phrase a person would type.
- Is 4 to 18 words.
- Does NOT use the lookalike word (I'll ≠ Ill, It's ≠ Its, Let's ≠ Lets,
  I'd ≠ Id, You're ≠ Your, They're ≠ Their/There, Who's ≠ Whose).

Examples of the shape we want (do not copy):
- "I'll be there in ten"
- "it's pouring here, can we push it"
- "lets" is FORBIDDEN in this task; use "Let's grab food"

Return {"messages":[{"speaker":"a","text":"..."}]}.
```

### 4.4 Literal lookalikes  —  `slice: confusable-literal`  (~10%)

This is the slice stock pythia fails (~0% on the bench). Casual-chat
teachers almost never write `Ill`, `Its`, `Id`, `Lets` as the real
words. **Force them.** Without this slice, fine-tuning will make
`dont-flip` / literal worse.

```
Write {n} standalone messages that use the LITERAL word "{anchor}",
never the contracted lookalike.

Anchor and meaning (pick one per call):
- Ill     = sick / unwell / harmful   (never I'll)
- Its     = possessive of it          (never it's)
- Id      = identification document   (never I'd)
- Lets    = third-person of let       (never let's)
- Were    = past of be                (never we're)
- Shell   = seashell / husk / company nickname only if clearly noun
- Hell    = the place / intensifier only in "what the hell"
- Well    = the adverb / the noun     (never we'll)
- Were    already listed
- Cant    = do not use (too rare; skip)
- Wont    = do not use (too rare; skip)

Each message:
- Uses the literal word once, in a context that makes the contracted
  reading wrong.
- Everyday wording, not textbook grammar drills.
- 6 to 22 words.
- Mix sentence-medial and (for Ill / Its / Id) sentence-initial
  capitalized forms, because the keyboard capitalizes the first word.

Good shapes (do not copy):
- "the doctor said three more Ill patients came in"
- "Ward 4 is full of Ill kids today"
- "the cat cleaned its paws on the rug"
- "every dog has its day I guess"
- "please show your Id at the door"
- "this is my Id from last year"
- "a good coach never Lets that slide"
- "the lease never Lets you sublet"

Return {"messages":[{"speaker":"a","text":"..."}]}.
```

### 4.5 Homophones  —  `slice: homophone`  (~12%)

```
Write {n} standalone messages that correctly use "{anchor}" and would
become wrong if replaced by any of: {distractors}.

Pairs (one per call):
- there    vs their, they're
- their    vs there, they're
- they're  vs their, there
- your     vs you're
- you're   vs your
- to       vs too, two
- too      vs to, two
- two      vs to, too
- than     vs then
- then     vs than
- whether  vs weather
- weather  vs whether
- lose     vs loose
- loose    vs lose
- affect   vs effect
- effect   vs affect
- here     vs hear
- hear     vs here
- where    vs were
- were     vs where
- right    vs write
- write    vs right
- accept   vs except
- except   vs accept
- it's     vs its     (mid-sentence, not sentence-initial)
- its      vs it's    (mid-sentence)

Each message 5 to 20 words, phone-typed, not a grammar worksheet.
Do not put the distractor words in the same message.

Good shapes:
- "I parked over there by the red car"
- "they lost their keys again"
- "don't wait they're already here"
- "is this your jacket"
- "hurry you're going to miss it"
- "give me two minutes"
- "this shirt is too loose"
- "I don't know whether to go"

Return {"messages":[{"speaker":"a","text":"..."}]}.
```

### 4.6 Near-ties / rare-correct  —  `slice: near-tie` + `dont-flip`  (~8%)

The reranker must not "correct" an uncommon but intended word into a
common neighbor (`satay`↛`satan`, `form`↛`from`).

```
Write {n} messages that naturally contain the word "{rare_word}".
The message should make that word the only sensible choice.

Rare-word bank (one per call):
satay, matcha, gnocchi, pho, adobo, biryani, halloumi, gochujang,
kimchi, naan, roti, injera, tamale, pozole, ceviche,
ikea, costco, trader, chipotle, lyft, venmo, zelle, cashapp,
figma, notion, jira, linear, slack, zoom,
akita, shiba, corgi, vizsla,
ibuprofen, melatonin, electrolyte, humidifier,
itinerary, receipt, voucher, boarding,
form, item, which, whom, whomst (avoid),
quinoa, acai, matcha,
Nissan, Ikea, Lexus (brand, capitalized),
Oaxaca, Aarhus, Qatar, Qataris,
wifi, emoji, screenshot, voicemail, earbuds, charger, dongle,
pilates, spin, peloton, pickleball,
sikh, iftar, seder, diwali, eid, hanukkah,
niece, nephew, nana, pops, babcia, abuela

Do not replace the word with a simpler synonym. Do not define it.
Just use it the way a person texting would.

Return {"messages":[{"speaker":"a","text":"..."}]}.
```

### 4.7 Notes, lists-as-prose, self  —  `slice: register-casual`  (~5%)

```
Write {n} notes a person typed to themselves on a phone.

Kind: {note_kind}
  (reminder | shopping | packing | packing-for-trip | meeting-note |
   password-hint-without-secrets | gift-idea | rant | half-thought)

Rules:
- First person or fragment. No "Dear diary".
- Shopping / packing: write as a single running message, not a list
  ("milk eggs bread and that oat milk she likes").
- No passwords, no account numbers, no addresses with house numbers.

Return {"messages":[{"speaker":"a","text":"..."}]}.
```

### 4.8 Group chat  —  `slice: register-casual`  (~5%)

```
Write {n} messages in a 3-person group chat.

People: {persona_a}, {persona_b}, {persona_c}
Situation: {situation}
Tone: {tone}

Speakers are "a", "b", "c". People talk over each other. At least
two messages are reactions (lol, wait what, same, +1, omg). No
one writes a paragraph.

Return {"messages":[{"speaker":"a"|"b"|"c","text":"..."}]}.
```

## 5. Filters (programmatic, not another LLM if you can avoid it)

Drop a message if any of these fire. Target keep-rate on synthetic:
**55–70%**. If you are keeping >85%, the teacher is being too polite
and the prompts are not biting.

Reject:

- parse failure / missing `messages`
- any `text` > 80 words or < 2 words (except the allowed one-word
  replies: `ok yeah lol np wait omw haha yes no nah yup k kk ty tysm
  lmao omg idk brb gtg nvm`)
- markdown, `http`, `www.`, `@`, `#`, `<`, `>`, `*`, `_italic_`,
  numbered lists, emoji count > 2
- assistant residue: `/^(sure|of course|here(?:'s| are)|as an ai|i hope|let me know if)/i`
- quotes wrapping the whole message
- identical to another message after lowercasing + whitespace crush
  (Exact + 8-gram MinHash, threshold 0.85, across the whole 1.2B mix)
- language-id not English (fastText lid.176, p < 0.8)
- PII regex: emails, `+?d{8,}`, SSN-like, street addresses
- contains a banned typo we asked it not to make (`teh`, `recieve`,
  `definately`, `seperate`, `occured`, `untill`, `becuase`)
- for `confusable-literal` calls: the contracted lookalike appears
- for `confusable-contract` calls: the literal lookalike appears
- for homophone calls: any listed distractor appears

Optional cheap register classifier (this is the Gboard trick, and it
matters more than more DeepSeek tokens):

- Positives: SODA turns, WildChat **user** turns, NUS SMS, Tatoeba
  short sentences, accepted synthetic
- Negatives: random FineWeb, Wikipedia, arXiv, GitHub, T&Cs, news
- Binary classifier (even a linear bag-of-ngrams works). Keep web
  documents with p(messaging) > 0.7. This is how you get the 350M
  FineWeb/C4 slice; do not skip it.

FineWeb is ~15–18T tokens. Stream the official 10B-token sample, train
the classifier on the local WildChat/SODA JSONL, and stop at 350M kept
tokens. Never download the full dump. Never use FineWeb-Edu (its filter
strips the casual register we want).

```
python3 scripts/keyboard-lm/extract-fineweb.py --self-test
python3 scripts/keyboard-lm/extract-fineweb.py --dry-run 20
python3 scripts/keyboard-lm/extract-fineweb.py \
    --out data/keyboard-lm/fineweb-register.jsonl --target-tokens 350000000
# later: raise the cap; the existing JSONL is appended, not rewritten
python3 scripts/keyboard-lm/extract-fineweb.py \
    --out data/keyboard-lm/fineweb-register.jsonl --target-tokens 550000000
```

If `sample-10BT` undershoots 350M kept tokens, re-run with
`--subset sample-100BT` (still streaming, still not the full dataset).

## 6. Seed banks

Rotate these independently per call. The diversity is in the seeds,
not in rewriting the system prompt.

### Relationships

```
partners living together
partners long-distance
new dating, third week
exes being civil
best friends since school
coworkers on Slack DM
manager and report, informal
siblings
parent and adult kid
roommates
neighbors
teammates on a rec league
group-trip planning
customer and a freelancer they already know
two dads coordinating pickup
```

### Situations

```
running late
changing dinner plans
split a bill
lost a charger
airport gate change
kid is sick, need coverage
"are you free Thursday"
movie / show rec
"can you pick up milk"
hungover check-in
work is on fire, need 10 minutes
birthday surprise logistics
dog to the vet
apartment leak
"did you see my last text"
after a small fight
planning a hike
someone cancelled
ride share coordination
"what's the wifi"
```

### Tones

```
dry
warm
annoyed-but-trying
sleepy
rushed
playful
anxious
deadpan
enthusiastic
passive-aggressive-light
apologetic
neutral-logistics
```

### Settings

```
iMessage
WhatsApp
SMS
Slack DM
Instagram DM
Notes app
Messenger
```

### Personas (sample; expand to 200+)

Keep each persona to `{name}, {age-band}, {city-type}, {quirk}`.

```
Sam, 20s, college town, types all lowercase
Priya, 30s, big city, uses full stops
Jae, 20s, suburbs, heavy slang
Omar, 40s, small city, short logistics texts
Liz, 50s, rural, slightly formal but still phone-y
Maya, 30s, big city, voice-to-text energy (long clauses, few commas)
Chris, 20s, campus, memes but not cringe
Diego, 30s, bilingual leftover (english only, occasional loanword)
Aisha, 40s, corporate-casual
Ben, teens, max abbreviations
Ruth, 60s, careful punctuation, warm
Nikhil, 30s, startup, dry
```

### Note kinds

```
reminder
shopping
packing-for-trip
meeting-note
gift-idea
rant
half-thought
```

## 7. Flattening to documents

From each accepted teacher response produce **two** kinds of
`text` rows (both go in the same JSONL):

1. **Turn rows** — each `messages[i].text` alone. Teaches word
   distributions and sentence-initial forms. ~70% of synthetic tokens.
2. **Thread rows** — join 3–8 consecutive turns with a single
   newline. This is what `leftContext` looks like when someone has
   been typing for a few messages. Cap at ~80 words. ~30% of
   synthetic tokens.

Do not join with `User:` / `Assistant:` labels. The keyboard never
sees those.

Real corpora (WildChat / SODA / SMS): same flattening. WildChat:
**user turns only**. SODA: drop the narrative wrappers, keep the
dialogue utterances.

## 8. Train recipe (so the file is complete)

```
model:        EleutherAI/pythia-31m
objective:    causal LM, full-parameter continue-pretrain
seq_len:      512
packing:      EOS-separated
tokens:       1.0–1.2B (1–2 epochs, whichever first)
batch:        ~0.5–1M tokens
lr:           1e-4 cosine, 2–3% warmup, min 1e-5
wd:           0.1
precision:    bf16
eval every:   50M tokens on
              - bench.py --baseline EleutherAI/pythia-31m
              - held-out NUS SMS perplexity
              - typing-eval.txt ppl
early stop:   dont-flip e2e drops OR ppl on SMS rises while
              confusable-literal is still < 40%
```

Ship gate is already written:

```
python3 scripts/keyboard-lm/bench.py \
  --model /path/to/ft \
  --baseline EleutherAI/pythia-31m \
  --strict
```

A fine-tune is a success when pairwise and `confusable-literal` move
up and `dont-flip` does not drop. Then `build-spike-model.sh` against
the HF checkpoint (same tokenizer → same GGUF path), bump
`ModelRegistry`.

## 9. Eval hygiene

- Never train on `bench/cases.json` gold strings as isolated
  documents. If they appear inside a longer thread, that is fine.
- Hold out 5k NUS SMS lines before upsampling the rest.
- Do not evaluate "does the teacher like this sentence". The teacher
  is not the product. `bench.py` is.

## 10. Suggested call mix for the 400M generated / 250M kept

| Prompt                         | Share of calls | Why                                      |
| ------------------------------ | -------------- | ---------------------------------------- |
| 4.1 SMS threads                | 30%            | bulk register                            |
| 4.2 Seeded continuation        | 15%            | stay close to real openings              |
| 4.3 Sentence-initial contract  | 12%            | I'll/It's/Let's at t=0                   |
| 4.4 Literal lookalikes         | 12%            | the stock-model failure mode             |
| 4.5 Homophones                 | 15%            | there/their/your/you're/…                |
| 4.6 Near-tie / dont-flip       | 8%             | satay, form, rare words                  |
| 4.7 Notes-to-self              | 4%             | different left-context shape             |
| 4.8 Group chat                 | 4%             | overlapping short turns                  |

If `confusable-literal` is still weak at 200M synthetic, double 4.4
and cut 4.1. That slice is the whole reason M1.5 is worth doing.
