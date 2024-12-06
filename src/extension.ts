import * as vscode from "vscode";
import { fetchLocalizationData } from "./api";
import { toPascalCase } from "./util";

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

  context.subscriptions.push(
    vscode.commands.registerCommand("abp-localization-helper.localizeString", async () => {
      await localizeString();
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

    vscode.languages.registerCompletionItemProvider(
      { language: "html", scheme: "file" },
      {
        provideCompletionItems(document, position) {
          // Extract user input from the editor
          const userInputRange = document.getWordRangeAtPosition(position, /'[^']*'/);
          const userInput = userInputRange
            ? document.getText(userInputRange).replace(/'/g, "").toLowerCase()
            : "";

          // Get the currently active culture or fallback to default
          const config = vscode.workspace.getConfiguration("abp-localization-helper");
          const activeCultureName = config.get<string>("activeCultureName");
          const localizations = localizationsByCulture[activeCultureName!] ?? {};

          // Filter keys and values based on user input
          const filteredEntries = Object.entries(localizations).filter(
            ([key, value]) =>
              key.toLowerCase().includes(userInput) || value.toLowerCase().includes(userInput)
          );

          // Map filtered results to CompletionItems
          return filteredEntries.map(([key, value]) => {
            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Text);
            item.detail = value;
            return item;
          });
        },
      },
      "'" // Trigger IntelliSense when a single quote is typed
    );
  } catch (error) {
    vscode.window.showErrorMessage(`${error instanceof Error ? error.message : error}`);
  }
}

async function localizeString() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    return;
  }

  const document = editor.document;
  const selection = editor.selection;
  const wordRange = document.getWordRangeAtPosition(selection.active, /'[^']*'/);
  if (!wordRange) {
    vscode.window.showErrorMessage("Place the cursor inside a string to localize it.");
    return;
  }

  const selectedText = document.getText(wordRange).replace(/'/g, ""); // Extract text without quotes

  // Fetch configuration
  const config = vscode.workspace.getConfiguration("abp-localization-helper");
  const apiUrl = config.get<string>("apiUrl");
  const cultureNames = config.get<string[]>("cultureNames") || [];
  const activeCulture = config.get<string>("activeCulture") || cultureNames[0];

  if (!apiUrl || cultureNames.length === 0) {
    vscode.window.showErrorMessage(
      "API URL and cultures are not configured. Please set them in settings."
    );
    return;
  }

  const resourceName = await vscode.window.showInputBox({
    prompt: "Add to specific resource?",
  });

  // Prompt to confirm adding the localization
  const key = await vscode.window.showInputBox({
    prompt: "Enter a localization key for this string",
    value: toPascalCase(selectedText),
  });

  if (!key) {
    vscode.window.showInformationMessage("Localization cancelled.");
    return;
  }

  // Provide localization values for all cultures
  const values: Record<string, string> = {};
  for (const culture of cultureNames) {
    if (culture === activeCulture) {
      values[culture] = selectedText;
      continue;
    }

    const value = await vscode.window.showInputBox({
      prompt: `Enter the localized value for culture '${culture}'`,
      value: culture === activeCulture ? selectedText : "",
    });

    if (value) {
      values[culture] = value;
    }
  }

  console.debug("values", values);

  // TODO
  // output.appendLine(values);

  // Add localization to API
  // try {
  //     for (const [culture, value] of Object.entries(values)) {
  //         await addLocalizationToAPI(apiUrl, culture, key, value);
  //     }

  //     vscode.window.showInformationMessage(`Localization added for key '${key}' across all cultures.`);
  // } catch (error) {
  //     vscode.window.showErrorMessage(`Failed to add localization: ${error}`);
  // }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, wordRange, `'${resourceName}::${key}' | abpLocalization`);
  await vscode.workspace.applyEdit(edit);
}
