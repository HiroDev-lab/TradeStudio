import { useState, useEffect, useCallback } from "react";
import { Search, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { supabase, authHeader } from "../lib/supabase";
import { ROLE_LABELS, AGENT_SECTORS } from "../../../constants";

interface ApiUser {
  id: string;
  email: string;
  createdAt: string;
  role: string | null;
  sectors: string[];
  isMaster: boolean;
  hasAccess: boolean;
}

const GRANTABLE_ROLES = Object.keys(ROLE_LABELS).filter(role => role !== "admin-master");

// Espelha a regra real de permissão do servidor (api/admin-users.ts) só para não
// oferecer, na UI, cargos que o back-end vai recusar de qualquer forma — a
// aplicação de verdade continua sendo feita no servidor.
function rolesQueCallerPodeConceder(caller: ApiUser | null): string[] {
  if (!caller) return [];
  if (caller.isMaster) return GRANTABLE_ROLES;
  if (caller.role === "admin" || caller.role === "dev") {
    return GRANTABLE_ROLES.filter(role => role !== "admin" && role !== "dev");
  }
  if (caller.role === "lider") return ["colaborador", "co-lider"];
  return [];
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Modal Component
function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 8,
          padding: "24px",
          minWidth: "400px",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontSize: 18, fontWeight: 700, color: "#000", margin: 0 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <X size={20} color="#666" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [callerEmail, setCallerEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [formData, setFormData] = useState({ email: "", setor: "", cargo: "colaborador" });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  // Senha provisória devolvida pelo servidor: aparece uma única vez, para o gestor repassar.
  const [senhaProvisoria, setSenhaProvisoria] = useState<{ email: string; senha: string } | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/admin-users", { headers });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Erro ao carregar usuários.");
      setUsers(body.users || []);
    } catch (err: any) {
      setLoadError(err.message || "Erro ao carregar usuários.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCallerEmail(data.session?.user?.email ?? null));
  }, []);

  const caller = users.find(u => u.email === callerEmail) ?? null;
  const grantableRoles = rolesQueCallerPodeConceder(caller);

  const filteredUsers = search
    ? users.filter(
        user =>
          user.email.toLowerCase().includes(search.toLowerCase()) ||
          (user.role || "").toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const handleGrant = () => {
    setFormData({ email: "", setor: "", cargo: "colaborador" });
    setErrors({});
    setIsGrantModalOpen(true);
  };

  const handleEdit = (user: ApiUser) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      setor: user.sectors[0] || "",
      cargo: user.role || "colaborador",
    });
    setErrors({});
    setIsEditModalOpen(true);
  };

  const handleDelete = (user: ApiUser) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Email inválido";
    }

    if (!formData.setor) {
      newErrors.setor = "Setor é obrigatório";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveGrant = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, role: formData.cargo, sector: formData.setor }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Erro ao conceder acesso.");
      toast.success("Acesso concedido!");
      if (body.senhaProvisoria) setSenhaProvisoria({ email: formData.email.trim().toLowerCase(), senha: body.senhaProvisoria });
      setIsGrantModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao conceder acesso.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-password", id: selectedUser.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Erro ao redefinir a senha.");
      setSenhaProvisoria({ email: selectedUser.email, senha: body.senhaProvisoria });
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir a senha.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      const headers = await authHeader();
      const res = await fetch(`/api/admin-users?id=${selectedUser.id}`, {
        method: "DELETE",
        headers,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Erro ao revogar acesso.");
      toast.success("Acesso revogado!");
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao revogar acesso.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        width: "100%",
        height: "100%",
        background: "#f5f5f5",
        display: "flex",
        flexDirection: "column",
        padding: "16px 20px",
        gap: 16,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: 24, fontWeight: 700, color: "#000", margin: 0 }}>
          Gestão de Usuários
        </h1>
        <button
          onClick={handleGrant}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 32,
            padding: "0 14px",
            borderRadius: 8,
            background: "white",
            border: "1px solid rgba(0,0,0,0.2)",
            cursor: "pointer",
            fontFamily: "Montserrat, sans-serif",
            fontSize: 10,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <span>+</span>
          <span>CONCEDER ACESSO</span>
        </button>
      </div>

      <p style={{ fontFamily: "Montserrat, sans-serif", fontSize: 11, color: "rgba(0,0,0,0.5)", margin: 0 }}>
Contas cadastradas no sistema e o cargo/setor concedido a cada uma. Quem não tem cargo aparece como "Sem acesso" e não consegue usar o sistema.
      </p>

      {/* Search */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{
          flex: "1",
          minWidth: 0,
          height: 44,
          background: "white",
          borderRadius: 8,
          border: "1px solid rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingLeft: 16,
          paddingRight: 16,
          position: "relative",
          boxSizing: "border-box",
        }}>
          <Search size={16} color="rgba(0,0,0,0.5)" style={{ flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="E-mail ou cargo"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: "Montserrat, sans-serif",
              fontSize: 12,
              color: "black",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute", top: -8, right: -8,
                width: 24, height: 24, borderRadius: "50%",
                background: "transparent", color: "black", border: "none",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", zIndex: 10
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: "white",
          border: "1px solid #d7d7d7",
          borderRadius: 8,
          overflow: "auto",
          boxSizing: "border-box",
        }}
      >
        {loadError ? (
          <div style={{ padding: 24, fontFamily: "Montserrat, sans-serif", fontSize: 13, color: "#ff0000" }}>
            {loadError}
          </div>
        ) : isLoading ? (
          <div style={{ padding: 24, fontFamily: "Montserrat, sans-serif", fontSize: 13, color: "rgba(0,0,0,0.5)" }}>
            Carregando usuários...
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "Montserrat, sans-serif",
              fontSize: 14,
            }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                background: "white",
                zIndex: 10,
              }}
            >
              <tr>
                <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: "#000", borderBottom: "1px solid #d7d7d7", whiteSpace: "nowrap" }}>EMAIL</th>
                <th style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600, fontSize: 13, color: "#000", borderBottom: "1px solid #d7d7d7", whiteSpace: "nowrap" }}>CARGO</th>
                <th style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600, fontSize: 13, color: "#000", borderBottom: "1px solid #d7d7d7", whiteSpace: "nowrap" }}>SETOR</th>
                <th style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600, fontSize: 13, color: "#000", borderBottom: "1px solid #d7d7d7", whiteSpace: "nowrap" }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <tr
                  key={user.id}
                  style={{
                    background: index % 2 === 0 ? "#f9f9f9" : "white",
                    borderBottom: "1px solid #e5e5e5",
                  }}
                >
                  <td style={{ padding: "14px 16px", color: "#000", textAlign: "left" }}>{user.email}</td>
                  <td style={{ padding: "14px 16px", color: user.hasAccess ? "#000" : "#ff8c00", textAlign: "center" }}>
                    {user.isMaster ? "Admin Master" : user.role ? ROLE_LABELS[user.role] || user.role : "Sem acesso"}
                  </td>
                  <td style={{ padding: "14px 16px", color: "#000", textAlign: "center" }}>
                    {AGENT_SECTORS.find(s => s.id === user.sectors[0])?.name || user.sectors[0] || "—"}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
                      {user.hasAccess ? (
                        <>
                          <button
                            onClick={() => handleEdit(user)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
                            title="Editar"
                          >
                            <Pencil size={16} color="#666" />
                          </button>
                          {!user.isMaster && (
                            <button
                              onClick={() => handleDelete(user)}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
                              title="Revogar acesso"
                            >
                              <X size={16} color="#666" />
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => handleEdit(user)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid rgba(0,0,0,0.2)",
                            background: "white",
                            cursor: "pointer",
                            fontFamily: "Montserrat, sans-serif",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Conceder acesso
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Grant Access Modal (usuário novo, e-mail digitado) */}
      <Modal isOpen={isGrantModalOpen} onClose={() => setIsGrantModalOpen(false)} title="CONCEDER ACESSO">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontFamily: "Montserrat, sans-serif", fontSize: 12, color: "#666", margin: 0 }}>
            Se o e-mail ainda não tem conta, ela é criada agora e você recebe uma senha provisória para repassar à pessoa.
          </p>

          <div>
            <label style={{ display: "block", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 500, color: "#000", marginBottom: 6 }}>
              EMAIL *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: errors.email ? "1px solid #ff0000" : "1px solid rgba(0,0,0,0.2)",
                fontFamily: "Montserrat, sans-serif",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
            {errors.email && <span style={{ color: "#ff0000", fontSize: 11, marginTop: 4 }}>{errors.email}</span>}
          </div>

          <div>
            <label style={{ display: "block", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 500, color: "#000", marginBottom: 6 }}>
              CARGO *
            </label>
            <Select value={formData.cargo} onValueChange={(value: string) => setFormData({ ...formData, cargo: value })}>
              <SelectTrigger style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", fontFamily: "Montserrat, sans-serif", fontSize: 13, height: 40 }}>
                <SelectValue placeholder="Selecione um cargo" />
              </SelectTrigger>
              <SelectContent>
                {grantableRoles.map(role => (
                  <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label style={{ display: "block", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 500, color: "#000", marginBottom: 6 }}>
              SETOR DO USUÁRIO *
            </label>
            <Select value={formData.setor} onValueChange={(value: string) => setFormData({ ...formData, setor: value })}>
              <SelectTrigger style={{
                width: "100%",
                borderRadius: 8,
                border: errors.setor ? "1px solid #ff0000" : "1px solid rgba(0,0,0,0.2)",
                fontFamily: "Montserrat, sans-serif",
                fontSize: 13,
                height: 40,
              }}>
                <SelectValue placeholder="Selecione um setor" />
              </SelectTrigger>
              <SelectContent>
                {AGENT_SECTORS.map(sector => (
                  <SelectItem key={sector.id} value={sector.id}>{sector.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.setor && <span style={{ color: "#ff0000", fontSize: 11, marginTop: 4 }}>{errors.setor}</span>}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              onClick={() => setIsGrantModalOpen(false)}
              style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", background: "white", cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 500 }}
            >
              CANCELAR
            </button>
            <button
              onClick={saveGrant}
              disabled={isSaving}
              style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#000", color: "white", cursor: isSaving ? "default" : "pointer", opacity: isSaving ? 0.6 : 1, fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 600 }}
            >
              SALVAR
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal (usuário já listado, com ou sem acesso) */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="EDITAR ACESSO">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 500, color: "#000", marginBottom: 6 }}>
              EMAIL
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", fontFamily: "Montserrat, sans-serif", fontSize: 13, boxSizing: "border-box", background: "#f5f5f5", color: "rgba(0,0,0,0.6)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 500, color: "#000", marginBottom: 6 }}>
              CARGO *
            </label>
            <Select value={formData.cargo} onValueChange={(value: string) => setFormData({ ...formData, cargo: value })}>
              <SelectTrigger style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", fontFamily: "Montserrat, sans-serif", fontSize: 13, height: 40 }}>
                <SelectValue placeholder="Selecione um cargo" />
              </SelectTrigger>
              <SelectContent>
                {grantableRoles.map(role => (
                  <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label style={{ display: "block", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 500, color: "#000", marginBottom: 6 }}>
              SETOR DO USUÁRIO *
            </label>
            <Select value={formData.setor} onValueChange={(value: string) => setFormData({ ...formData, setor: value })}>
              <SelectTrigger style={{
                width: "100%",
                borderRadius: 8,
                border: errors.setor ? "1px solid #ff0000" : "1px solid rgba(0,0,0,0.2)",
                fontFamily: "Montserrat, sans-serif",
                fontSize: 13,
                height: 40,
              }}>
                <SelectValue placeholder="Selecione um setor" />
              </SelectTrigger>
              <SelectContent>
                {AGENT_SECTORS.map(sector => (
                  <SelectItem key={sector.id} value={sector.id}>{sector.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.setor && <span style={{ color: "#ff0000", fontSize: 11, marginTop: 4 }}>{errors.setor}</span>}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleResetPassword}
              disabled={isSaving}
              style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", background: "white", cursor: isSaving ? "default" : "pointer", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 500, marginRight: "auto" }}
            >
              REDEFINIR SENHA
            </button>
            <button
              onClick={() => { setIsEditModalOpen(false); setSelectedUser(null); }}
              style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", background: "white", cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 500 }}
            >
              CANCELAR
            </button>
            <button
              onClick={saveGrant}
              disabled={isSaving}
              style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#000", color: "white", cursor: isSaving ? "default" : "pointer", opacity: isSaving ? 0.6 : 1, fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 600 }}
            >
              SALVAR
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={senhaProvisoria !== null} onClose={() => setSenhaProvisoria(null)} title="SENHA PROVISÓRIA">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontFamily: "Montserrat, sans-serif", fontSize: 13, color: "#000", margin: 0 }}>
            Repasse esta senha para <strong>{senhaProvisoria?.email}</strong>. No primeiro login a pessoa vai escolher uma senha nova.
          </p>
          <div style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: 1, textAlign: "center", padding: "14px 12px", borderRadius: 8, background: "#f5f5f5", border: "1px solid rgba(0,0,0,0.12)", userSelect: "all" }}>
            {senhaProvisoria?.senha}
          </div>
          <p style={{ fontFamily: "Montserrat, sans-serif", fontSize: 12, color: "#666", margin: 0 }}>
            Ela não será mostrada de novo. Se perder, use "Redefinir senha" no usuário.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              onClick={() => { navigator.clipboard.writeText(senhaProvisoria?.senha || ""); toast.success("Senha copiada!"); }}
              style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", background: "white", cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 500 }}
            >
              COPIAR
            </button>
            <button
              onClick={() => setSenhaProvisoria(null)}
              style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#000", color: "white", cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 600 }}
            >
              JÁ ANOTEI
            </button>
          </div>
        </div>
      </Modal>

      {/* Revoke Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="CONFIRMAR REVOGAÇÃO">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontFamily: "Montserrat, sans-serif", fontSize: 13, color: "#000", margin: 0 }}>
            Tem certeza que deseja revogar o acesso de <strong>{selectedUser?.email}</strong>?
          </p>
          <p style={{ fontFamily: "Montserrat, sans-serif", fontSize: 12, color: "#666", margin: 0 }}>
            A conta continua existindo, mas a pessoa perde o cargo/permissão no sistema.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              onClick={() => { setIsDeleteModalOpen(false); setSelectedUser(null); }}
              style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", background: "white", cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 500 }}
            >
              CANCELAR
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={isSaving}
              style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#ff0000", color: "white", cursor: isSaving ? "default" : "pointer", opacity: isSaving ? 0.6 : 1, fontFamily: "Montserrat, sans-serif", fontSize: 12, fontWeight: 600 }}
            >
              REVOGAR
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
