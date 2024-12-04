import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("ABP Localization Helper active");

  context.subscriptions.push(
    vscode.commands.registerCommand("abp-localization-helper.helloWorld", () => {
      vscode.window.showInformationMessage('"Hello World!" - ABP Localization Helper');
    })
  );
}

export function deactivate() {
  console.log("ABP Localization Helper inactive");
}
