import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Profile = { display_name: string; description: string; avatar_url: string | null };
type Banner = { id: string; image_url: string | null; link_url: string; position: number };

const Index = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Link na Bio";
    (async () => {
      const [{ data: p }, { data: b }] = await Promise.all([
        supabase.from("profile").select("display_name, description, avatar_url").maybeSingle(),
        supabase.from("banners").select("id, image_url, link_url, position").order("position", { ascending: true }),
      ]);
      if (p) setProfile(p as Profile);
      if (b) setBanners(b as Banner[]);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="relative min-h-screen bg-background bio-radial">
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 pb-16 pt-16">
        {/* Avatar */}
        <div className="relative mb-6">
          <div className="absolute inset-0 -z-10 rounded-full blur-2xl" style={{ background: "hsl(var(--primary) / 0.4)" }} />
          <div className="h-28 w-28 overflow-hidden rounded-full border-2 border-primary bg-secondary">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {loading ? "" : profile?.display_name}
        </h1>
        <p className="mt-2 max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
          {loading ? "" : profile?.description}
        </p>

        {/* Banners */}
        <section className="mt-10 flex w-full flex-col gap-4" aria-label="Links">
          {banners.length === 0 && !loading && (
            <p className="text-center text-sm text-muted-foreground">Nenhum link disponível ainda.</p>
          )}
          {banners.map((banner) => (
            <a
              key={banner.id}
              href={banner.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bio-banner group"
            >
              {banner.image_url ? (
                <img
                  src={banner.image_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
            </a>
          ))}
        </section>
      </div>
    </main>
  );
};

export default Index;
