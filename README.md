# Boxing Camp

A 12-week Bivol-style boxing plan that lives on your phone: what to train today, a round timer that tells you what to throw each round, and a weekly benchmark log.

**Live site:** https://daidangdev32.github.io/boxing-plan/

## What's in it

- **Today.** The current week, this week's round and rest lengths on a gym-style clock, the next session up, and a checklist for the week's four sessions (A, B, bag day, C).
- **Plan.** Every week of the camp. Pick a week to see the home sessions round by round, bag day as a test day or a full session, the deload changes in weeks 4 and 8, and week 12's fight simulation.
- **Timer.** Runs a whole session: warm-up, rounds with that round's drill on screen, rests that show what's next, conditioning and core. It's silent, so music from another app keeps playing: the screen flashes red when a round starts, amber 10 seconds before the end of a round and blue when rest begins, and Android phones vibrate too. On test day it records your push-ups, rope time, burpees and hard rounds as you go. The screen stays on while it runs, where the browser allows it.
- **Log.** Weekly benchmarks with a chart for each test, best results in gold, *Copy for Notes* in the same format as the Apple Notes tracker, CSV export, and backup and restore.
- **Drills.** Punch numbers, Bivol footwork principles and drills, every term the plan uses, and an optional morning routine.

## The plan in brief

| Weeks | Phase | Round | Rest |
| --- | --- | --- | --- |
| 1–2 | Foundation | 2:00 | 1:00 |
| 3–4 | Foundation | 2:30 | 1:00 |
| 5–8 | Build | 3:00 | 0:45 |
| 9–12 | Sharpen | 3:00 | 0:30 |

- Max 4 sessions a week: 3 home sessions of 30 minutes (A jab & range, B counter power, C pace & defense) and 1 bag day of 60 minutes at the gym.
- Weeks 4 and 8 are deloads: drop one round and halve the conditioning.
- Benchmarks every week on bag day: max push-ups, jump rope unbroken, burpees in 3 minutes, and the hard rounds test (2-minute bag rounds at a hard jab-led pace, counting the rounds you finish before your form breaks, up to 8). The 3 km run goes on a rest day, and bodyweight in the morning.
- Week 12 ends with a fight simulation: 6 × 3-minute jab-led rounds.

## Using it

Open the site on your phone and add it to your home screen (Share → Add to Home Screen on iPhone). It works offline after the first visit, which helps in a gym with bad signal.

Play your own music while you train: the timer never makes a sound. Keep the phone where you can see it, since round changes show as screen flashes. The timer keeps time against the clock, so it stays accurate if the phone dims or you switch apps.

Everything you log stays in your browser's local storage on that device. Use **Download backup** and **Restore backup** in the Log to move it between devices, or **Copy all for Notes** to keep a copy in Apple Notes.

## Run it locally

There is no build step. Serve the folder with any static file server:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Files

| Path | What it does |
| --- | --- |
| `index.html` | The page and its five views |
| `css/style.css` | All styles, with light and dark themes |
| `js/plan.js` | The plan data, plus builders that turn a week and session into a readable plan and a timer sequence |
| `js/timer.js` | The round timer engine |
| `js/signal.js` | Silent timer signals: screen flashes and vibration |
| `js/app.js` | Views, the log, the chart and saved state |
| `sw.js` | Offline cache (network first, so updates show straight away) |
| `fonts/` | Sofia Sans and Sofia Sans Extra Condensed, self-hosted |

## Credits

Fonts: [Sofia Sans](https://github.com/lettersoup/Sofia-Sans) by Lettersoup, under the SIL Open Font License 1.1 (see `fonts/OFL.txt`).
