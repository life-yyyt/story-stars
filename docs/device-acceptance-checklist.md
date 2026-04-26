# iPhone Acceptance Checklist

Use this checklist before calling a build ready for external testing.

## Build Target

- Use Expo Go only for quick development checks.
- Use an iOS development build or release build for final performance judgment.
- Test on at least one older iPhone and one recent iPhone if possible.

## First Launch

- App opens without red error screen.
- Universe appears within 1 second on normal network.
- No local sample stars are visible.
- Empty universe copy is minimal and does not block interaction.
- Bottom tab bar is readable and not covering critical content.

## Universe Interaction

- Single-finger drag rotates the universe smoothly.
- Pinch zoom can move closer than the previous version.
- Pinch zooming out never makes the whole star field disappear suddenly.
- Dragging does not accidentally open a story.
- Coordinate search places the target star in the center and close enough to inspect.

## Publishing

- A new user can publish without manually logging in.
- Supabase anonymous session is created automatically.
- The user can publish up to 3 stories in one Shanghai day.
- The fourth new story is blocked with a clear minimal message.
- Editing an existing story does not consume the daily quota.
- Public stories receive a coordinate code.
- Private stories are visible to the author but not readable by other identities.

## Reading

- Tapping a star opens the reader without layout overlap.
- The reader close button is reachable.
- Long text scrolls.
- Copy coordinate works for public and owned private stars.
- Light-up works once per identity, including the author.
- Re-tapping the same star does not increase the count again.
- Edit is only shown for the owner.

## My Stars

- Published stories appear in `My Stars`.
- Locate returns to the universe and centers the target star.
- Copy coordinate works from the list.
- Delete asks for confirmation.
- After deletion, the story disappears from `My Stars`.
- After deletion, the star body remains in the public universe as a non-readable remnant.

## Account Protection

- If `EXPO_PUBLIC_PHONE_AUTH_ENABLED=false`, phone protection is shown as not yet open and no SMS request is sent.
- If phone auth is later enabled, request code, verify code, sign out, and recover must all be tested with a real SMS provider.

## Error States

- Supabase table/function missing errors show a readable app message.
- Network failure shows a readable app message.
- Permission/RLS failures show a readable app message.
- No unexpected iOS system alerts appear except destructive confirmations.

## Release Gate

Run before every handoff:

```powershell
cmd /c npx tsc --noEmit
cmd /c npm run lint
cmd /c npx expo export --platform web
```
