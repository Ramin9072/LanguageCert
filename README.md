# WordWise

Vocabulary quizzes built from **your own word list**. You write the words, their Persian meanings and an example sentence in a `.txt` file. WordWise turns that into exercises and reads the words aloud in an American or British accent.

There is **no AI, no API key and no database**. Everything runs in the browser, with one small optional server route that only downloads GitHub files for you. It deploys to Vercel as a normal Next.js project.

## Word file format

One word per line, parts separated by `|`:

```
# word | Persian meaning | example sentence
accomplish | انجام دادن، به انجام رساندن | She worked hard to accomplish her goals.
colour/color | رنگ | The colour of the sky changed at sunset.
look forward to | مشتاقانه منتظر بودن | I look forward to meeting you next week.
```

- The example sentence is optional, but only words with an example appear in fill-in-the-blank questions. The sentence must contain the word or a regular form of it (benefit → benefits, improve → improved).
- Write `colour/color` to accept both spellings when typing. The first one is shown.
- Lines starting with `#` or `//` are ignored. Tabs also work as separators.
- Save the file as **UTF-8** (in Notepad: Save As, Encoding: UTF-8), or the Persian letters will break. The app tells you if that happens.
- Up to 500 words and 200 KB per file. Problems are listed by line number after import. Valid lines are still imported.

The app has a **Download sample file** button and a **Try the sample words** button.

## Importing from GitHub

Instead of uploading a file from your computer you can paste the link of a `.txt` file in a **public** GitHub repository (or a gist) into the Import screen. The normal page link (`https://github.com/user/repo/blob/main/words.txt`) and the Raw link both work. After importing, the file shows an **Update from GitHub** button: after you change the file on GitHub, one click downloads it again and replaces that file's words.

The browser downloads the file directly. If your network blocks GitHub's file host, the app falls back to a small server route (`app/api/github`) that downloads it for you; it only contacts `raw.githubusercontent.com` and `gist.githubusercontent.com`. Private repositories are not supported.

## Exercises

| Exercise | What you do | How it is checked |
| --- | --- | --- |
| English to Persian | See a word (and hear it), pick the meaning from four choices. | Wrong choices are other meanings from your list. |
| Persian to English | See the meaning, type the English word. | Exact match, ignoring case and spaces. One or two wrong letters count as "Almost". |
| Fill in the blank | Your example sentence with the word removed. Type the missing word. | Must match the form used in the sentence. The base form gives "Almost, wrong form". |
| Listening | Hear the word, type how it is spelled. If the word is hard to understand, a tip button plays it inside your example sentence. | Same as Persian to English. |
| My mistakes | Pick the correct spelling among your own earlier wrong spellings of that word (plus typical misspellings if there are few). | Wrong spellings you type in the typing exercises are remembered automatically, so this exercise unlocks after your first typo. |

After each answer you see the result, the differing letters highlighted, the right answer, the word's meaning and example, and can play the audio. **Try again** and **Next exercise** are always available. Words you miss come up more often in later sessions, and "Words I missed" lets you practice only those.

## Navigation

Every screen has its own address (`#import`, `#words`, `#practice`), so the browser **Back** and **Forward** buttons work, including leaving a practice session or the results screen. The header also has a **← Back** button and the WordWise logo returns to the main screen.

Every file you upload is **added** to your saved list, so your words build up over time. Importing a file with the same name again replaces that file's words (handy after fixing a typo), and a word that is already in your list from another file is not added twice. You can remove one file's words, remove everything, or download the whole list as a backup. Only the first attempt at a question counts toward your progress. Progress and your word list are saved in the browser (`localStorage`), so they are per browser.

## Pronunciation

Pronunciation uses the browser's built-in speech synthesis (Web Speech API). It needs no internet connection for local voices and no API.

- The **US / UK** switch in the header chooses the accent.
- The voices come from your device. Windows, macOS, iOS and Android include English voices; for the best quality use Edge, Chrome or Safari. If a device has no British or American voice installed, the app uses the default English voice and says so in the practice settings. You can add voices in your system's language settings.
- Some browsers (for example certain Linux builds) have no speech support. Speech buttons and listening exercises are hidden or disabled there.

## Run locally

Requires Node.js 18.18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Other scripts: `npm run build`, `npm start`, `npm run typecheck`.

## Deploy to Vercel

1. Push this folder to GitHub, GitLab or Bitbucket.
2. In Vercel choose **Add New… → Project** and import the repository. The Next.js preset is detected automatically.
3. Click **Deploy**. No environment variables are needed.

Or with the CLI: `npm i -g vercel`, then `vercel`, then `vercel --prod`.

## Project layout

| Path | Purpose |
| --- | --- |
| `lib/parse.ts` | Reads the word file, validates every line, builds the fill-in-the-blank sentences. |
| `lib/practice.ts` | Chooses words (weak words more often) and builds the questions. |
| `lib/check.ts` | Answer checking and the letter-by-letter difference display. |
| `lib/speech.ts` | Voice selection for the US and UK accents. |
| `components/` | Import, Words and Practice screens. |
