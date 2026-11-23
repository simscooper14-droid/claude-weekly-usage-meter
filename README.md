# Weekly Usage Meter

A small Claude Code mod that shows how much of your weekly Claude limit you've used, as a meter that fills up.

- A bar above the prompt and in the status line: `Week ████████░░░░ 59% · resets in 5d 22h`
- Green under 75%, yellow from 75%, red from 90%, plus a one-time toast when you cross 90%.
- Reads the real `seven_day` rate-limit window Claude reports after each reply, so it's live on a Pro/Max subscription.
- Keeps the last reading between sessions, and counts down to the reset (Sunday 7 PM Central if the API gives no reset time).

## Install

```
/plugin marketplace add simscooper14-droid/claude-weekly-usage-meter
/plugin install weekly-usage-meter@claude-weekly-usage-meter
```
