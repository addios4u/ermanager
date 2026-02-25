import * as vscode from 'vscode';
import { ErdEditorProvider } from './ErdEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(ErdEditorProvider.register(context));
}

export function deactivate() {}
