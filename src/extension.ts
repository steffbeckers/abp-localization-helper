import * as vscode from "vscode";
import { fetchLocalizationData } from "./api";
import { toPascalCase } from "./util";
import { updateResourceLocalization } from "./fs";

const output = vscode.window.createOutputChannel("ABP Localization Helper");
let localizationsByCulture: Record<string, Record<string, string>> = {};
let resourceName: string | undefined = "";

export async function activate(context: vscode.ExtensionContext) {
  output.appendLine("Extension activated");

  await fetchLocalizations();

  context.subscriptions.push(
    vscode.commands.registerCommand("abp-localization-helper.addLocalization", async () => {
      await addLocalization();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("abp-localization-helper.localizeString", async () => {
      await localizeString();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("abp-localization-helper.refetchLocalizations", async () => {
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

  resourceName = await vscode.window.showInputBox({
    prompt: "Add to specific resource?",
    value: resourceName,
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

  try {
    // Update localization resource in backend code
    const defaultResourceName = config.get<string>("defaultResourceName");
    for (const [culture, value] of Object.entries(values)) {
      await updateResourceLocalization(
        (resourceName !== "" ? resourceName : defaultResourceName) ?? "",
        culture,
        key,
        value
      );
    }

    // Re-fetch localization after adding a new localization key
    await fetchLocalizations();

    // Update the string to the localization key
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, wordRange, `'${resourceName}::${key}'`);
    await vscode.workspace.applyEdit(edit);

    vscode.window.showInformationMessage(
      `Localization added for resource '${
        resourceName !== "" ? resourceName : defaultResourceName
      }' and key '${key}'.`
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to add localization: ${error instanceof Error ? error.message : error}`
    );
  }
}

async function addLocalization() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    return;
  }

  const document = editor.document;
  const position = editor.selection.active;

  // Detect key under the cursor
  let wordRange = document.getWordRangeAtPosition(position, /'[^']*'/);
  let fullKey = document.getText(wordRange).replace(/'/g, ""); // Remove quotes

  if (!fullKey) {
    fullKey =
      (await vscode.window.showInputBox({
        prompt: `Enter the new localization key.`,
        value: `${resourceName}::`,
      })) ?? "";
  }

  const fullKeyParts = fullKey.split("::");
  resourceName = fullKeyParts[0];
  const key = fullKeyParts[1];

  if (!key) {
    vscode.window.showErrorMessage("Invalid localization key format. Expected '[Resource]::Key'.");
    return;
  }

  const config = vscode.workspace.getConfiguration("abp-localization-helper");
  const cultureNames = config.get<string[]>("cultureNames") || [];
  const activeCulture = config.get<string>("activeCulture");

  // Prompt for translations for each culture
  const newTranslations: Record<string, string> = {};
  for (const culture of cultureNames) {
    const currentValue =
      localizationsByCulture[culture][fullKey] || (culture === activeCulture ? key : "");
    const value = await vscode.window.showInputBox({
      prompt: `Enter the localized value for culture '${culture}'`,
      value: currentValue,
    });

    if (value) {
      newTranslations[culture] = value;
    }
  }

  // Update JSON files with new translations
  try {
    for (const [culture, value] of Object.entries(newTranslations)) {
      await updateResourceLocalization(resourceName, culture, key, value);
    }

    vscode.window.showInformationMessage(
      `Localizations added/updated for key '${key}' in resource '${resourceName}'.`
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to update localizations: ${error instanceof Error ? error.message : error}`
    );
  }
}
