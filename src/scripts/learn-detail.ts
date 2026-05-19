const ACTIVE_CLASS = 'is-active';

function initSubtitles() {
	const lines = [...document.querySelectorAll<HTMLButtonElement>('[data-subtitle-line]')];

	lines.forEach((line) => {
		line.addEventListener('click', () => {
			lines.forEach((item) => item.classList.toggle(ACTIVE_CLASS, item === line));
		});
	});
}

function initTabs() {
	const tabButtons = document.querySelectorAll<HTMLButtonElement>('[data-tab-target]');
	const panels = document.querySelectorAll<HTMLElement>('.tab-panel');

	tabButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const targetId = button.dataset.tabTarget;

			tabButtons.forEach((item) => {
				const isActive = item === button;
				item.classList.toggle(ACTIVE_CLASS, isActive);
				item.setAttribute('aria-selected', String(isActive));
			});

			panels.forEach((panel) => {
				const isActive = panel.id === targetId;
				panel.classList.toggle(ACTIVE_CLASS, isActive);
				panel.hidden = !isActive;
			});
		});
	});
}

function normalizeAnswer(value: string) {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getAnswers(question: HTMLElement) {
	const rawAnswers = question.dataset.quizAnswers ?? '[]';

	try {
		return (JSON.parse(rawAnswers) as string[]).map(normalizeAnswer);
	} catch {
		return [];
	}
}

function showQuizResult(question: HTMLElement, isCorrect: boolean) {
	const feedback = question.querySelector<HTMLElement>('[data-quiz-feedback]');
	const explanation = question.querySelector<HTMLElement>('[data-quiz-explanation]');

	question.classList.toggle('is-correct', isCorrect);
	question.classList.toggle('is-wrong', !isCorrect);

	if (feedback) {
		feedback.textContent = isCorrect ? '答对了，这个表达你已经抓住了。' : '还差一点，看看解析再回到原句里想一遍。';
	}

	if (explanation) {
		explanation.hidden = false;
	}
}

function initQuiz() {
	const questions = document.querySelectorAll<HTMLElement>('[data-quiz-question]');

	questions.forEach((question) => {
		const answers = getAnswers(question);

		question.querySelectorAll<HTMLButtonElement>('[data-quiz-option]').forEach((option) => {
			option.addEventListener('click', () => {
				const selected = option.dataset.quizOption ?? '';
				const isCorrect = answers.includes(normalizeAnswer(selected));

				question.querySelectorAll<HTMLButtonElement>('[data-quiz-option]').forEach((item) => {
					item.classList.toggle('is-selected', item === option);
				});

				showQuizResult(question, isCorrect);
			});
		});

		const input = question.querySelector<HTMLInputElement>('[data-quiz-input]');
		const checkButton = question.querySelector<HTMLButtonElement>('[data-quiz-check]');

		checkButton?.addEventListener('click', () => {
			const isCorrect = answers.includes(normalizeAnswer(input?.value ?? ''));
			showQuizResult(question, isCorrect);
		});

		input?.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				checkButton?.click();
			}
		});
	});
}

export function initLearnDetail() {
	initTabs();
	initSubtitles();
	initQuiz();
}
