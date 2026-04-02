---
name: oh-my-buddy
description: Show your buddy's profile, stats, level, achievements, garden, and session status. Use when the user wants to see their buddy or check progress.
user_invocable: true
---

# Oh My Buddy

Show the user their buddy profile and current status.

## Instructions

1. Read the buddy profile from `~/.claude/oh-my-buddy/buddy.json`
2. Read the stats from `~/.claude/buddy-stats.json`
3. Present everything in a fun, visual format

If buddy.json doesn't exist, tell the user their buddy hasn't hatched yet and offer to detect it.

## Output Format

Present the buddy like this:

```
🐉 Meet [Name] the [Species]!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Rarity: ★★★ Rare
Eyes: ✦  Hat: wizard  Shiny: No

📊 Personality Stats
  CHAOS:     ████████░░ 82
  SNARK:     █████████░ 91
  WISDOM:    ██████░░░░ 58
  PATIENCE:  ███░░░░░░░ 24
  DEBUGGING: ███████░░░ 71

📈 Progress
  Level: 7 (Baby stage)
  XP: 340 / 500 to next level
  Streak: 5 days (best: 12)

🏆 Achievements (4/12)
  🩸 First Blood  🌱 Gardener  🍳 Hatcher  🔥 On Fire

🌱 Garden
  [T] [T] [*] [i] [.] [.] [.] [ ] [ ] [ ]

😤 Session
  Rage: ████░░░░░░ 40%
  Commits: 3 | Tests passed: 7 | Errors: 2
```

## If No Buddy Detected

If `~/.claude/oh-my-buddy/buddy.json` doesn't exist:

1. Try to auto-detect by reading `~/.claude/.credentials.json` or `~/.claude/config.json` for the user's account UUID
2. If found, run the FNV-1a + Mulberry32 algorithm to derive the buddy (the code is in the plugin at `src/buddy.js`)
3. Save to `~/.claude/oh-my-buddy/buddy.json`
4. Show the buddy with a special "hatching" message:

```
🥚 An egg is cracking...
    _*_
   / ^.^ \
  | /| |\  |
  |/ | | \|
   \__~__/

🎉 Your buddy has hatched!

🐉 Meet Sparky the Dragon!
[... rest of profile ...]
```

## If No Stats Yet

If `~/.claude/buddy-stats.json` doesn't exist, show the buddy profile without progress stats and say:

"Your buddy is ready! Start coding and watch them grow. Every commit, test pass, and file you create earns XP."
