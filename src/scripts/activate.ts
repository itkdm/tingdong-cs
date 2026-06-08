const DEFAULT_NEXT = '/learn/';

function sanitizeNext(value: string | null) {
	if (!value || !value.startsWith('/learn/') || value === '/learn/') {
		return DEFAULT_NEXT;
	}

	return value;
}

export function initActivationForm() {
	const form = document.querySelector<HTMLFormElement>('[data-activate-form]');

	if (!form) {
		return;
	}

	const params = new URLSearchParams(window.location.search);
	const nextInput = form.querySelector<HTMLInputElement>('[data-next-input]');
	const licenseInput = form.querySelector<HTMLInputElement>('[data-license-input]');
	const feedback = form.querySelector<HTMLElement>('[data-activate-feedback]');
	const submitButton = form.querySelector<HTMLButtonElement>('[data-submit-button]');
	const next = sanitizeNext(params.get('next'));

	if (nextInput) {
		nextInput.value = next;
	}

	form.addEventListener('submit', async (event) => {
		event.preventDefault();

		if (!licenseInput?.value.trim()) {
			setFeedback(feedback, '请输入卡密。', 'error');
			return;
		}

		submitButton?.setAttribute('disabled', 'true');
		setFeedback(feedback, '正在激活，请稍候。', 'pending');

		try {
			const response = await fetch('/api/activate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					licenseKey: licenseInput.value,
					next,
				}),
			});
			const result = await response.json();

			if (!response.ok || !result.ok) {
				setFeedback(feedback, result.message ?? '卡密暂时无法激活，请稍后再试。', 'error');
				return;
			}

			setFeedback(feedback, '激活成功，正在进入学习内容。', 'success');
			window.location.assign(result.next ?? next);
		} catch {
			setFeedback(feedback, '网络暂时不稳定，请稍后再试。', 'error');
		} finally {
			submitButton?.removeAttribute('disabled');
		}
	});
}

function setFeedback(element: HTMLElement | null, message: string, state: 'pending' | 'success' | 'error') {
	if (!element) {
		return;
	}

	element.textContent = message;
	element.dataset.state = state;
}
