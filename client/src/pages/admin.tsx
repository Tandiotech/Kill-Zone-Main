import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, LogOut, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { apiUrl } from "@/lib/apiBase";
import { clearStoredAdminToken, getStoredAdminToken } from "@/lib/authToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type AllowedUser = { id: string; email: string; added_at: string };

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getStoredAdminToken();
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token ?? ""}`,
    },
  });
  if (res.status === 401) {
    clearStoredAdminToken();
    window.location.hash = "#/login";
  }
  return res;
}

export default function AdminPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AllowedUser[] | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await adminFetch("/api/admin/allowed-users");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast({
        variant: "destructive",
        title: "Could not load the allow-list",
        description: body.message,
      });
      setUsers([]);
      return;
    }
    const body = (await res.json()) as { users: AllowedUser[] };
    setUsers(body.users);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const res = await adminFetch("/api/admin/allowed-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Could not add email", description: body.message });
        return;
      }
      setNewEmail("");
      toast({ title: "Email added", description: body.user.email });
      await load();
    } finally {
      setAdding(false);
    }
  }

  function startEdit(u: AllowedUser) {
    setEditingId(u.id);
    setEditingEmail(u.email);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingEmail("");
  }

  async function saveEdit(id: string) {
    if (!editingEmail.trim()) return;
    setSavingId(id);
    try {
      const res = await adminFetch(`/api/admin/allowed-users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editingEmail.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Could not update email", description: body.message });
        return;
      }
      toast({ title: "Email updated", description: body.user.email });
      cancelEdit();
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      const res = await adminFetch(`/api/admin/allowed-users/${pendingDeleteId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Could not remove email", description: body.message });
        return;
      }
      toast({ title: "Email removed" });
      await load();
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2FC694]/25 bg-[#2FC694]/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[#2FC694]">
              <ShieldCheck className="h-3 w-3" />
              Admin panel
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Access control</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage which emails can sign in to KILLZONE.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer gap-1.5"
            onClick={() => {
              clearStoredAdminToken();
              window.location.hash = "#/login";
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </Button>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          onSubmit={onAdd}
          className="mb-6 flex gap-2 rounded-lg border border-border bg-card p-3"
        >
          <Input
            type="email"
            required
            placeholder="new-user@company.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={adding}
            className="flex-1"
          />
          <Button type="submit" disabled={adding} className="cursor-pointer gap-1.5">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="overflow-hidden rounded-lg border border-border bg-card"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-px text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users === null && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {users !== null && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    No emails on the allow-list yet.
                  </TableCell>
                </TableRow>
              )}
              {users?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {editingId === u.id ? (
                      <Input
                        autoFocus
                        type="email"
                        value={editingEmail}
                        onChange={(e) => setEditingEmail(e.target.value)}
                        disabled={savingId === u.id}
                        className="h-8"
                      />
                    ) : (
                      u.email
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.added_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === u.id ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 cursor-pointer"
                          disabled={savingId === u.id}
                          onClick={() => saveEdit(u.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 cursor-pointer"
                          disabled={savingId === u.id}
                          onClick={cancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 cursor-pointer"
                          onClick={() => startEdit(u)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 cursor-pointer text-[hsl(352_51%_62%)] hover:text-[hsl(352_51%_62%)]"
                          onClick={() => setPendingDeleteId(u.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      </div>

      <AlertDialog open={pendingDeleteId != null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this email?</AlertDialogTitle>
            <AlertDialogDescription>
              They will immediately lose access to the platform. This can't be undone from here —
              you'd need to add them back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={confirmDelete}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
