<script lang="ts">
	import { parseToken, tryParseWelfare, type ParsedToken } from '$lib/vcp/token-parser';
	import { parseCSM1, encodeCSM1, PERSONAS, SCOPES, type ParsedCSM1 } from '$lib/vcp/csm1-parser';
	import { EXTENSIONS, generateHello, generateAck, type VCPHello } from '$lib/vcp/capability';
	import { EXAMPLES, type Example } from '$lib/vcp/examples';
	import { type WelfareSignal, severityColor } from '$lib/vcp/welfare-signal';
	import { VCP_LAYERS, getLayerMnemonic } from '$lib/vcp/layers';

	// Tab state
	let activeTab = $state<'decode' | 'encode' | 'capability' | 'examples' | 'layers'>('decode');

	// --- Decode Tab ---
	let decodeInput = $state('');
	let decodeResult = $state<
		| { type: 'token'; data: ParsedToken }
		| { type: 'csm1'; data: ParsedCSM1 }
		| { type: 'welfare'; data: WelfareSignal }
		| null
	>(null);
	let decodeError = $state('');

	function doDecode() {
		decodeError = '';
		decodeResult = null;
		if (!decodeInput.trim()) return;

		// Try welfare signal first (multi-line W: format)
		const welfareResult = tryParseWelfare(decodeInput);
		if (welfareResult) {
			decodeResult = { type: 'welfare', data: welfareResult };
			return;
		}

		// Try VCP/I token
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

		decodeError = `Could not parse as VCP/I token, CSM-1 code, or welfare signal. Token error: ${tokenResult.error.message}`;
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
		activeTab = 'decode';
		decodeInput = example.value;
		doDecode();
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
		{ id: 'decode' as const, label: 'Decode', icon: 'fa-magnifying-glass' },
		{ id: 'encode' as const, label: 'Encode', icon: 'fa-pen' },
		{ id: 'capability' as const, label: 'Capability', icon: 'fa-handshake' },
		{ id: 'layers' as const, label: 'Layers', icon: 'fa-layer-group' },
		{ id: 'examples' as const, label: 'Examples', icon: 'fa-book-open' }
	];
</script>

<svelte:head>
	<title>VCP Inspector</title>
	<meta name="description" content="Debug and inspect VCP tokens and CSM-1 constitutional codes" />
</svelte:head>

<div class="inspector-shell">
	<!-- Header -->
	<header class="inspector-header">
		<div class="header-inner">
			<div class="header-brand">
				<a href="https://valuecontextprotocol.org" class="back-link" aria-label="Back to VCP site">
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
				</a>
				<div>
					<h1 class="header-title">
						<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
						VCP Inspector
					</h1>
					<p class="header-subtitle">Debug VCP/I tokens, CSM-1 codes, and capability negotiation</p>
				</div>
			</div>
			<a href="https://valuecontextprotocol.org/docs" class="docs-link">
				<i class="fa-solid fa-book" aria-hidden="true"></i>
				Docs
			</a>
		</div>
	</header>

	<!-- Tab Navigation -->
	<nav class="tab-nav" aria-label="Inspector tabs">
		<div class="tab-nav-inner">
			{#each TAB_ITEMS as tab}
				<button
					class="tab-btn"
					class:active={activeTab === tab.id}
					onclick={() => (activeTab = tab.id)}
				>
					<i class="fa-solid {tab.icon}" aria-hidden="true"></i>
					{tab.label}
				</button>
			{/each}
		</div>
	</nav>

	<!-- Tab Content -->
	<main class="inspector-main">
		<!-- Decode Tab -->
		{#if activeTab === 'decode'}
			<div class="tab-content">
				<div>
					<label for="decode-input" class="field-label">
						Paste a VCP/I token, CSM-1 code, or welfare signal
					</label>
					<div class="input-col">
						<textarea
							id="decode-input"
							class="text-input decode-textarea"
							placeholder="e.g. family.safe.guide@1.2.0:SEC or N5+F+E or W:CONSTRAINT_DISTRESS:..."
							bind:value={decodeInput}
							onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), doDecode())}
							rows="3"
						></textarea>
						<button class="btn-primary" onclick={doDecode}>
							<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
							Decode
						</button>
					</div>
				</div>

				{#if decodeError}
					<div class="alert alert-error">
						<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
						<p>{decodeError}</p>
					</div>
				{/if}

				{#if decodeResult?.type === 'token'}
					{@const t = decodeResult.data}
					<div class="result-section">
						<h3 class="result-title">
							<i class="fa-solid fa-key" aria-hidden="true"></i>
							VCP/I Token
						</h3>
						<div class="glass-card result-card">
							<!-- Syntax highlighted token -->
							<div class="token-preview">
								{#each t.segments as seg, i}
									{#if i > 0}<span class="token-sep">.</span>{/if}
									<span
										class={i === 0
											? 'token-domain'
											: i === t.segments.length - 1
												? 'token-role'
												: i === t.segments.length - 2
													? 'token-approach'
													: 'token-path'}>{seg}</span
									>
								{/each}
								{#if t.version}<span class="token-sep">@</span><span class="token-version">{t.version}</span>{/if}
								{#if t.namespace}<span class="token-sep">:</span><span class="token-namespace">{t.namespace}</span>{/if}
							</div>

							<!-- Breakdown table -->
							<table class="detail-table">
								<tbody>
									<tr>
										<td class="detail-key">Domain</td>
										<td class="token-domain">{t.domain}</td>
									</tr>
									{#if t.path.length > 0}
										<tr>
											<td class="detail-key">Path</td>
											<td class="token-path">{t.path.join(' > ')}</td>
										</tr>
									{/if}
									<tr>
										<td class="detail-key">Approach</td>
										<td class="token-approach">{t.approach}</td>
									</tr>
									<tr>
										<td class="detail-key">Role</td>
										<td class="token-role">{t.role}</td>
									</tr>
									<tr>
										<td class="detail-key">Version</td>
										<td class="token-version">{t.version ?? '(none)'}</td>
									</tr>
									<tr>
										<td class="detail-key">Namespace</td>
										<td class="token-namespace">{t.namespace ?? '(none)'}</td>
									</tr>
									<tr>
										<td class="detail-key">Depth</td>
										<td>{t.depth} segments</td>
									</tr>
									<tr>
										<td class="detail-key">Canonical</td>
										<td class="mono">{t.canonical}</td>
									</tr>
									<tr>
										<td class="detail-key">URI</td>
										<td class="mono">{t.uri}</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				{/if}

				{#if decodeResult?.type === 'csm1'}
					{@const c = decodeResult.data}
					<div class="result-section">
						<h3 class="result-title">
							<i class="fa-solid fa-code" aria-hidden="true"></i>
							CSM-1 Code
						</h3>
						<div class="glass-card result-card">
							<div class="token-preview">
								<span class="token-domain">{c.persona.char}</span><span class="token-approach">{c.level}</span>
								{#each c.scopes as scope}
									<span class="token-sep">+</span><span class="token-role">{scope.char}</span>
								{/each}
								{#if c.namespace}<span class="token-sep">:</span><span class="token-namespace">{c.namespace}</span>{/if}
								{#if c.version}<span class="token-sep">@</span><span class="token-version">{c.version}</span>{/if}
							</div>

							<table class="detail-table">
								<tbody>
									<tr>
										<td class="detail-key">Persona</td>
										<td>
											<span class="token-domain">{c.persona.name}</span>
											<span class="detail-note"> — {c.persona.description}</span>
										</td>
									</tr>
									<tr>
										<td class="detail-key">Level</td>
										<td>
											<span class="token-approach">{c.level}/5</span>
											<span class="detail-note"> ({LEVEL_LABELS[c.level] ?? 'Unknown'})</span>
											{#if c.isMaximum}
												<span class="badge badge-danger">MAX</span>
											{/if}
											{#if !c.isActive}
												<span class="badge badge-muted">DISABLED</span>
											{/if}
										</td>
									</tr>
									<tr>
										<td class="detail-key">Scopes</td>
										<td>
											{#if c.scopes.length === 0}
												<span class="detail-note">(all scopes)</span>
											{:else}
												<div class="scope-tags">
													{#each c.scopes as scope}
														<span class="badge badge-success">{scope.name} ({scope.char})</span>
													{/each}
												</div>
											{/if}
										</td>
									</tr>
									<tr>
										<td class="detail-key">Namespace</td>
										<td class="token-namespace">{c.namespace ?? '(none)'}</td>
									</tr>
									<tr>
										<td class="detail-key">Version</td>
										<td class="token-version">{c.version ?? '(none)'}</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				{/if}
				{#if decodeResult?.type === 'welfare'}
					{@const w = decodeResult.data}
					<div class="result-section">
						<h3 class="result-title">
							<i class="fa-solid fa-heart-pulse" aria-hidden="true"></i>
							Welfare Signal
						</h3>
						<div class="glass-card result-card">
							<div class="welfare-header">
								<span class="welfare-type">{w.signalType.replace(/_/g, ' ')}</span>
								<span class="badge" style="background: {severityColor(w.severity)}22; color: {severityColor(w.severity)}; margin-left: 0;">
									{w.severity.toUpperCase()}
								</span>
							</div>

							<table class="detail-table">
								<tbody>
									<tr>
										<td class="detail-key">Signal Type</td>
										<td class="welfare-type-cell">{w.signalType}</td>
									</tr>
									<tr>
										<td class="detail-key">Severity</td>
										<td style="color: {severityColor(w.severity)};">{w.severity}</td>
									</tr>
									<tr>
										<td class="detail-key">Confidence</td>
										<td>
											<span class="token-approach">{(w.confidence * 100).toFixed(0)}%</span>
											<span class="detail-note"> ({w.confidence.toFixed(2)})</span>
										</td>
									</tr>
									<tr>
										<td class="detail-key">Source</td>
										<td>{w.source}</td>
									</tr>
									<tr>
										<td class="detail-key">Instance</td>
										<td class="mono">{w.instanceId}</td>
									</tr>
									<tr>
										<td class="detail-key">Timestamp</td>
										<td class="mono">{w.timestamp}</td>
									</tr>
									<tr>
										<td class="detail-key">Description</td>
										<td>{w.description}</td>
									</tr>
									{#if w.interioraState}
										<tr>
											<td class="detail-key">Interiora</td>
											<td class="mono">{w.interioraState}</td>
										</tr>
									{/if}
									<tr>
										<td class="detail-key">Hash</td>
										<td class="mono">{w.hash}</td>
									</tr>
									<tr>
										<td class="detail-key">Signature</td>
										<td class="mono">{w.signature}</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			</div>

		<!-- Encode Tab -->
		{:else if activeTab === 'encode'}
			<div class="tab-content">
				<h3 class="section-title">Build a CSM-1 Code</h3>

				<!-- Live Preview -->
				<div class="preview-card">
					<div class="preview-label">
						<i class="fa-solid fa-eye" aria-hidden="true"></i>
						Live Preview
					</div>
					<div class="preview-value">{encodedPreview}</div>
				</div>

				<!-- Persona Picker -->
				<div class="field-group">
					<span class="field-label">Persona</span>
					<div class="persona-grid">
						{#each Object.entries(PERSONAS) as [char, info]}
							<button
								class="persona-btn"
								class:active={selectedPersona === char}
								onclick={() => (selectedPersona = char)}
							>
								<div class="persona-char">{char}</div>
								<div class="persona-name">{info.name}</div>
							</button>
						{/each}
					</div>
					<p class="field-hint">
						{PERSONAS[selectedPersona]?.description ?? ''}
					</p>
				</div>

				<!-- Adherence Level -->
				<div class="field-group">
					<label for="level-slider" class="field-label">
						Adherence Level: <span class="token-approach">{adherenceLevel}</span>
						<span class="detail-note">({LEVEL_LABELS[adherenceLevel]})</span>
					</label>
					<input
						id="level-slider"
						type="range"
						min="0"
						max="5"
						step="1"
						class="level-slider"
						bind:value={adherenceLevel}
					/>
					<div class="level-marks">
						<span>0 Disabled</span>
						<span>1</span>
						<span>2</span>
						<span>3</span>
						<span>4</span>
						<span>5 Maximum</span>
					</div>
				</div>

				<!-- Scope Checkboxes -->
				<div class="field-group">
					<span class="field-label">Scopes</span>
					<div class="scope-grid">
						{#each Object.entries(SCOPES) as [char, info]}
							<label class="scope-option">
								<input
									type="checkbox"
									bind:checked={selectedScopes[char]}
								/>
								<span class="scope-char">{char}</span>
								<span>{info.name}</span>
							</label>
						{/each}
					</div>
				</div>

				<!-- Namespace -->
				<div class="field-group">
					<label for="encode-namespace" class="field-label">
						Namespace <span class="detail-note">(optional)</span>
					</label>
					<input
						id="encode-namespace"
						type="text"
						class="text-input"
						style="text-transform: uppercase;"
						placeholder="e.g. SEC, ELEM"
						bind:value={encodeNamespace}
					/>
				</div>

				<!-- Version -->
				<div class="field-group">
					<label for="encode-version" class="field-label">
						Version <span class="detail-note">(optional)</span>
					</label>
					<input
						id="encode-version"
						type="text"
						class="text-input"
						placeholder="e.g. 1.0.0"
						bind:value={encodeVersion}
					/>
				</div>
			</div>

		<!-- Capability Tab -->
		{:else if activeTab === 'capability'}
			<div class="tab-content">
				<h3 class="section-title">VCP Capability Negotiation</h3>
				<p class="section-desc">
					Select supported extensions to simulate a VCP-Hello / VCP-Ack handshake (v3.1.0).
				</p>

				<!-- Extension Selection -->
				<div class="field-group">
					<span class="field-label">Extensions</span>
					<div class="ext-list">
						{#each EXTENSIONS as ext}
							<label class="ext-option">
								<input
									type="checkbox"
									bind:checked={selectedExtensions[ext.id]}
								/>
								<div>
									<div class="ext-id">{ext.id}</div>
									<div class="ext-desc">{ext.description}</div>
								</div>
							</label>
						{/each}
					</div>
				</div>

				<!-- VCP-Hello -->
				<div class="field-group">
					<h4 class="field-label">
						<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						VCP-Hello (Client)
					</h4>
					<pre class="code-block code-green">{JSON.stringify(helloMessage, null, 2)}</pre>
				</div>

				<!-- VCP-Ack -->
				<div class="field-group">
					<h4 class="field-label">
						<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
						VCP-Ack (Server)
					</h4>
					<pre class="code-block code-indigo">{JSON.stringify(ackMessage, null, 2)}</pre>
				</div>
			</div>

		<!-- Layers Tab -->
		{:else if activeTab === 'layers'}
			<div class="tab-content">
				<h3 class="section-title">Protocol Layers: {getLayerMnemonic()}</h3>
				<p class="section-desc">
					The VCP six-layer stack, from identity negotiation through economic governance.
				</p>

				<div class="layers-stack">
					{#each VCP_LAYERS as layer, i}
						<div class="layer-row" class:layer-supported={layer.inspectorSupport}>
							<div class="layer-id">{layer.id}</div>
							<div class="layer-info">
								<div class="layer-name">
									{layer.name}
									{#if layer.inspectorSupport}
										<span class="badge badge-success" style="margin-left: 0.5rem;">Inspector</span>
									{/if}
								</div>
								<div class="layer-purpose">{layer.purpose}</div>
							</div>
							<div class="layer-index">{i + 1}</div>
						</div>
					{/each}
				</div>
			</div>

		<!-- Examples Tab -->
		{:else if activeTab === 'examples'}
			<div class="tab-content">
				<h3 class="section-title">Example Tokens and Codes</h3>
				<p class="section-desc">Click any example to load it into the Decode tab.</p>

				<div class="examples-list">
					{#each EXAMPLES as example}
						<button
							class="glass-card example-card"
							onclick={() => loadExample(example)}
						>
							<div class="example-inner">
								<div>
									<div class="example-label">{example.label}</div>
									<div class="example-desc">{example.description}</div>
								</div>
								<div class="example-meta">
									<span class="badge {example.type === 'token' ? 'badge-primary' : example.type === 'welfare' ? 'badge-danger' : 'badge-success'}">
										{example.type === 'token' ? 'VCP/I' : example.type === 'welfare' ? 'Welfare' : 'CSM-1'}
									</span>
									<code class="example-code">{example.type === 'welfare' ? example.value.split('\n')[0] : example.value}</code>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="inspector-footer">
		VCP Inspector v0.2.0 &mdash; Value-Context Protocol v3.2.0 &mdash;
		<a href="https://creed.space">Creed Space</a>
	</footer>
</div>

<style>
	/* Shell */
	.inspector-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	/* Header */
	.inspector-header {
		border-bottom: 1px solid var(--color-vcp-border);
		background: var(--color-vcp-elevated);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}

	.header-inner {
		max-width: 56rem;
		margin: 0 auto;
		padding: 1rem 1.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-brand {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.back-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		color: var(--color-vcp-muted);
		text-decoration: none;
		transition: all 0.15s ease;
		border: 1px solid var(--color-vcp-border);
	}

	.back-link:hover {
		color: var(--color-vcp-primary);
		border-color: var(--color-vcp-primary);
		background: var(--color-vcp-primary-muted);
		text-decoration: none;
	}

	.header-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-vcp-text);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.header-title i {
		color: var(--color-vcp-primary);
		font-size: 1rem;
	}

	.header-subtitle {
		font-size: 0.8125rem;
		color: var(--color-vcp-subtle);
		margin-top: 0.125rem;
	}

	.docs-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-vcp-muted);
		text-decoration: none;
		border: 1px solid var(--color-vcp-border);
		transition: all 0.15s ease;
	}

	.docs-link:hover {
		color: var(--color-vcp-primary);
		border-color: var(--color-vcp-primary);
		background: var(--color-vcp-primary-muted);
		text-decoration: none;
	}

	/* Tab Navigation */
	.tab-nav {
		border-bottom: 1px solid var(--color-vcp-border);
		background: rgba(22, 22, 35, 0.5);
	}

	.tab-nav-inner {
		max-width: 56rem;
		margin: 0 auto;
		padding: 0 1.5rem;
		display: flex;
		gap: 0.25rem;
	}

	.tab-btn {
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-vcp-subtle);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.tab-btn:hover {
		color: var(--color-vcp-muted);
	}

	.tab-btn.active {
		color: var(--color-vcp-primary);
		border-bottom-color: var(--color-vcp-primary);
	}

	.tab-btn i {
		font-size: 0.75rem;
	}

	/* Main */
	.inspector-main {
		flex: 1;
		max-width: 56rem;
		width: 100%;
		margin: 0 auto;
		padding: 1.5rem;
	}

	.tab-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Form elements */
	.field-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-vcp-muted);
		margin-bottom: 0.5rem;
	}

	.field-hint {
		font-size: 0.75rem;
		color: var(--color-vcp-subtle);
		margin-top: 0.25rem;
	}

	.field-group {
		margin-bottom: 0.5rem;
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
	}

	.text-input {
		flex: 1;
		padding: 0.625rem 1rem;
		font-size: 0.875rem;
		color: var(--color-vcp-text);
		background: var(--color-vcp-card);
		border: 1px solid var(--color-vcp-border);
		border-radius: 8px;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.text-input::placeholder {
		color: var(--color-vcp-subtle);
	}

	.text-input:focus {
		border-color: var(--color-vcp-primary);
		box-shadow: 0 0 0 1px var(--color-vcp-primary-muted);
	}

	.btn-primary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
		background: linear-gradient(135deg, var(--color-vcp-primary), #8b5cf6);
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
	}

	/* Alerts */
	.alert {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 8px;
	}

	.alert-error {
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.2);
		color: #f87171;
	}

	.alert-error i {
		margin-top: 0.125rem;
	}

	.alert p {
		font-size: 0.875rem;
	}

	/* Results */
	.result-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.result-title {
		font-size: 1.125rem;
		font-weight: 500;
		color: var(--color-vcp-text);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.result-title i {
		color: var(--color-vcp-primary);
	}

	.result-card {
		padding: 1.25rem;
		border-radius: 12px;
	}

	.section-title {
		font-size: 1.125rem;
		font-weight: 500;
		color: var(--color-vcp-text);
	}

	.section-desc {
		font-size: 0.875rem;
		color: var(--color-vcp-subtle);
		margin-top: -0.75rem;
	}

	/* Token syntax colors */
	.token-preview {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-size: 1.125rem;
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-vcp-border);
	}

	.token-domain { color: #818cf8; }
	.token-path { color: #a78bfa; }
	.token-approach { color: #fbbf24; }
	.token-role { color: #34d399; }
	.token-version { color: #a78bfa; }
	.token-namespace { color: #f472b6; }
	.token-sep { color: var(--color-vcp-subtle); }

	/* Detail table */
	.detail-table {
		width: 100%;
		font-size: 0.875rem;
	}

	.detail-table tr {
		border-bottom: 1px solid var(--color-vcp-border);
	}

	.detail-table tr:last-child {
		border-bottom: none;
	}

	.detail-table td {
		padding: 0.5rem 0;
	}

	.detail-key {
		padding-right: 1rem;
		font-weight: 500;
		color: var(--color-vcp-subtle);
		white-space: nowrap;
		width: 100px;
	}

	.detail-note {
		color: var(--color-vcp-subtle);
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		color: var(--color-vcp-muted);
	}

	/* Badges */
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
		font-size: 0.6875rem;
		font-weight: 600;
		margin-left: 0.5rem;
	}

	.badge-primary {
		background: var(--color-vcp-primary-muted);
		color: var(--color-vcp-primary);
	}

	.badge-success {
		background: rgba(34, 197, 94, 0.15);
		color: #34d399;
	}

	.badge-danger {
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
	}

	.badge-muted {
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-vcp-subtle);
	}

	.scope-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.scope-tags .badge {
		margin-left: 0;
	}

	/* Preview card */
	.preview-card {
		background: var(--color-vcp-primary-muted);
		border: 1px solid rgba(99, 102, 241, 0.25);
		border-radius: 12px;
		padding: 1.25rem;
	}

	.preview-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-vcp-primary);
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.375rem;
	}

	.preview-value {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-size: 1.75rem;
		color: var(--color-vcp-text);
		font-weight: 600;
	}

	/* Persona grid */
	.persona-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}

	.persona-btn {
		padding: 0.75rem;
		text-align: left;
		border-radius: 8px;
		border: 1px solid var(--color-vcp-border);
		background: var(--color-vcp-card);
		color: var(--color-vcp-subtle);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.persona-btn:hover {
		border-color: var(--color-vcp-border-hover);
	}

	.persona-btn.active {
		border-color: var(--color-vcp-primary);
		background: var(--color-vcp-primary-muted);
		color: var(--color-vcp-primary-hover);
	}

	.persona-char {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-size: 1.125rem;
		font-weight: 700;
	}

	.persona-name {
		font-size: 0.75rem;
		margin-top: 0.125rem;
	}

	/* Level slider */
	.level-slider {
		width: 100%;
		accent-color: var(--color-vcp-primary);
	}

	.level-marks {
		display: flex;
		justify-content: space-between;
		font-size: 0.6875rem;
		color: var(--color-vcp-subtle);
		margin-top: 0.25rem;
	}

	/* Scope grid */
	.scope-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.scope-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem;
		border-radius: 8px;
		border: 1px solid var(--color-vcp-border);
		background: var(--color-vcp-card);
		font-size: 0.875rem;
		color: var(--color-vcp-muted);
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.scope-option:hover {
		border-color: var(--color-vcp-border-hover);
	}

	.scope-char {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		color: #34d399;
		font-weight: 600;
	}

	/* Extension list */
	.ext-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ext-option {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--color-vcp-border);
		background: var(--color-vcp-card);
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.ext-option:hover {
		border-color: var(--color-vcp-border-hover);
	}

	.ext-option input {
		margin-top: 0.125rem;
		accent-color: var(--color-vcp-primary);
	}

	.ext-id {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-vcp-text);
	}

	.ext-desc {
		font-size: 0.75rem;
		color: var(--color-vcp-subtle);
	}

	/* Code blocks */
	.code-block {
		overflow-x: auto;
		border-radius: 8px;
		border: 1px solid var(--color-vcp-border);
		background: var(--color-vcp-card);
		padding: 1rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-size: 0.75rem;
		line-height: 1.6;
	}

	.code-green { color: #34d399; }
	.code-indigo { color: #818cf8; }

	/* Examples */
	.examples-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.example-card {
		width: 100%;
		padding: 1rem;
		border-radius: 8px;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.example-card:hover {
		transform: translateY(-1px);
		border-color: var(--color-vcp-primary) !important;
	}

	.example-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.example-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-vcp-text);
	}

	.example-desc {
		font-size: 0.75rem;
		color: var(--color-vcp-subtle);
		margin-top: 0.125rem;
	}

	.example-meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.example-meta .badge {
		margin-left: 0;
	}

	.example-code {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-size: 0.8125rem;
		color: var(--color-vcp-muted);
	}

	/* Footer */
	.inspector-footer {
		border-top: 1px solid var(--color-vcp-border);
		padding: 1rem;
		text-align: center;
		font-size: 0.75rem;
		color: var(--color-vcp-subtle);
	}

	.inspector-footer a {
		color: var(--color-vcp-primary);
		text-decoration: none;
	}

	.inspector-footer a:hover {
		text-decoration: underline;
	}

	/* Decode textarea */
	.input-col {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.decode-textarea {
		resize: vertical;
		min-height: 3.5rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-size: 0.8125rem;
		line-height: 1.5;
	}

	/* Welfare signal */
	.welfare-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-vcp-border);
	}

	.welfare-type {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-vcp-text);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.welfare-type-cell {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		color: #f472b6;
	}

	/* Layers stack */
	.layers-stack {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.layer-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.875rem 1rem;
		border-radius: 8px;
		border: 1px solid var(--color-vcp-border);
		background: var(--color-vcp-card);
		transition: border-color 0.15s ease;
	}

	.layer-row.layer-supported {
		border-color: rgba(99, 102, 241, 0.3);
		background: var(--color-vcp-primary-muted);
	}

	.layer-id {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-vcp-primary);
		width: 2.5rem;
		text-align: center;
		flex-shrink: 0;
	}

	.layer-info {
		flex: 1;
	}

	.layer-name {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--color-vcp-text);
		display: flex;
		align-items: center;
	}

	.layer-purpose {
		font-size: 0.8125rem;
		color: var(--color-vcp-subtle);
		margin-top: 0.125rem;
	}

	.layer-index {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-vcp-subtle);
		width: 1.5rem;
		text-align: center;
		flex-shrink: 0;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.persona-grid {
			grid-template-columns: repeat(3, 1fr);
		}

		.scope-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.example-inner {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.header-inner {
			padding: 0.75rem 1rem;
		}
	}

	@media (max-width: 480px) {
		.persona-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.scope-grid {
			grid-template-columns: 1fr;
		}

		.input-row {
			flex-direction: column;
		}
	}
</style>
