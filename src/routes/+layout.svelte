<script>
	import { onNavigate } from '$app/navigation';
	import '../app.css';

	let { children } = $props();

	// Match nellwatson.com's soft cross-fade for client-side SvelteKit navigation.
	onNavigate((navigation) => {
		if (
			typeof document === 'undefined' ||
			!document.startViewTransition ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

</script>

{@render children()}
