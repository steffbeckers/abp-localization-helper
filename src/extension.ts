import * as vscode from "vscode";
import { fetchLocalizationData } from "./api";

export function activate(context: vscode.ExtensionContext) {
  console.log("ABP Localization Helper active");

  context.subscriptions.push(
    vscode.commands.registerCommand("abp-localization-helper.fetchLocalizations", async () => {
      const config = vscode.workspace.getConfiguration("abp-localization-helper");
      const apiUrl = config.get<string>("apiUrl");
      const defaultCulture = config.get<string>("defaultCulture") || "en";

      if (!apiUrl) {
        vscode.window.showErrorMessage("API URL is not configured. Please set it in the settings.");
        return;
      }

      try {
        const localizationData = await fetchLocalizationData(apiUrl, defaultCulture);

        vscode.window.showInformationMessage(
          `Localization data fetched successfully for culture: ${defaultCulture}`
        );

        console.log(localizationData); // Log or use the localization data
      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error}`);
      }
    })
  );
}

export function deactivate() {
  console.log("ABP Localization Helper inactive");
}
