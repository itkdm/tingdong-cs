function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function renderInlineMarkdown(value: string) {
	return escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function flushList(html: string[], listItems: string[]) {
	if (listItems.length === 0) {
		return;
	}

	html.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`);
	listItems.length = 0;
}

export function renderSimpleMarkdown(source: string) {
	const html: string[] = [];
	const listItems: string[] = [];
	const lines = source.replace(/\r\n/g, '\n').split('\n');

	for (const rawLine of lines) {
		const line = rawLine.trim();

		if (!line) {
			flushList(html, listItems);
			continue;
		}

		if (line.startsWith('## ')) {
			flushList(html, listItems);
			html.push(`<h2>${renderInlineMarkdown(line.slice(3))}</h2>`);
			continue;
		}

		if (line.startsWith('### ')) {
			flushList(html, listItems);
			html.push(`<h3>${renderInlineMarkdown(line.slice(4))}</h3>`);
			continue;
		}

		if (line.startsWith('> ')) {
			flushList(html, listItems);
			html.push(`<blockquote><p>${renderInlineMarkdown(line.slice(2))}</p></blockquote>`);
			continue;
		}

		if (line.startsWith('- ')) {
			listItems.push(renderInlineMarkdown(line.slice(2)));
			continue;
		}

		flushList(html, listItems);
		html.push(`<p>${renderInlineMarkdown(line)}</p>`);
	}

	flushList(html, listItems);

	return html.join('\n');
}
