import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implizites TLS, 587/25 = STARTTLS
    auth: { user, pass },
  });
}

/**
 * Verschickt den Login-Code an die fest konfigurierte Organisator-Adresse.
 * Ohne konfigurierte SMTP_*-Variablen (z.B. in der lokalen Entwicklung)
 * wird der Code stattdessen ins Server-Log geschrieben, damit der
 * Login-Flow auch ohne echten Email-Versand getestet werden kann.
 */
export async function sendLoginCodeEmail(code: string): Promise<void> {
  const to = process.env.ADMIN_EMAIL;
  if (!to) {
    throw new Error("ADMIN_EMAIL ist nicht gesetzt (siehe .env.example).");
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const transporter = getTransporter();
  if (!transporter) {
    // Nur ausserhalb von Produktion: dort MUSS SMTP korrekt konfiguriert
    // sein, sonst würde der Login-Code im Server-Log landen statt sicher
    // per Email verschickt zu werden.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SMTP_HOST, SMTP_USER und SMTP_PASSWORD müssen in Produktion gesetzt sein (siehe .env.example).",
      );
    }
    console.log(
      `[email] SMTP nicht konfiguriert — Login-Code für ${to}: ${code}`,
    );
    return;
  }

  await transporter.sendMail({
    to,
    from,
    subject: `${code} — dein Login-Code für Commander`,
    text: [
      "Dein Login-Code (10 Minuten gültig):",
      "",
      code,
      "",
      "Gib ihn im Browser ein, in dem du den Login gestartet hast.",
      "Falls du das nicht angefordert hast, ignoriere diese Email einfach.",
    ].join("\n"),
    html: `
      <p>Dein Login-Code (10&nbsp;Minuten gültig):</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;font-family:monospace">${code}</p>
      <p>Gib ihn im Browser ein, in dem du den Login gestartet hast.</p>
      <p>Falls du das nicht angefordert hast, ignoriere diese Email einfach.</p>
    `,
  });
}
