import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type {
  DocumentFolder,
  DocumentRow,
  DocumentVersion,
} from "@/lib/documents/documents.server";

export type { DocumentFolder, DocumentRow, DocumentVersion };

const BUCKET = "ged-documents";

export const listFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DocumentFolder[]> => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    const companyId = await assertModuleEnabled(
      context.supabase,
      context.userId,
      "documents",
    );
    const { data, error } = await context.supabase
      .from("document_folders")
      .select("id, name, parent_id, created_at")
      .eq("company_id", companyId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as DocumentFolder[];
  });

export const createFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; parentId?: string | null }) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        parentId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    const companyId = await assertModuleEnabled(
      context.supabase,
      context.userId,
      "documents",
    );
    const { data: row, error } = await context.supabase
      .from("document_folders")
      .insert({
        company_id: companyId,
        name: data.name,
        parent_id: data.parentId ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    await assertModuleEnabled(context.supabase, context.userId, "documents");
    const { error } = await context.supabase
      .from("document_folders")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { folderId?: string | null; search?: string } | undefined) =>
    z
      .object({
        folderId: z.string().uuid().nullable().optional(),
        search: z.string().max(120).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<DocumentRow[]> => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    const { nameMap } = await import("@/lib/documents/documents.server");
    const companyId = await assertModuleEnabled(
      context.supabase,
      context.userId,
      "documents",
    );
    let q = context.supabase
      .from("documents")
      .select(
        "id, title, description, category, visibility, version, size_bytes, mime_type, folder_id, author_id, created_at, updated_at",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.folderId) q = q.eq("folder_id", data.folderId);
    const term = data.search?.trim();
    if (term) q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const names = await nameMap(
      context.supabase,
      (rows ?? []).map((r: any) => r.author_id),
    );
    return (rows ?? []).map((r: any) => ({
      ...r,
      author_name: r.author_id ? names[r.author_id] ?? null : null,
    })) as DocumentRow[];
  });

const DocInput = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(40),
  visibility: z.enum(["private", "department", "company"]),
  folderId: z.string().uuid().nullable().optional(),
  storagePath: z.string().min(3).max(400),
  fileName: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().max(120).optional(),
});

export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DocInput.parse(d))
  .handler(async ({ data, context }) => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    const companyId = await assertModuleEnabled(
      context.supabase,
      context.userId,
      "documents",
    );
    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({
        company_id: companyId,
        folder_id: data.folderId ?? null,
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        visibility: data.visibility,
        size_bytes: data.sizeBytes,
        mime_type: data.mimeType ?? null,
        file_url: data.storagePath,
        author_id: context.userId,
        version: 1,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("document_versions").insert({
      document_id: row!.id,
      version: 1,
      storage_path: data.storagePath,
      file_name: data.fileName,
      size_bytes: data.sizeBytes,
      mime_type: data.mimeType ?? null,
      created_by: context.userId,
    });
    return { id: row!.id as string };
  });

export const addDocumentVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        storagePath: z.string().min(3).max(400),
        fileName: z.string().min(1).max(255),
        sizeBytes: z.number().int().nonnegative(),
        mimeType: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    await assertModuleEnabled(context.supabase, context.userId, "documents");
    const { data: doc } = await context.supabase
      .from("documents")
      .select("version")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Document introuvable");
    const next = ((doc as any).version ?? 1) + 1;

    const { error: insErr } = await context.supabase.from("document_versions").insert({
      document_id: data.id,
      version: next,
      storage_path: data.storagePath,
      file_name: data.fileName,
      size_bytes: data.sizeBytes,
      mime_type: data.mimeType ?? null,
      created_by: context.userId,
    });
    if (insErr) throw new Error(insErr.message);

    const { error } = await context.supabase
      .from("documents")
      .update({
        version: next,
        file_url: data.storagePath,
        size_bytes: data.sizeBytes,
        mime_type: data.mimeType ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { version: next };
  });

export const getDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ document: DocumentRow; versions: DocumentVersion[] } | null> => {
      const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
      const { nameMap } = await import("@/lib/documents/documents.server");
      await assertModuleEnabled(context.supabase, context.userId, "documents");
      const { data: row } = await context.supabase
        .from("documents")
        .select(
          "id, title, description, category, visibility, version, size_bytes, mime_type, folder_id, author_id, created_at, updated_at",
        )
        .eq("id", data.id)
        .maybeSingle();
      if (!row) return null;
      const { data: versions } = await context.supabase
        .from("document_versions")
        .select("id, version, file_name, size_bytes, created_at, created_by")
        .eq("document_id", data.id)
        .order("version", { ascending: false });
      const names = await nameMap(context.supabase, [
        (row as any).author_id,
        ...(versions ?? []).map((v: any) => v.created_by),
      ]);
      return {
        document: {
          ...(row as any),
          author_name: (row as any).author_id
            ? names[(row as any).author_id] ?? null
            : null,
        },
        versions: (versions ?? []).map((v: any) => ({
          ...v,
          author_name: v.created_by ? names[v.created_by] ?? null : null,
        })),
      };
    },
  );

/** Lien temporaire de téléchargement, généré après vérification des droits de lecture. */
export const getDocumentDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; versionId?: string }) =>
    z
      .object({ id: z.string().uuid(), versionId: z.string().uuid().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    await assertModuleEnabled(context.supabase, context.userId, "documents");

    // La lecture passe par le client de l'utilisateur : les règles d'accès s'appliquent.
    const { data: doc } = await context.supabase
      .from("documents")
      .select("id, file_url")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Document introuvable ou non accessible");

    let path = (doc as any).file_url as string;
    if (data.versionId) {
      const { data: v } = await context.supabase
        .from("document_versions")
        .select("storage_path")
        .eq("id", data.versionId)
        .eq("document_id", data.id)
        .maybeSingle();
      if (!v) throw new Error("Version introuvable");
      path = (v as any).storage_path as string;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 300);
    if (error || !signed) throw new Error(error?.message ?? "Lien indisponible");
    return { url: signed.signedUrl };
  });

export const updateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(2).max(200),
        description: z.string().max(2000).optional(),
        category: z.string().min(1).max(40),
        visibility: z.enum(["private", "department", "company"]),
        folderId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    await assertModuleEnabled(context.supabase, context.userId, "documents");
    const { error } = await context.supabase
      .from("documents")
      .update({
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        visibility: data.visibility,
        folder_id: data.folderId ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    await assertModuleEnabled(context.supabase, context.userId, "documents");
    const { error } = await context.supabase
      .from("documents")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
