# More practice sentences per word (Amirnet app)

The app asks "which word completes the sentence?" (4 options) and "type the missing word". Each word had only 1-3 sentences, so the learner remembered the answer from the sentence itself instead of thinking. Your job: write NEW, varied sentences so every question feels fresh.

## Input / output
- Input: `sents-src/in-<N>.json`, a list of words: `id`, `en` (the exact form that goes into the blank), `he` (meaning), `pos`, sometimes `group` (connector words: the logical relation) and `note`, and `existing` (sentences already in the app; do NOT reuse or paraphrase them).
- Output: `sents-src/part-<N>.json`, one object: `{ "<id>": [["English sentence with ___", "תרגום מלא לעברית"], ...], ... }`, covering every id in your input.
- Vocabulary words (id starts with `v:`): exactly **4** new sentences each. Connector words (other ids): exactly **3** new sentences each.

## Rules for every sentence
1. 8-20 words, natural English, correct grammar with `en` **exactly as written** in the blank (no -s/-ed/-ing, no other form). A two-part connector like `either... or` / `not only... but also` has one `___` per part, in order.
2. Exactly one `___` (or one per part). The word itself must not appear anywhere else in the sentence.
3. **Each sentence in a clearly different context** from the others and from `existing`: different topic (work, army, science, history, health, travel, school, family, sport, technology, nature, money, city life...), different subject, different sentence structure. Do not reuse key nouns from the existing sentences. No two sentences of the same word should feel like variations of one another.
4. The context must make this word the clear answer: a student who knows the word can tell it fits, and other common words of the same part of speech would sound wrong. For connector words, the logical relation (contrast, cause, result, condition, time, addition, example...) must be unambiguous from the two halves of the sentence, and the grammar after the blank must fit the connector's type (pos: c = followed by a full clause, a = links two sentences, usually with a comma after it, p = followed by a noun/-ing, i = followed by a verb, r = relative word, d = degree/frequency word).
5. Do not give the answer away with an obvious collocation repeated across sentences; vary what surrounds the blank.
6. Hebrew translation: natural, full sentence with the word filled in. Use ״ (U+05F4) instead of " inside Hebrew. No long dash (—) anywhere; use a comma or colon.
7. Clean, everyday-to-academic content suitable for Israeli students preparing for Amirnet.

## Check (required)
From the repo root run `node tools/build-sents.js --file part-<N>.json` and fix until it prints 0 errors (it checks counts, blanks, the word not repeated, length, Hebrew, long dashes, duplicates). Then re-read a sample of your sentences as a test-taker: is the word clearly the only good fit, and is each context really different? Fix weak ones.
