// Light dismissal for a control's open part (a list, a picker): attach it to
// the element holding both the control and what it opened, while it is open.

import type { Attachment } from 'svelte/attachments';

/** Calls `close` when a pointer goes down, or focus moves, outside the element. */
export function dismissable(close: () => void): Attachment<HTMLElement> {
	return (node) => {
		const outside = (target: EventTarget | null) =>
			target instanceof Node && !node.contains(target);
		const onpointerdown = (event: PointerEvent) => {
			if (outside(event.target)) close();
		};
		const onfocusout = (event: FocusEvent) => {
			if (outside(event.relatedTarget)) close();
		};
		document.addEventListener('pointerdown', onpointerdown, true);
		node.addEventListener('focusout', onfocusout);
		return () => {
			document.removeEventListener('pointerdown', onpointerdown, true);
			node.removeEventListener('focusout', onfocusout);
		};
	};
}
