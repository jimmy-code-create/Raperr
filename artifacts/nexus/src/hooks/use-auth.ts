import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface AuthUser {
  id: string;
  username?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  isVerified?: boolean;
  isAdmin?: boolean;
  rizzScore?: number;
  followerCount?: number;
  followingCount?: number;
  interests?: string[];
  onboardingCompleted?: boolean;
  customStatus?: string | null;
  dnd?: boolean;
}

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/users/me", { credentials: "include" });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) return null;
  return res.json() as Promise<AuthUser>;
}

export function useAuth() {
  const qc = useQueryClient();
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/users/me"],
    queryFn: fetchMe,
    staleTime: 30_000,
    retry: false,
  });

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    qc.clear();
    window.location.href = "/";
  };

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading,
    logout,
  };
}
