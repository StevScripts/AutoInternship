export async function computeFingerprint(
  company: string,
  title: string,
  location: string | null
): Promise<string> {
  const normalized = [
    company.toLowerCase().trim().replace(/\s+/g, " "),
    title.toLowerCase().trim().replace(/\s+/g, " "),
    (location || "unknown").toLowerCase().trim().replace(/\s+/g, " "),
  ].join("|");

  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
