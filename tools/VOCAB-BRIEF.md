# How to write the vocabulary data (Amirnet app)

The app teaches English vocabulary to Israeli students preparing for the Amirnet test, Duolingo-style.
For every English word in your chunk file you write one row of learning data, in your own words.

## Copyright
The word list comes from a Quizlet set. Take only the English words. **Write every Hebrew meaning, group, level, sentence and translation yourself.** Do not look up or copy Quizlet or any flashcard site.

## Output
A JSON array in `vocab-src/part-<N>.json`, one row per word, same order as `vocab-src/chunk-<N>.txt`:

```json
["word", "פירוש בעברית", "group", "pos", level, "English sentence with ___ .", "תרגום המשפט לעברית.", "הערה (אופציונלי)"]
```

1. **word**: exactly as in the chunk file (same spelling, same case). Every word in the chunk, no extras.
2. **Hebrew meaning**: short. 1-3 meanings separated by ", ", up to about 30 characters. Verbs in infinitive (לקצר, להשיג). Add a short clarification in parentheses only when needed: "base" → "בסיס (גם: לבסס)". Pick the most common meaning in academic/test texts first.
3. **group**: one key from `vocab-src/cats.json` (read the `tip` of each group). Choose by the word's main meaning. Abstract words go where a learner would look for them (e.g. "consequence" (result of actions) → vact; "anxiety" → vfeel; "verdict" → vsoc; "abundant" → vqty; "erroneous" → vtrue or vmind; "vague" → vqual). Do not dump many words in vqual; it is only for descriptive adjectives that fit nowhere else.
4. **pos**: n (noun), v (verb), j (adjective), r (adverb), x (anything else: phrase, preposition, conjunction). Phrases like "according to", "take off", "give rise to": use the pos of how the phrase acts (verb phrase → v, prepositional phrase → x).
5. **level**: 1 = basic word most Israeli high-school graduates know (bread, buy, child, kitchen, begin). 2 = common academic word in reading texts (achieve, consequence, significant, approach). 3 = hard or rare (bamboozle, saturnine, apposite, commiserate, hitherto). Aim for roughly 30% / 45% / 25%.
6. **sentence**: one natural English sentence, 8-18 words, with exactly one `___` that is replaced by the word **exactly as written in field 1** (no -s, -ed, -ing, no other form; for a phrase the blank is the whole phrase). Grammar must be correct with that exact form. The context must make this word the clear answer, so a student can guess it from the sentence, and other words of the same part of speech would sound wrong. The word itself must not appear elsewhere in the sentence. Topics: everyday life, school, army, science, history, work. Clean content.
7. **translation**: natural Hebrew translation of the full sentence with the word filled in.
8. **note** (optional, omit the field when not useful): one short Hebrew tip, up to ~100 characters, only when it really helps: a confusing pair (affect/effect, ensure/insure), a fixed preposition (rely on), irregular plural, another common meaning, a word family hint (deceit → deceive). Most rows have no note.

Hebrew style: plain, everyday Hebrew. Use ״ (gershayim, U+05F4) instead of " inside Hebrew (חו״ל, צה״ל) so the JSON stays clean. No long dash (—); use a comma or colon.

## Check
Run from the repo root: `node tools/build-vocab.js --file part-<N>.json`
It must print 0 errors (it checks every field, the single `___`, that the word is not in its own sentence, and that the file covers exactly the words in the chunk). Fix and re-run until clean.

Write the file in a few batches if it is long (e.g. build the array in parts, then join), but the final file must be one valid JSON array. Do not touch any other file. Do not commit.
