/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { DisposableStore, toDisposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITerminalContribution, ITerminalInstance, IXtermTerminal } from 'vs/workbench/contrib/terminal/browser/terminal';
import { registerTerminalContribution } from 'vs/workbench/contrib/terminal/browser/terminalExtensions';
import { TerminalWidgetManager } from 'vs/workbench/contrib/terminal/browser/widgets/widgetManager';
import { SuggestAddon } from 'vs/workbench/contrib/terminalContrib/suggest/browser/terminalSuggestAddon';
import { ITerminalProcessManager, TerminalCommandId } from 'vs/workbench/contrib/terminal/common/terminal';
import type { Terminal as RawXtermTerminal } from '@xterm/xterm';
import { ContextKeyExpr, IContextKey, IContextKeyService, IReadableSet } from 'vs/platform/contextkey/common/contextkey';
import { TerminalContextKeys } from 'vs/workbench/contrib/terminal/common/terminalContextKey';
import { registerActiveInstanceAction } from 'vs/workbench/contrib/terminal/browser/terminalActions';
import { localize } from 'vs/nls';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { KeyCode } from 'vs/base/common/keyCodes';

class TerminalSuggestContribution extends DisposableStore implements ITerminalContribution {
	static readonly ID = 'terminal.suggest';

	static get(instance: ITerminalInstance): TerminalSuggestContribution | null {
		return instance.getContribution<TerminalSuggestContribution>(TerminalSuggestContribution.ID);
	}

	private _addon: SuggestAddon | undefined;
	private _terminalSuggestWidgetContextKeys: IReadableSet<string> = new Set(TerminalContextKeys.suggestWidgetVisible.key);
	private _terminalSuggestWidgetVisibleContextKey: IContextKey<boolean>;

	get addon(): SuggestAddon | undefined { return this._addon; }

	constructor(
		private readonly _instance: ITerminalInstance,
		_processManager: ITerminalProcessManager,
		widgetManager: TerminalWidgetManager,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService
	) {
		super();
		this.add(toDisposable(() => this._addon?.dispose()));
		this._terminalSuggestWidgetVisibleContextKey = TerminalContextKeys.suggestWidgetVisible.bindTo(this._contextKeyService);
	}

	xtermReady(xterm: IXtermTerminal & { raw: RawXtermTerminal }): void {
		this._loadSuggestAddon(xterm.raw);
		this.add(this._contextKeyService.onDidChangeContext(e => {
			if (e.affectsSome(this._terminalSuggestWidgetContextKeys)) {
				this._loadSuggestAddon(xterm.raw);
			}
		}));
	}

	private _loadSuggestAddon(xterm: RawXtermTerminal): void {
		if (this._terminalSuggestWidgetVisibleContextKey) {
			this._addon = this._instantiationService.createInstance(SuggestAddon, this._terminalSuggestWidgetVisibleContextKey);
			xterm.loadAddon(this._addon);
			this._addon?.setPanel(dom.findParentWithClass(xterm.element!, 'panel')!);
			this._addon?.setScreen(xterm.element!.querySelector('.xterm-screen')!);
			this.add(this._instance.onDidBlur(() => this._addon?.hideSuggestWidget()));
			this.add(this._addon.onAcceptedCompletion(async text => {
				this._instance.focus();
				this._instance.sendText(text, false);
			}));
			this.add(this._instance.onDidSendText((text) => {
				this._addon?.handleNonXtermData(text);
			}));
		}
	}
}

registerTerminalContribution(TerminalSuggestContribution.ID, TerminalSuggestContribution);

// Actions
registerActiveInstanceAction({
	id: TerminalCommandId.SelectPrevSuggestion,
	title: { value: localize('workbench.action.terminal.selectPrevSuggestion', "Select the Previous Suggestion"), original: 'Select the Previous Suggestion' },
	f1: false,
	precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
	keybinding: {
		// Up is bound to other workbench keybindings that this needs to beat
		primary: KeyCode.UpArrow,
		weight: KeybindingWeight.WorkbenchContrib + 1
	},
	run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectPreviousSuggestion()
});

registerActiveInstanceAction({
	id: TerminalCommandId.SelectPrevPageSuggestion,
	title: { value: localize('workbench.action.terminal.selectPrevPageSuggestion', "Select the Previous Page Suggestion"), original: 'Select the Previous Page Suggestion' },
	f1: false,
	precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
	keybinding: {
		// Up is bound to other workbench keybindings that this needs to beat
		primary: KeyCode.PageUp,
		weight: KeybindingWeight.WorkbenchContrib + 1
	},
	run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectPreviousPageSuggestion()
});

registerActiveInstanceAction({
	id: TerminalCommandId.SelectNextSuggestion,
	title: { value: localize('workbench.action.terminal.selectNextSuggestion', "Select the Next Suggestion"), original: 'Select the Next Suggestion' },
	f1: false,
	precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
	keybinding: {
		// Down is bound to other workbench keybindings that this needs to beat
		primary: KeyCode.DownArrow,
		weight: KeybindingWeight.WorkbenchContrib + 1
	},
	run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectNextSuggestion()
});

registerActiveInstanceAction({
	id: TerminalCommandId.SelectNextPageSuggestion,
	title: { value: localize('workbench.action.terminal.selectNextPageSuggestion', "Select the Next Page Suggestion"), original: 'Select the Next Page Suggestion' },
	f1: false,
	precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
	keybinding: {
		// Down is bound to other workbench keybindings that this needs to beat
		primary: KeyCode.PageDown,
		weight: KeybindingWeight.WorkbenchContrib + 1
	},
	run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectNextPageSuggestion()
});

registerActiveInstanceAction({
	id: TerminalCommandId.AcceptSelectedSuggestion,
	title: { value: localize('workbench.action.terminal.acceptSelectedSuggestion', "Accept Selected Suggestion"), original: 'Accept Selected Suggestion' },
	f1: false,
	precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
	keybinding: {
		primary: KeyCode.Enter,
		secondary: [KeyCode.Tab],
		// Enter is bound to other workbench keybindings that this needs to beat
		weight: KeybindingWeight.WorkbenchContrib + 1
	},
	run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.acceptSelectedSuggestion()
});

registerActiveInstanceAction({
	id: TerminalCommandId.HideSuggestWidget,
	title: { value: localize('workbench.action.terminal.hideSuggestWidget', "Hide Suggest Widget"), original: 'Hide Suggest Widget' },
	f1: false,
	precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
	keybinding: {
		primary: KeyCode.Escape,
		// Escape is bound to other workbench keybindings that this needs to beat
		weight: KeybindingWeight.WorkbenchContrib + 1
	},
	run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.hideSuggestWidget()
});
