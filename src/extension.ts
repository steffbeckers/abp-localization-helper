import * as vscode from "vscode";
import { fetchLocalizationData } from "./api";

const output = vscode.window.createOutputChannel("ABP Localization Helper");
var localizationsByCulture: Record<string, Record<string, string>> = {};

export async function activate(context: vscode.ExtensionContext) {
  output.appendLine("Extension activated");

  await fetchLocalizations();

  context.subscriptions.push(
    vscode.commands.registerCommand("abp-localization-helper.fetchLocalizations", async () => {
      await fetchLocalizations();
    })
  );
}

export function deactivate() {
  output.appendLine("Extension deactivated");
}

async function fetchLocalizations() {
  try {
    const config = vscode.workspace.getConfiguration("abp-localization-helper");
    const apiUrl = config.get<string>("apiUrl");
    const cultureNames = config.get<string[]>("cultureNames") ?? [];
    const defaultResourceName = config.get<string>("defaultResourceName");

    if (!apiUrl) {
      vscode.window.showErrorMessage("API URL is not configured. Please set it in the settings.");
      return;
    }

    const localizationData = await fetchLocalizationData(apiUrl, cultureNames);

    for (const cultureName of cultureNames) {
      const resources = localizationData[cultureName].resources;

      localizationsByCulture[cultureName] = Object.keys(resources).reduce(
        (localizations: Record<string, string>, resourceKey) => {
          const resource = resources[resourceKey];

          for (const localizationKey in resource.texts) {
            localizations[resourceKey + "::" + localizationKey] = resource.texts[localizationKey];

            if (defaultResourceName === resourceKey) {
              localizations["::" + localizationKey] = resource.texts[localizationKey];
            }
          }

          return localizations;
        },
        {}
      );
    }

    console.debug("localizationsByCulture", localizationsByCulture);

    output.appendLine("Localizations fetched");
  } catch (error) {
    vscode.window.showErrorMessage(`${error instanceof Error ? error.message : error}`);
  }
}
