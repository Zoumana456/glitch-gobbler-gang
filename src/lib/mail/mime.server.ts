import type { OutgoingMessage } from "./gateway.server";

/** Construit un message MIME (RFC 822) prêt à être envoyé via l'API Gmail. */
export function buildMime(msg: OutgoingMessage): string {
  const boundary = `db_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const from = msg.from.name
    ? `${encodeHeader(msg.from.name)} <${msg.from.address}>`
    : msg.from.address;

  const headers = [
    `From: ${from}`,
    `To: ${msg.to.join(", ")}`,
    ...(msg.cc?.length ? [`Cc: ${msg.cc.join(", ")}`] : []),
    ...(msg.bcc?.length ? [`Bcc: ${msg.bcc.join(", ")}`] : []),
    `Subject: ${encodeHeader(msg.subject)}`,
    "MIME-Version: 1.0",
  ];

  const attachments = msg.attachments ?? [];
  if (!attachments.length) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    return `${headers.join("\r\n")}\r\n\r\n${msg.html}`;
  }

  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  const parts = [
    `--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${msg.html}`,
    ...attachments.map(
      (a) =>
        `--${boundary}\r\nContent-Type: ${a.contentType}; name="${a.filename}"\r\n` +
        `Content-Disposition: attachment; filename="${a.filename}"\r\n` +
        `Content-Transfer-Encoding: base64\r\n\r\n${chunk(a.content)}`,
    ),
  ];
  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}\r\n--${boundary}--`;
}

function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /[^\u0000-\u007f]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
    : value;
}

function chunk(base64: string): string {
  return (base64.match(/.{1,76}/g) ?? []).join("\r\n");
}

export function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}
