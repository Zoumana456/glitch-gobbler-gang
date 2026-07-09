import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
} from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import type { LoadedReport } from "./reports.types";
import { formatLongDate } from "./date-utils";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#1f2937",
    lineHeight: 1.55,
  },
  header: { marginBottom: 24, borderBottom: "2 solid #2563eb", paddingBottom: 12 },
  date: { fontSize: 10, color: "#6b7280", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 6 },
  author: { fontSize: 10, color: "#6b7280" },
  section: { marginBottom: 18 },
  h2: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 8,
    marginBottom: 10,
    color: "#111827",
  },
  para: { marginBottom: 8, textAlign: "justify" },
  bullet: { flexDirection: "row", marginBottom: 6 },
  bulletDot: { width: 12 },
  bulletText: { flex: 1 },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  image: { width: 160, height: 120, objectFit: "cover", borderRadius: 4 },
});

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function Paragraphs({ text }: { text: string }) {
  const paras = splitParagraphs(text);
  if (paras.length === 0) return null;
  return (
    <>
      {paras.map((p, i) => (
        <Text key={i} style={styles.para}>
          {p}
        </Text>
      ))}
    </>
  );
}

function ReportPdfDocument({ report }: { report: LoadedReport }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.date}>{formatLongDate(report.report_date)}</Text>
          <Text style={styles.title}>{report.title}</Text>
          <Text style={styles.author}>Par {report.author_name}</Text>
        </View>

        {report.intro && (
          <View style={styles.section}>
            <Text style={styles.h2}>Introduction</Text>
            <Paragraphs text={report.intro} />
          </View>
        )}

        {report.sections.map((s) => (
          <View key={s.id} style={styles.section} wrap={false}>
            <Text style={styles.h2}>{s.title || "Section"}</Text>
            {s.description && <Paragraphs text={s.description} />}
            {s.bullets.length > 0 && (
              <View style={{ marginTop: 4 }}>
                {s.bullets.map((b) => (
                  <View style={styles.bullet} key={b.id}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{b.content}</Text>
                  </View>
                ))}
              </View>
            )}
            {s.images.length > 0 && (
              <View style={styles.imageRow}>
                {s.images.map((img) =>
                  img.url ? (
                    <Image key={img.id} src={img.url} style={styles.image} />
                  ) : null,
                )}
              </View>
            )}
          </View>
        ))}

        {report.conclusion && (
          <View style={styles.section}>
            <Text style={styles.h2}>Conclusion</Text>
            <Paragraphs text={report.conclusion} />
          </View>
        )}

        {report.general_images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.h2}>Images</Text>
            <View style={styles.imageRow}>
              {report.general_images.map((img) =>
                img.url ? <Image key={img.id} src={img.url} style={styles.image} /> : null,
              )}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function inlineReportImages(report: LoadedReport): Promise<LoadedReport> {
  const all = [
    ...report.sections.flatMap((s) => s.images),
    ...report.general_images,
  ];
  const uniqueUrls = Array.from(new Set(all.map((i) => i.url).filter(Boolean)));
  const map = new Map<string, string>();
  await Promise.all(
    uniqueUrls.map(async (u) => {
      const d = await urlToDataUrl(u);
      if (d) map.set(u, d);
    }),
  );
  const rewrite = (u: string) => (u && map.get(u)) || "";
  return {
    ...report,
    sections: report.sections.map((s) => ({
      ...s,
      images: s.images.map((i) => ({ ...i, url: rewrite(i.url) })),
    })),
    general_images: report.general_images.map((i) => ({
      ...i,
      url: rewrite(i.url),
    })),
  };
}

export async function generateReportPdfBlob(report: LoadedReport): Promise<Blob> {
  const prepared = await inlineReportImages(report);
  return await pdf(<ReportPdfDocument report={prepared} />).toBlob();
}

export async function downloadReportPdf(report: LoadedReport) {
  const blob = await generateReportPdfBlob(report);
  const filename = `${sanitize(report.title)}-${report.report_date}.pdf`;
  triggerDownload(blob, filename);
}

export async function downloadReportsBundle(reports: LoadedReport[]) {
  if (reports.length === 0) return;
  if (reports.length === 1) {
    await downloadReportPdf(reports[0]);
    return;
  }
  const merged = await PDFDocument.create();
  for (const r of reports) {
    const blob = await generateReportPdfBlob(r);
    const bytes = await blob.arrayBuffer();
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  const bytes = await merged.save();
  triggerDownload(new Blob([bytes.slice().buffer], { type: "application/pdf" }), "rapports.pdf");
}

function sanitize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "rapport";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function shareReportPdf(report: LoadedReport) {
  const blob = await generateReportPdfBlob(report);
  const file = new File([blob], `${sanitize(report.title)}.pdf`, {
    type: "application/pdf",
  });
  const nav = navigator as any;
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: report.title,
        text: `${report.title} — ${formatLongDate(report.report_date)}`,
      });
      return "shared";
    } catch {
      // user cancelled or unsupported
    }
  }
  triggerDownload(blob, `${sanitize(report.title)}.pdf`);
  return "downloaded";
}
