// Wählt die Datenschicht. Mit EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY (siehe .env.example)
// spricht die App mit Supabase, sonst mit den Demodaten im Speicher.
// Beide Werte sind öffentlich (landen im App-Bundle); geschützt wird über RLS in der Datenbank.
import type { Api } from './api';
import { api as fakeApi } from './fake';
import { createSupabaseApi } from './supabase';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const backend: 'supabase' | 'demo' = url && key ? 'supabase' : 'demo';
export const api: Api = url && key ? createSupabaseApi(url, key) : fakeApi;
