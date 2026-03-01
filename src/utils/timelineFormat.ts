export interface TimelineNotesFormat {
  displayNotes: string;
  systemSummary?: string;
}

const PREFIXES = ['LEV_START|', 'LEV_PEAK|', 'LEV_USE|', 'LEV_END|'];

function formatClock(dateIso: string): string | null {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

function parseSystemSummary(line: string): string | undefined {
  const firstLine = line.split('\n')[0] ?? line;
  const parts = firstLine.split('|');
  const isoTime = parts[1] ? formatClock(parts[1]) : null;

  if (firstLine.startsWith('LEV_START|')) {
    if (parts.length < 4 || parts[2] !== 'READY_BY') {
      return 'Levain started';
    }
    const readyBy = parts[3] ? formatClock(parts[3]) : null;
    if (readyBy) {
      return `Levain started • Ready by ${readyBy}`;
    }
    return 'Levain started';
  }
  if (firstLine.startsWith('LEV_PEAK|')) {
    const rawHours = parts[3];
    const hoursNumber = rawHours != null ? Number(rawHours) : NaN;
    const hours = Number.isFinite(hoursNumber)
      ? `${Math.round(hoursNumber * 100) / 100}h`
      : null;
    if (hours && isoTime) {
      return `Peak confirmed • ${hours} • ${isoTime}`;
    }
    if (hours) {
      return `Peak confirmed • ${hours}`;
    }
    return isoTime ? `Peak confirmed • ${isoTime}` : 'Peak confirmed';
  }
  if (firstLine.startsWith('LEV_USE|')) {
    const recipe = parts.slice(3).join('|').trim();
    if (recipe && recipe !== 'unknown') {
      return isoTime ? `Levain used • ${recipe} • ${isoTime}` : `Levain used • ${recipe}`;
    }
    return isoTime ? `Levain used • ${isoTime}` : 'Levain used';
  }
  if (firstLine.startsWith('LEV_END|')) {
    const end = new Date(parts[1]);
    const start = new Date(parts[3]);
    if (
      parts[2] !== 'START' ||
      Number.isNaN(end.getTime()) ||
      Number.isNaN(start.getTime())
    ) {
      return 'Levain session ended';
    }
    const durationMs = end.getTime() - start.getTime();
    if (durationMs <= 0) {
      return 'Levain session ended';
    }
    return `Levain session ended • ${formatDuration(durationMs)}`;
  }
  return undefined;
}

export function formatTimelineNotes(notes: string): TimelineNotesFormat {
  const lines = notes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const metadataLines = lines.filter((line) =>
    PREFIXES.some((prefix) => line.startsWith(prefix))
  );
  const userLines = lines.filter(
    (line) => !PREFIXES.some((prefix) => line.startsWith(prefix))
  );

  let systemSummary: string | undefined;
  if (metadataLines.length > 0) {
    systemSummary = parseSystemSummary(metadataLines[0]);
  }

  return {
    displayNotes: userLines.join('\n').trim(),
    systemSummary,
  };
}
