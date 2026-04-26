import { isSupabaseConfigured } from '@/src/lib/env';
import { demoBackend } from '@/src/services/demo-backend';
import { StoryBackend } from '@/src/services/backend';
import { supabaseBackend } from '@/src/services/supabase-backend';

export const backend: StoryBackend = isSupabaseConfigured ? supabaseBackend : demoBackend;
