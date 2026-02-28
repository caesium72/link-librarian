import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    fetchProfile();
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && !data) {
      // Create profile if missing (for existing users)
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({ user_id: user.id })
        .select()
        .single();
      setProfile(newProfile as Profile | null);
    } else {
      setProfile(data as Profile | null);
    }
    setLoading(false);
  };

  const updateProfile = async (updates: Partial<Pick<Profile, "username" | "display_name" | "bio" | "avatar_url">>) => {
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data as Profile);
    return data as Profile;
  };

  return { profile, loading, updateProfile, refetch: fetchProfile };
}

export function usePublicProfile(username: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data as Profile | null);
        setLoading(false);
      });
  }, [username]);

  return { profile, loading };
}
