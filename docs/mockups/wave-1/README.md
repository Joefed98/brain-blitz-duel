# Wave 1 mockups

Approved screens from the competitive-layer canvas, exported 9 November 2026.
The PNGs are what the screens should look like (drawn at 390 px wide, saved at 2x).
`source/` holds each screen's original markup, for exact colours, sizes and spacing.
It needs the canvas runtime to display, so open the PNGs to see the screens.

Where this README and a mockup disagree, follow this README. The mockups were drawn
for the finished app, so some show things that only arrive in later waves.

## Sign-up (Session 3: Sign-up screens)

| File | Screen | Wave 1 changes |
| --- | --- | --- |
| S1-SavePrompt.png | Save your progress | Shown after the first finished game (room, Daily or challenge). List only what's real today: your games, bests, stars and challenges on every phone. Ratings, placement and the 1,000 coins are added as waves 2 and 3 land. "Not now" as drawn. |
| S2-SignIn.png | Sign in | Apple and Google buttons appear only when their switches are on. |
| S3-Email.png | Enter email | As drawn. |
| S3b-Inbox.png | Check your inbox | Add the 6-digit code entry: "Tap the link or type the code". Resend after 60 s and "Use a different email" as drawn. |
| S4-Username.png | Username and colour | Hint text: "3-16 letters, numbers or underscores". All 32 colours as drawn. The card preview shows no rating or placement in wave 1. |
| S5-Birthday.png | Date of birth | Remove the info box entirely. The question must not mention any age limit. Keep the heading and the line saying it's never shown to other players. |
| S6-Welcome.png | Welcome | Show the Founding Player badge and number (or the player number after launch). Leave out the coins and placement rows until waves 2 and 3. Main button goes back to playing; "Customise your card" waits for wave 2. |

## Onboarding (Session 2: First impressions)

| File | Screen | Wave 1 changes |
| --- | --- | --- |
| O1-Hello.png, O2-How.png, O3-First.png | Onboarding | Build all three as drawn, behind a switch that stays OFF until wave 3, when the rated match exists. Skip on every screen. |

## Empty and error states (Session 2: First impressions)

| File | Screen | Wave 1 use |
| --- | --- | --- |
| E1-NoFriends.png | No friends yet | Build as a reusable empty-state component; the Friends screen arrives in wave 2. |
| E2-NoTournaments.png | Tournaments, nothing live | Reference for wave 4; use the same component. |
| E3-NoMatches.png | No matches yet | Use for today's history and results lists. Say "Your games and results show up here"; rating changes come in wave 3. The button goes to playing. |
| X1-Offline.png | Offline | Restyle the existing offline screens to this; behaviour unchanged. |
| X2-NotFound.png | Not found | Room code not found, expired challenge link, general not-found page. |
| X3-Error.png | Something broke | The error boundary screen. |

Navigation bars and coin counts in the backgrounds show the finished app; wave 1 screens keep today's navigation.
