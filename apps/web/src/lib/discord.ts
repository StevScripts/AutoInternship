interface DiscordDigestOptions {
  jobsFound: number;
  jobsMatched: number;
  jobsPending: number;
  appUrl: string;
}

export async function sendDiscordDigest({
  jobsFound,
  jobsMatched,
  jobsPending,
  appUrl,
}: DiscordDigestOptions): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const embed = {
    title: "AutoInternship Update",
    color: 0x33ccaa, // teal-green accent
    fields: [
      { name: "Jobs Found", value: String(jobsFound), inline: true },
      { name: "Matched", value: String(jobsMatched), inline: true },
      { name: "Pending Approval", value: String(jobsPending), inline: true },
    ],
    description: jobsMatched > 0
      ? `[Review in AutoInternship](${appUrl})`
      : "No new matches this run.",
    timestamp: new Date().toISOString(),
    footer: { text: "AutoInternship" },
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
}
