import { supabase } from "@/integrations/supabase/client";

export async function markAsReading(linkId: string) {
  const { error } = await supabase
    .from("links")
    .update({ reading_started_at: new Date().toISOString(), is_read: false } as any)
    .eq("id", linkId);
  if (error) throw error;
}

export async function markAsRead(linkId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("links")
    .update({ reading_completed_at: now, is_read: true } as any)
    .eq("id", linkId);
  if (error) throw error;

  // Update reading streak for today
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("reading_streaks" as any)
    .select("id, links_read")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("reading_streaks" as any)
      .update({ links_read: (existing as any).links_read + 1 })
      .eq("id", (existing as any).id);
  } else {
    await supabase
      .from("reading_streaks" as any)
      .insert({ user_id: user.id, date: today, links_read: 1 });
  }
}

export async function fetchReadingStreaks(userId: string, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("reading_streaks" as any)
    .select("*")
    .eq("user_id", userId)
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getReadingStats(userId: string) {
  // Calculate current reading streak
  const { data: streaks } = await supabase
    .from("reading_streaks" as any)
    .select("date, links_read")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(90);

  let currentStreak = 0;
  if (streaks && streaks.length > 0) {
    const today = new Date();
    const d = new Date(today);
    for (const streak of streaks as any[]) {
      const streakDate = streak.date;
      const expected = d.toISOString().slice(0, 10);
      if (streakDate === expected) {
        currentStreak++;
        d.setDate(d.getDate() - 1);
      } else {
        // Allow skipping today if not yet read
        if (currentStreak === 0 && streakDate === new Date(d.getTime() - 86400000).toISOString().slice(0, 10)) {
          d.setDate(d.getDate() - 1);
          currentStreak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
    }
  }

  const totalRead = (streaks as any[] || []).reduce((sum: number, s: any) => sum + s.links_read, 0);

  return { currentStreak, totalRead, streaks: streaks || [] };
}
