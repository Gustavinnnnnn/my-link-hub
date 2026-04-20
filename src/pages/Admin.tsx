import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, ArrowUp, ArrowDown, LogOut, Upload, ShieldAlert } from "lucide-react";

type Profile = { id: string; display_name: string; description: string; avatar_url: string | null };
type Banner = { id: string; image_url: string | null; link_url: string; position: number };

const Admin = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  // Auth gate
  useEffect(() => {
    document.title = "Painel Administrativo";
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) navigate("/auth", { replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) navigate("/auth", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // Check admin role
  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [session]);

  const loadData = useCallback(async () => {
    const [{ data: p }, { data: b }] = await Promise.all([
      supabase.from("profile").select("*").maybeSingle(),
      supabase.from("banners").select("*").order("position", { ascending: true }),
    ]);
    if (p) setProfile(p as Profile);
    if (b) setBanners(b as Banner[]);
  }, []);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${prefix}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("bio-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Falha no upload: " + error.message);
      return null;
    }
    const { data } = supabase.storage.from("bio-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const url = await uploadFile(file, "avatar");
    if (url) {
      setProfile({ ...profile, avatar_url: url });
      toast.success("Imagem carregada — clique em Salvar perfil");
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profile")
      .update({
        display_name: profile.display_name,
        description: profile.description,
        avatar_url: profile.avatar_url,
      })
      .eq("id", profile.id);
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil salvo");
  };

  const addBanner = async () => {
    const nextPos = banners.length ? Math.max(...banners.map((b) => b.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("banners")
      .insert({ link_url: "https://", position: nextPos })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setBanners([...banners, data as Banner]);
  };

  const updateBanner = async (id: string, patch: Partial<Banner>) => {
    setBanners(banners.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    const { error } = await supabase.from("banners").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const handleBannerUpload = async (id: string, file: File) => {
    const url = await uploadFile(file, "banner");
    if (url) await updateBanner(id, { image_url: url });
  };

  const deleteBanner = async (id: string) => {
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setBanners(banners.filter((b) => b.id !== id));
  };

  const moveBanner = async (id: string, dir: -1 | 1) => {
    const idx = banners.findIndex((b) => b.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= banners.length) return;
    const a = banners[idx];
    const b = banners[swap];
    const newList = [...banners];
    newList[idx] = { ...b, position: a.position };
    newList[swap] = { ...a, position: b.position };
    newList.sort((x, y) => x.position - y.position);
    setBanners(newList);
    await Promise.all([
      supabase.from("banners").update({ position: b.position }).eq("id", a.id),
      supabase.from("banners").update({ position: a.position }).eq("id", b.id),
    ]);
  };

  if (!session || isAdmin === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md p-6 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Sua conta ({session.user.email}) ainda não tem permissão de administrador. Execute no Cloud → SQL:
          </p>
          <pre className="text-left text-xs bg-secondary p-3 rounded-lg overflow-x-auto mb-4">
{`INSERT INTO public.user_roles (user_id, role)
VALUES ('${session.user.id}', 'admin');`}
          </pre>
          <Button variant="outline" onClick={handleLogout} className="w-full">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Painel</h1>
            <p className="text-sm text-muted-foreground">{session.user.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </header>

        {/* Profile */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Perfil</h2>
          {profile && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-primary bg-secondary">
                  {profile.avatar_url && <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <Label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:border-primary">
                    <Upload className="h-4 w-4" /> Trocar foto
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </Label>
              </div>
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="desc">Descrição</Label>
                <Textarea id="desc" rows={3} value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} />
              </div>
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? "Salvando..." : "Salvar perfil"}
              </Button>
            </div>
          )}
        </Card>

        {/* Banners */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Banners</h2>
            <Button size="sm" onClick={addBanner}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
          </div>
          <div className="space-y-4">
            {banners.length === 0 && <p className="text-sm text-muted-foreground">Nenhum banner ainda.</p>}
            {banners.map((banner, i) => (
              <div key={banner.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="bio-banner !aspect-[16/7]">
                  {banner.image_url && <img src={banner.image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Label className="cursor-pointer">
                    <span className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:border-primary">
                      <Upload className="h-4 w-4" /> Imagem
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleBannerUpload(banner.id, e.target.files[0])}
                    />
                  </Label>
                  <Button size="sm" variant="outline" onClick={() => moveBanner(banner.id, -1)} disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => moveBanner(banner.id, 1)} disabled={i === banners.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" className="ml-auto" onClick={() => deleteBanner(banner.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <Label>Link</Label>
                  <Input
                    value={banner.link_url}
                    onChange={(e) => setBanners(banners.map((b) => b.id === banner.id ? { ...b, link_url: e.target.value } : b))}
                    onBlur={(e) => updateBanner(banner.id, { link_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
};

export default Admin;