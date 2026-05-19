import { renderInlineMarkdown } from './markdown';

export type QuizQuestionType = 'choice' | 'blank';

export interface QuizOption {
	key: string;
	label: string;
	labelHtml: string;
}

export interface QuizQuestion {
	id: string;
	type: QuizQuestionType;
	section: string;
	prompt: string;
	promptHtml: string;
	options: QuizOption[];
	answers: string[];
	explanation: string;
	explanationHtml: string;
}

interface DraftQuestion {
	section: string;
	prompt: string;
	options: QuizOption[];
	answers: string[];
	explanation: string;
}

function stripQuestionNumber(value: string) {
	return value.replace(/^\d+[.、]\s*/, '').trim();
}

function parseAnswers(value: string) {
	return value
		.split(/[、,，/|]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function detectQuestionType(draft: DraftQuestion): QuizQuestionType {
	if (draft.options.length > 0) {
		return 'choice';
	}

	return 'blank';
}

function finalizeQuestion(draft: DraftQuestion | undefined, questions: QuizQuestion[]) {
	if (!draft || !draft.prompt || draft.answers.length === 0) {
		return;
	}

	const type = detectQuestionType(draft);
	const id = `quiz-${questions.length + 1}`;

	questions.push({
		id,
		type,
		section: draft.section,
		prompt: draft.prompt,
		promptHtml: renderInlineMarkdown(draft.prompt),
		options: draft.options,
		answers: draft.answers,
		explanation: draft.explanation,
		explanationHtml: renderInlineMarkdown(draft.explanation),
	});
}

export function parseQuizMarkdown(source: string) {
	const questions: QuizQuestion[] = [];
	const lines = source.replace(/\r\n/g, '\n').split('\n');
	let section = '学习检测';
	let current: DraftQuestion | undefined;

	for (const rawLine of lines) {
		const line = rawLine.trim();

		if (!line) {
			continue;
		}

		if (line.startsWith('## ')) {
			finalizeQuestion(current, questions);
			current = undefined;
			section = line.slice(3).trim();
			continue;
		}

		if (line.startsWith('### ')) {
			finalizeQuestion(current, questions);
			current = {
				section,
				prompt: stripQuestionNumber(line.slice(4)),
				options: [],
				answers: [],
				explanation: '',
			};
			continue;
		}

		if (!current) {
			continue;
		}

		const optionMatch = line.match(/^-\s*([A-Z])\.\s*(.+)$/);
		if (optionMatch) {
			current.options.push({
				key: optionMatch[1],
				label: optionMatch[2],
				labelHtml: renderInlineMarkdown(optionMatch[2]),
			});
			continue;
		}

		const answerMatch = line.match(/^答案[:：]\s*(.+)$/);
		if (answerMatch) {
			current.answers = parseAnswers(answerMatch[1]);
			continue;
		}

		const explanationMatch = line.match(/^解析[:：]\s*(.+)$/);
		if (explanationMatch) {
			current.explanation = explanationMatch[1].trim();
			continue;
		}

		current.explanation = current.explanation ? `${current.explanation} ${line}` : line;
	}

	finalizeQuestion(current, questions);

	return questions;
}
