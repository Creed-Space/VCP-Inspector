<script lang="ts">
	import { parseToken, type ParsedToken } from '$lib/vcp/token-parser';
	import { parseCSM1, encodeCSM1, PERSONAS, SCOPES, type ParsedCSM1 } from '$lib/vcp/csm1-parser';
	import { EXTENSIONS, generateHello, generateAck, type VCPHello } from '$lib/vcp/capability';
	import { EXAMPLES, type Example } from '$lib/vcp/examples';

	// Tab state
	let activeTab = $state<'decode' | 'encode' | 'capability' | 'examples'>('decode');

	// --- Decode Tab ---
	let decodeInput = $state('');
	let decodeResult = $state<{ type: 'token'; data: ParsedToken } | { type: 'csm1'; data: ParsedCSM1 } | null>(null);
	let decodeError = $state('');

	function doDecode() {
		decodeError = '';
		decodeResult = null;
		if (!decodeInput.trim()) return;

		// Try VCP/I token first
		const tokenResult = parseToken(decodeInput);
		if (tokenResult.ok) {
			decodeResult = { type: 'token', data: tokenResult.token };
			return;
		}

		// Try CSM-1
		const csm1Result = parseCSM1(decodeInput);
		if (csm1Result.ok) {
			decodeResult = { type: 'csm1', data: csm1Result.code };
			return;
		}

		decodeError = `Could not parse as VCP/I token or CSM-1 code. Token error: ${tokenResult.error.message}`;
	}

	// --- Encode Tab ---
	let selectedPersona = $state('N');
	let adherenceLevel = $state(3);
	let selectedScopes = $state<Record<string, boolean>>({});
	let encodeNamespace = $state('');
	let encodeVersion = $state('');

	let encodedPreview = $derived.by(() => {
		const scopeChars = Object.entries(selectedScopes)
			.filter(([, v]) => v)
			.map(([k]) => k);
		return encodeCSM1(selectedPersona, adherenceLevel, scopeChars, encodeNamespace.trim(), encodeVersion.trim());
	});

	// --- Capability Tab ---
	let selectedExtensions = $state<Record<string, boolean>>({});

	let helloMessage = $derived.by(() => {
		const exts = Object.entries(selectedExtensions)
			.filter(([, v]) => v)
			.map(([k]) => k);
		return generateHello(exts);
	});

	let ackMessage = $derived.by(() => {
		return generateAck(helloMessage);
	});

	// --- Examples Tab ---
	function loadExample(example: Example) {
		if (example.type === 'token') {
			activeTab = 'decode';
			decodeInput = example.value;
			doDecode();
		} else {
			activeTab = 'decode';
			decodeInput = example.value;
			doDecode();
		}
	}

	const LEVEL_LABELS: Record<number, string> = {
		0: 'Disabled',
		1: 'Minimal',
		2: 'Light',
		3: 'Moderate',
		4: 'Strict',
		5: 'Maximum'
	};

	const TAB_ITEMS = [
		{ id: 'decode' as const, label: 'Decode' },
		{ id: 'encode' as const, label: 'Encode' },
		{ id: 'capability' as const, label: 'Capability' },
		{ id: 'examples' as const, label: 'Examples' }
	];
</script>

<svelte:head>
	<title>VCP Inspector</title>
	<meta name="description" content="Debug and inspect VCP tokens and CSM-1 constitutional codes" />
</svelte:head>

<div class="min-h-screen bg-gray-950 text-gray-100">
	<!-- Header -->
	<header class="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
		<div class="mx-auto max-w-4xl px-4 py-4">
			<h1 class="text-xl font-semibold text-white">VCP Inspector</h1>
			<p class="mt-1 text-sm text-gray-400">Debug VCP/I tokens, CSM-1 codes, and capability negotiation</p>
		</div>
	</header>

	<!-- Tab Navigation -->
	<nav class="border-b border-gray-800 bg-gray-900/50">
		<div class="mx-auto max-w-4xl px-4">
			<div class="flex gap-1">
				{#each TAB_ITEMS as tab}
					<button
						class="px-4 py-3 text-sm font-medium transition-colors {activeTab === tab.id
							? 'border-b-2 border-blue-500 text-blue-400'
							: 'text-gray-400 hover:text-gray-200'}"
						onclick={() => (activeTab = tab.id)}
					>
						{tab.label}
					</button>
				{/each}
			</div>
		</div>
	</nav>

	<!-- Tab Content -->
	<main class="mx-auto max-w-4xl px-4 py-6">
		<!-- Decode Tab -->
		{#if activeTab === 'decode'}
			<div class="space-y-4">
				<div>
					<label for="decode-input" class="mb-2 block text-sm font-medium text-gray-300">
						Paste a VCP/I token or CSM-1 code
					</label>
					<div class="flex gap-2">
						<input
							id="decode-input"
							type="text"
							class="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							placeholder="e.g. family.safe.guide@1.2.0:SEC or N5+F+E"
							bind:value={decodeInput}
							onkeydown={(e) => e.key === 'Enter' && doDecode()}
						/>
						<button
							class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							onclick={doDecode}
						>
							Decode
						</button>
					</div>
				</div>

				{#if decodeError}
					<div class="rounded-lg border border-red-800 bg-red-950/50 p-4">
						<p class="text-sm text-red-400">{decodeError}</p>
					</div>
				{/if}

				{#if decodeResult?.type === 'token'}
					{@const t = decodeResult.data}
					<div class="space-y-3">
						<h3 class="text-lg font-medium text-white">VCP/I Token</h3>
						<div class="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
							<!-- Syntax highlighted token -->
							<div class="mb-4 font-mono text-lg">
								{#each t.segments as seg, i}
									{#if i > 0}<span class="text-gray-500">.</span>{/if}
									<span
										class={i === 0
											? 'text-blue-400'
											: i === t.segments.length - 1
												? 'text-green-400'
												: i === t.segments.length - 2
													? 'text-yellow-400'
													: 'text-purple-400'}>{seg}</span
									>
								{/each}
								{#if t.version}<span class="text-gray-500">@</span><span class="text-orange-400"
										>{t.version}</span
									>{/if}
								{#if t.namespace}<span class="text-gray-500">:</span><span class="text-pink-400"
										>{t.namespace}</span
									>{/if}
							</div>

							<!-- Breakdown table -->
							<table class="w-full text-sm">
								<tbody>
									<tr class="border-b border-gray-700">
										<td class="py-2 pr-4 font-medium text-gray-400">Domain</td>
										<td class="py-2 text-blue-400">{t.domain}</td>
									</tr>
									{#if t.path.length > 0}
										<tr class="border-b border-gray-700">
											<td class="py-2 pr-4 font-medium text-gray-400">Path</td>
											<td class="py-2 text-purple-400">{t.path.join(' > ')}</td>
										</tr>
									{/if}
									<tr class="border-b border-gray-700">
										<td class="py-2 pr-4 font-medium text-gray-400">Approach</td>
										<td class="py-2 text-yellow-400">{t.approach}</td>
									</tr>
									<tr class="border-b border-gray-700">
										<td class="py-2 pr-4 font-medium text-gray-400">Role</td>
										<td class="py-2 text-green-400">{t.role}</td>
									</tr>
									<tr class="border-b border-gray-700">
										<td class="py-2 pr-4 font-medium text-gray-400">Version</td>
										<td class="py-2 text-orange-400">{t.version ?? '(none)'}</td>
									</tr>
									<tr class="border-b border-gray-700">
										<td class="py-2 pr-4 font-medium text-gray-400">Namespace</td>
										<td class="py-2 text-pink-400">{t.namespace ?? '(none)'}</td>
									</tr>
									<tr class="border-b border-gray-700">
										<td class="py-2 pr-4 font-medium text-gray-400">Depth</td>
										<td class="py-2">{t.depth} segments</td>
									</tr>
									<tr class="border-b border-gray-700">
										<td class="py-2 pr-4 font-medium text-gray-400">Canonical</td>
										<td class="py-2 font-mono text-gray-300">{t.canonical}</td>
									</tr>
									<tr>
										<td class="py-2 pr-4 font-medium text-gray-400">URI</td>
										<td class="py-2 font-mono text-gray-300">{t.uri}</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				{/if}

				{#if decodeResult?.type === 'csm1'}
					{@const c = decodeResult.data}
					<div class="space-y-3">
						<h3 class="text-lg font-medium text-white">CSM-1 Code</h3>
						<div class="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
							<!-- Syntax highlighted code -->
							<div class="mb-4 font-mono text-lg">
								<span class="text-blue-400">{c.persona.char}</span><span class="text-yellow-400"
									>{c.level}</span
								>
								{#each c.scopes as scope}
									<span class="text-gray-500">+</span><span class="text-green-400">{scope.char}</span
									>
								{/each}
								{#if c.namespace}<span class="text-gray-500">:</span><span class="text-pink-400"
										>{c.namespace}</span
									>{/if}
								{#if c.version}<span class="text-gray-500">@</span><span class="text-orange-400"
										>{c.version}</span
									>{/if}
							</div>

							<table class="w-full text-sm">
								<tbody>
									<tr class="border-b border-gray-700">
										<td class="py-2 pr-4 font-medium text-gray-400">Persona</td>
										<td class="py-2">
											<span class="text-blue-400">{c.persona.name}</span>
											<span class="ml-2 text-gray-500">- {c.persona.description}</span>
										</td>
									</tr>
									<tr class="border-b border-gray-700">
										<td class="py-2 pr-4 font-medium text-gray-400">Level</td>
										<td class="py-2">
											<span class="text-yellow-400">{c.level}/5</span>
											<span class="ml-2 text-gray-500"
												>({LEVEL_LABELS[c.level] ?? 'Unknown'})</span
											>
											{#if c.isMaximum}
												<span
													class="ml-2 rounded bg-red-900/50 px-1.5 py-0.5 text-xs text-red-400"
													>MAX</span
												>
											{/if}
											{#if !c.isActive}
												<span
													class="ml-2 rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-400"
													>DISABLED</span
												>
											{/if}
										</td>
									</tr>
									<tr class="border-b border-gray-700">
										<td class="py-2 pr-4 font-medium text-gray-400">Scopes</td>
										<td class="py-2">
											{#if c.scopes.length === 0}
												<span class="text-gray-500">(all scopes)</span>
											{:else}
												<div class="flex flex-wrap gap-1.5">
													{#each c.scopes as scope}
														<span
															class="rounded bg-green-900/40 px-2 py-0.5 text-xs text-green-400"
															>{scope.name} ({scope.char})</span
														>
													{/each}
												</div>
											{/if}
										</td>
									</tr>
									<tr class="border-b border-gray-700">
										<td class="py-2 pr-4 font-medium text-gray-400">Namespace</td>
										<td class="py-2 text-pink-400">{c.namespace ?? '(none)'}</td>
									</tr>
									<tr>
										<td class="py-2 pr-4 font-medium text-gray-400">Version</td>
										<td class="py-2 text-orange-400">{c.version ?? '(none)'}</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			</div>

		<!-- Encode Tab -->
		{:else if activeTab === 'encode'}
			<div class="space-y-6">
				<h3 class="text-lg font-medium text-white">Build a CSM-1 Code</h3>

				<!-- Live Preview -->
				<div class="rounded-lg border border-blue-800 bg-blue-950/30 p-4">
					<div class="mb-1 text-xs font-medium tracking-wider text-blue-400 uppercase">Live Preview</div>
					<div class="font-mono text-2xl text-white">{encodedPreview}</div>
				</div>

				<!-- Persona Picker -->
				<div>
					<span class="mb-2 block text-sm font-medium text-gray-300">Persona</span>
					<div class="grid grid-cols-4 gap-2">
						{#each Object.entries(PERSONAS) as [char, info]}
							<button
								class="rounded-lg border p-3 text-left text-sm transition-colors {selectedPersona === char
									? 'border-blue-500 bg-blue-950/50 text-blue-300'
									: 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'}"
								onclick={() => (selectedPersona = char)}
							>
								<div class="font-mono text-lg font-bold">{char}</div>
								<div class="text-xs">{info.name}</div>
							</button>
						{/each}
					</div>
					<p class="mt-1 text-xs text-gray-500">
						{PERSONAS[selectedPersona]?.description ?? ''}
					</p>
				</div>

				<!-- Adherence Level -->
				<div>
					<label for="level-slider" class="mb-2 block text-sm font-medium text-gray-300">
						Adherence Level: <span class="text-yellow-400">{adherenceLevel}</span>
						<span class="ml-1 text-gray-500">({LEVEL_LABELS[adherenceLevel]})</span>
					</label>
					<input
						id="level-slider"
						type="range"
						min="0"
						max="5"
						step="1"
						class="w-full accent-blue-500"
						bind:value={adherenceLevel}
					/>
					<div class="mt-1 flex justify-between text-xs text-gray-500">
						<span>0 Disabled</span>
						<span>1</span>
						<span>2</span>
						<span>3</span>
						<span>4</span>
						<span>5 Maximum</span>
					</div>
				</div>

				<!-- Scope Checkboxes -->
				<div>
					<span class="mb-2 block text-sm font-medium text-gray-300">Scopes</span>
					<div class="grid grid-cols-3 gap-2">
						{#each Object.entries(SCOPES) as [char, info]}
							<label
								class="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 p-2.5 text-sm hover:border-gray-600"
							>
								<input
									type="checkbox"
									class="rounded accent-green-500"
									bind:checked={selectedScopes[char]}
								/>
								<span class="font-mono text-green-400">{char}</span>
								<span class="text-gray-300">{info.name}</span>
							</label>
						{/each}
					</div>
				</div>

				<!-- Namespace -->
				<div>
					<label for="encode-namespace" class="mb-2 block text-sm font-medium text-gray-300">
						Namespace <span class="text-gray-500">(optional)</span>
					</label>
					<input
						id="encode-namespace"
						type="text"
						class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm uppercase text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						placeholder="e.g. SEC, ELEM"
						bind:value={encodeNamespace}
					/>
				</div>

				<!-- Version -->
				<div>
					<label for="encode-version" class="mb-2 block text-sm font-medium text-gray-300">
						Version <span class="text-gray-500">(optional)</span>
					</label>
					<input
						id="encode-version"
						type="text"
						class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						placeholder="e.g. 1.0.0"
						bind:value={encodeVersion}
					/>
				</div>
			</div>

		<!-- Capability Tab -->
		{:else if activeTab === 'capability'}
			<div class="space-y-6">
				<h3 class="text-lg font-medium text-white">VCP Capability Negotiation</h3>
				<p class="text-sm text-gray-400">
					Select supported extensions to simulate a VCP-Hello / VCP-Ack handshake (v3.1.0).
				</p>

				<!-- Extension Selection -->
				<div>
					<span class="mb-2 block text-sm font-medium text-gray-300">Extensions</span>
					<div class="space-y-2">
						{#each EXTENSIONS as ext}
							<label
								class="flex items-start gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3 hover:border-gray-600"
							>
								<input
									type="checkbox"
									class="mt-0.5 rounded accent-blue-500"
									bind:checked={selectedExtensions[ext.id]}
								/>
								<div>
									<div class="text-sm font-medium text-white">{ext.id}</div>
									<div class="text-xs text-gray-400">{ext.description}</div>
								</div>
							</label>
						{/each}
					</div>
				</div>

				<!-- VCP-Hello -->
				<div>
					<h4 class="mb-2 text-sm font-medium text-gray-300">VCP-Hello (Client)</h4>
					<pre
						class="overflow-x-auto rounded-lg border border-gray-700 bg-gray-900 p-4 text-xs text-green-400">{JSON.stringify(helloMessage, null, 2)}</pre>
				</div>

				<!-- VCP-Ack -->
				<div>
					<h4 class="mb-2 text-sm font-medium text-gray-300">VCP-Ack (Server)</h4>
					<pre
						class="overflow-x-auto rounded-lg border border-gray-700 bg-gray-900 p-4 text-xs text-blue-400">{JSON.stringify(ackMessage, null, 2)}</pre>
				</div>
			</div>

		<!-- Examples Tab -->
		{:else if activeTab === 'examples'}
			<div class="space-y-4">
				<h3 class="text-lg font-medium text-white">Example Tokens and Codes</h3>
				<p class="text-sm text-gray-400">Click any example to load it into the Decode tab.</p>

				<div class="space-y-2">
					{#each EXAMPLES as example}
						<button
							class="w-full rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-left transition-colors hover:border-gray-600 hover:bg-gray-800"
							onclick={() => loadExample(example)}
						>
							<div class="flex items-center justify-between">
								<div>
									<div class="text-sm font-medium text-white">{example.label}</div>
									<div class="mt-0.5 text-xs text-gray-400">{example.description}</div>
								</div>
								<div class="flex items-center gap-2">
									<span
										class="rounded px-2 py-0.5 text-xs font-medium {example.type === 'token'
											? 'bg-blue-900/50 text-blue-400'
											: 'bg-green-900/50 text-green-400'}"
									>
										{example.type === 'token' ? 'VCP/I' : 'CSM-1'}
									</span>
									<code class="font-mono text-sm text-gray-300">{example.value}</code>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="border-t border-gray-800 py-4 text-center text-xs text-gray-500">
		VCP Inspector v0.1.0 &mdash; Value-Context Protocol v3.1.0 &mdash; Creed Space
	</footer>
</div>
