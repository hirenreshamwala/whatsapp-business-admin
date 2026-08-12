"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, KeyRound } from "lucide-react";
import { apiFetch } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
  active: boolean;
  createdAt: string;
};

export function UsersClient({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [resetFor, setResetFor] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<User[]>("/api/users"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const patch = useMutation({
    mutationFn: (v: { id: string; body: Partial<User> }) =>
      apiFetch(`/api/users/${v.id}`, { method: "PATCH", body: JSON.stringify(v.body) }),
    onSuccess: invalidate,
    onError: (e: Error) => toast({ variant: "destructive", title: "Update failed", description: e.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast({ title: "User deleted" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Delete failed", description: e.message }),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Users"
        description="Manage who can access this admin. Agents see only the inbox and contacts."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" /> New user
              </Button>
            </DialogTrigger>
            <CreateUserDialog onClose={() => setOpen(false)} onCreated={invalidate} />
          </Dialog>
        }
      />

      <div className="p-3 sm:p-4">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-32">Role</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-40">Created</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {users.map((u) => {
                const self = u.id === currentUserId;
                return (
                  <TableRow key={u.id}>
                    <TableCell data-label="Name" className="font-medium">
                      {u.name} {self && <span className="text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell data-label="Email" className="break-all text-muted-foreground">{u.email}</TableCell>
                    <TableCell data-label="Role">
                      <Select
                        value={u.role}
                        onValueChange={(role) => patch.mutate({ id: u.id, body: { role: role as User["role"] } })}
                        disabled={self}
                      >
                        <SelectTrigger className="h-7 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="AGENT">Agent</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell data-label="Status">
                      <button
                        type="button"
                        disabled={self}
                        onClick={() => patch.mutate({ id: u.id, body: { active: !u.active } })}
                        className="disabled:opacity-60"
                      >
                        <Badge variant={u.active ? "success" : "secondary"}>
                          {u.active ? "Active" : "Disabled"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell data-label="Created" className="text-xs text-muted-foreground">
                      {formatDateTime(u.createdAt)}
                    </TableCell>
                    <TableCell data-label="Actions" className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Reset password" onClick={() => setResetFor(u)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          disabled={self}
                          onClick={() => {
                            if (confirm(`Delete ${u.name}?`)) remove.mutate(u.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        {resetFor && (
          <ResetPasswordDialog
            user={resetFor}
            onDone={() => setResetFor(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "AGENT" as User["role"] });

  const create = useMutation({
    mutationFn: () => apiFetch("/api/users", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      toast({ title: "User created" });
      onCreated();
      onClose();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Create failed", description: e.message }),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New user</DialogTitle>
        <DialogDescription>They sign in with this email and password.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Password</Label>
          <Input
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="At least 8 characters"
          />
        </div>
        <div className="space-y-1">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as User["role"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AGENT">Agent — inbox &amp; contacts only</SelectItem>
              <SelectItem value="ADMIN">Admin — full access</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ResetPasswordDialog({ user, onDone }: { user: User; onDone: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const reset = useMutation({
    mutationFn: () =>
      apiFetch(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ password }) }),
    onSuccess: () => {
      toast({ title: "Password updated" });
      onDone();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Reset password</DialogTitle>
        <DialogDescription>Set a new password for {user.name}.</DialogDescription>
      </DialogHeader>
      <div className="space-y-1">
        <Label>New password</Label>
        <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" disabled={password.length < 8 || reset.isPending} onClick={() => reset.mutate()}>
          Update password
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
