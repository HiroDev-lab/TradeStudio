import { authHeader } from "./supabase";

export async function fetchGlobalAssets<T>(type: "knowledge" | "requests"): Promise<T[]> {
  const headers = await authHeader();
  const res = await fetch(`/api/admin-global-assets?type=${type}`, { headers });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Erro ao carregar ativos globais.");
  return body.items || [];
}

export async function createGlobalAsset<T>(type: "knowledge" | "requests", payload: Record<string, any>): Promise<T> {
  const headers = await authHeader();
  const res = await fetch("/api/admin-global-assets", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ type, ...payload }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Erro ao criar ativo global.");
  return body.item;
}

export async function deleteGlobalAsset(type: "knowledge" | "requests", id: string): Promise<void> {
  const headers = await authHeader();
  const res = await fetch(`/api/admin-global-assets?type=${type}&id=${id}`, {
    method: "DELETE",
    headers,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Erro ao excluir ativo global.");
}
