import * as path from 'path';
import * as vscode from 'vscode';
import type { EditorMode, LayoutJson, ParsedDiagram } from './types';

export class ErdEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'ermanager.erdEditor';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new ErdEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      ErdEditorProvider.viewType,
      provider,
      { supportsMultipleEditorsPerDocument: false }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const mode: EditorMode = document.uri.fsPath.endsWith('.erm.json') ? 'editor' : 'viewer';

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'out'),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // .erm.json → .erm.layout.json
    const layoutUri: vscode.Uri | null = mode === 'editor'
      ? vscode.Uri.file(document.uri.fsPath.replace(/\.json$/, '.layout.json'))
      : null;

    const readLayoutContent = async (): Promise<string | null> => {
      if (!layoutUri) return null;
      try {
        const bytes = await vscode.workspace.fs.readFile(layoutUri);
        return new TextDecoder().decode(bytes);
      } catch {
        return null;
      }
    };

    // 자체 편집으로 발생한 onDidChangeTextDocument 이벤트 무시
    let pendingEdits = 0;

    const DEFAULT_SCHEMA = JSON.stringify(
      { database: '', tables: [], relations: [], categories: [] },
      null, 2
    );

    const sendToWebview = async () => {
      let content = document.getText();

      // 빈 .erm.json 파일: 기본 스키마 자동 초기화
      if (mode === 'editor' && !content.trim()) {
        pendingEdits++;
        await this.applyEdit(document, DEFAULT_SCHEMA);
        content = DEFAULT_SCHEMA;
      }

      const layoutContent = await readLayoutContent();
      webviewPanel.webview.postMessage({
        type: 'update',
        mode,
        content,
        layoutContent,
      });
    };

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready':
          await sendToWebview();
          break;

        case 'save':
          pendingEdits++;
          await this.applyEdit(document, message.content);
          break;

        case 'save-schema':
          pendingEdits++;
          await this.applyEdit(document, JSON.stringify(message.schema, null, 2));
          break;

        case 'save-layout': {
          if (!layoutUri) break;
          const enc = new TextEncoder();
          await vscode.workspace.fs.writeFile(
            layoutUri,
            enc.encode(JSON.stringify(message.layout, null, 2))
          );
          break;
        }

        case 'export-json':
          await this.handleExportJson(document, message.diagram as ParsedDiagram);
          break;

        case 'install-claude-skill':
          await this.handleInstallClaudeSkill(document);
          break;

        case 'open-external':
          if (typeof message.url === 'string') {
            vscode.env.openExternal(vscode.Uri.parse(message.url));
          }
          break;
      }
    });

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return;
      if (pendingEdits > 0) {
        pendingEdits--;
        return;
      }
      sendToWebview();
    });

    webviewPanel.onDidDispose(() => changeSubscription.dispose());
  }

  private async handleExportJson(
    document: vscode.TextDocument,
    diagram: ParsedDiagram
  ): Promise<void> {
    const ermPath = document.uri.fsPath;
    const basePath = ermPath.endsWith('.erm') ? ermPath.slice(0, -4) : ermPath;

    const jsonUri = vscode.Uri.file(basePath + '.erm.json');
    const layoutUri = vscode.Uri.file(basePath + '.erm.layout.json');

    const existing: string[] = [];
    for (const uri of [jsonUri, layoutUri]) {
      try {
        await vscode.workspace.fs.stat(uri);
        existing.push(path.basename(uri.fsPath));
      } catch {
        // 파일 없음 - 정상
      }
    }

    if (existing.length > 0) {
      const answer = await vscode.window.showWarningMessage(
        vscode.l10n.t(
          'The following files already exist:\n{0}\n\nDo you want to overwrite them?',
          existing.join(', ')
        ),
        { modal: true },
        vscode.l10n.t('Overwrite')
      );
      if (answer !== vscode.l10n.t('Overwrite')) return;
    }

    const schemaJson = {
      database: diagram.database,
      tables: diagram.tables.map(({ id, physicalName, logicalName, description, columns }) => ({
        id, physicalName, logicalName, description, columns,
      })),
      relations: diagram.relations,
      categories: diagram.categories,
    };

    const layoutJson = {
      tables: Object.fromEntries(
        diagram.tables.map(({ id, x, y, width, height }) => [
          String(id),
          { x, y, width, height },
        ])
      ),
    };

    const enc = new TextEncoder();
    await vscode.workspace.fs.writeFile(jsonUri, enc.encode(JSON.stringify(schemaJson, null, 2)));
    await vscode.workspace.fs.writeFile(layoutUri, enc.encode(JSON.stringify(layoutJson, null, 2)));

    vscode.window.showInformationMessage(
      vscode.l10n.t('Save complete: {0}', `${path.basename(jsonUri.fsPath)}, ${path.basename(layoutUri.fsPath)}`)
    );
  }

  private async handleInstallClaudeSkill(document: vscode.TextDocument): Promise<void> {
    const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
      ?? path.dirname(document.uri.fsPath);
    const skillDir = path.join(workspaceRoot, '.claude', 'skills', 'ermanager');
    const skillDirUri = vscode.Uri.file(skillDir);

    try {
      await vscode.workspace.fs.createDirectory(skillDirUri);

      const filesToInstall = ['SKILL.md', 'parse_erm.js'];
      for (const file of filesToInstall) {
        const src = vscode.Uri.joinPath(this.context.extensionUri, 'scripts', file);
        const dest = vscode.Uri.file(path.join(skillDir, file));
        const bytes = await vscode.workspace.fs.readFile(src);
        await vscode.workspace.fs.writeFile(dest, bytes);
      }

      const answer = await vscode.window.showInformationMessage(
        vscode.l10n.t('Claude skill installed: {0}', skillDir),
        vscode.l10n.t('Open Folder')
      );
      if (answer === vscode.l10n.t('Open Folder')) {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(skillDir));
      }
    } catch (err) {
      vscode.window.showErrorMessage(
        vscode.l10n.t('Failed to install Claude skill: {0}', String(err))
      );
    }
  }

  private async applyEdit(document: vscode.TextDocument, content: string) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      content
    );
    await vscode.workspace.applyEdit(edit);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview.js')
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview.css')
    );
    const nonce = getNonce();
    const bundle = JSON.stringify(vscode.l10n.bundle ?? null);

    return /* html */ `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; img-src https://cdn.buymeacoffee.com; worker-src blob:;">
  <link rel="stylesheet" href="${cssUri}">
  <title>ERManager</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
  </style>
  <script nonce="${nonce}">window.__l10nBundle__=${bundle};</script>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
