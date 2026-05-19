export type SubtitleLine = {
	index: number;
	start: string;
	end: string;
	startSeconds: number;
	endSeconds: number;
	text: string;
};

function timeToSeconds(value: string) {
	const [time, milliseconds = '0'] = value.split(',');
	const [hours = '0', minutes = '0', seconds = '0'] = time.split(':');

	return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(milliseconds) / 1000;
}

export function parseSrt(source: string): SubtitleLine[] {
	return source
		.trim()
		.split(/\r?\n\r?\n/)
		.map((block) => {
			const [rawIndex, rawTime, ...textLines] = block.split(/\r?\n/);
			const [start = '', end = ''] = rawTime?.split(/\s+-->\s+/) ?? [];

			return {
				index: Number(rawIndex),
				start,
				end,
				startSeconds: timeToSeconds(start),
				endSeconds: timeToSeconds(end),
				text: textLines.join('\n'),
			};
		})
		.filter((line) => Number.isFinite(line.index) && line.start && line.text);
}

export function formatSubtitleTime(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	const rest = Math.floor(seconds % 60);

	return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
