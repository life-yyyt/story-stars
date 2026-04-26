# Supabase Setup

This folder contains the cloud database setup for Story Stars.

## Fresh Project Setup

1. Create a Supabase project.

2. Enable anonymous publishing:

   `Authentication -> Sign In / Providers -> Anonymous Sign-Ins -> Enabled`

3. Keep phone auth disabled for now.

   Phone protection is product-gated by `EXPO_PUBLIC_PHONE_AUTH_ENABLED=false` until a domestic SMS provider is connected.

4. Open `SQL Editor` and run the full contents of:

   `supabase/bootstrap.sql`

5. Copy client config into `.env`:

   ```text
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
   EXPO_PUBLIC_PHONE_AUTH_ENABLED=false
   ```

   The URL should be the project root. Do not include `/rest/v1`.

6. Restart Expo with a clean cache:

   ```powershell
   cmd /c npx expo start --clear
   ```

## What `bootstrap.sql` Creates

- `profiles`: user display identity.
- `stories`: one story equals one star.
- `story_views`: deduplicated view counts.
- `story_likes`: one light-up per identity per star, including the author.
- `star_remnants`: deleted story shells that keep decorating the universe.
- `get_universe_window_stars(...)`: lightweight universe star loading.
- `get_story_detail(...)`: lazy story detail loading.
- `resolve_coordinate_target(...)`: coordinate search.
- `reserve_story_coordinate()`: new star placement.
- `record_story_view(...)`: view counter.
- `record_story_like(...)`: light-up and brightness update.
- `retire_story_to_remnant(...)`: delete body while keeping surface star data.
- `stories_daily_limit`: maximum 3 new stories per user per Shanghai day.

## Existing Project Hotfixes

If the project already exists and only one feature is missing, use the hotfix files:

- `hotfix_record_story_metrics.sql`: repairs view/like RPC return types.
- `hotfix_star_remnants.sql`: adds deletion remnants.
- `hotfix_raise_public_star_brightness_cap.sql`: raises public star brightness cap.

For a clean new Supabase project, prefer `bootstrap.sql` once instead of applying hotfix files manually.

## Smoke Test

After running SQL:

1. Open the app.
2. Publish one public story without signing in.
3. Confirm a star appears in the universe.
4. Tap the star and confirm the story opens.
5. Light it once.
6. Copy its coordinate.
7. Search the coordinate from the universe.
8. Delete it from `My Stars`.
9. Confirm it disappears from `My Stars` but remains as a non-readable star remnant in the universe.
