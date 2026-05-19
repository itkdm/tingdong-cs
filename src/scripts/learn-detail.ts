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

export function initLearnDetail() {
	initTabs();
	initSubtitles();
}
