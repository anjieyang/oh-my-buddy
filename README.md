# oh-my-buddy

Supercharge your Claude Code buddy with personality-driven reactions, XP progression, achievements, a commit garden, and chaos-fueled rage meters.

Each of the 18 buddy species feels uniquely alive — your buddy's real CHAOS, SNARK, WISDOM, PATIENCE, and DEBUGGING stats drive every reaction.

## Install

```
/plugin marketplace add anjieyang/oh-my-buddy
/plugin install oh-my-buddy@oh-my-buddy
```

That's it. Your buddy is auto-detected on first use.

## What happens

**Your buddy reacts to everything you do:**

- **Test failures** build a rage meter with escalating ASCII chaos
- **Test passes** earn XP and relief animations
- **Commits** grow a garden and award XP
- **Destructive git ops** trigger skull art and "bold move" callouts
- **Editing the same file 5+ times** gets you roasted
- **Achievements** unlock with celebratory banners

**Your buddy's stats shape the experience:**

| Stat | What it does |
|---|---|
| CHAOS | How often your buddy speaks up (and whether it says unhinged things) |
| SNARK | Tone spectrum: encouraging, neutral, or savage |
| WISDOM | Chance of dropping actual coding insights |
| PATIENCE | How fast the rage meter fills (patient = slow, impatient = explosive) |
| DEBUGGING | Chance of spotting error patterns across your session |

**Progression system:**

- XP from commits (+20), bug fixes (+30), test passes (+10), file creation (+5)
- 5 evolution stages: Egg → Baby → Teen → Adult → Legendary
- Persistent streaks, garden, and 12 unlockable achievements

## 18 Species

duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk

Your buddy is deterministically assigned to your account — same account always gets the same buddy.

## Achievements

| Badge | Name | How to unlock |
|---|---|---|
| 🩸 | First Blood | First bug fix commit |
| 🌱 | Gardener | Create 10 files |
| 🦉 | Night Owl | Code after midnight 5 times |
| 🔥 | On Fire | 7-day streak |
| 💯 | Centurion | 100 commits |
| 😤 | Rage Quit | Hit 100% rage meter |
| 🧘 | Zen Master | Full session with zero errors |
| ⚡ | Speed Demon | 10 commits in one session |
| 💀 | Daredevil | 5 destructive git ops |
| 🌳 | Old Growth | Garden at max capacity |
| 👑 | Legendary | Reach level 51 |
| 🍳 | Hatcher | Level up for the first time |

## How it works

oh-my-buddy uses Claude Code's hook system. On every tool use, it:

1. Updates your stats (XP, rage, streaks, garden)
2. Checks your buddy's personality stats
3. Builds a personality-flavored context string
4. Injects it into Claude's conversation via `additionalContext`

Claude naturally voices your buddy based on the personality context. A high-SNARK goose roasts you. A high-WISDOM owl drops insights. A high-CHAOS axolotl says random things on boring events.

No source code modifications. No monkey-patching. Just hooks.

## Requirements

- Claude Code 2.1.89+
- Node.js 18+

## License

MIT
