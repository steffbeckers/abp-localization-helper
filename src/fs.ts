import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export async function updateResourceLocalization(
  resourceName: string,
  culture: string,
  key: string,
  value: string
): Promise<void> {
  const resourceDirectory = await findResourceDirectory(resourceName);
  if (!resourceDirectory) {
    throw new Error(`Resource directory for '${resourceName}' not found.`);
  }

  const filePath = path.join(resourceDirectory, `${culture}.json`);

  // Read or initialize the JSON file
  let localizationData: { Culture: string; Texts: Record<string, string> } = {
    Culture: culture,
    Texts: {},
  };

  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, "utf8");
    localizationData = JSON.parse(fileContent);
  }

  // Validate the culture matches the file's declared culture
  if (localizationData.Culture !== culture) {
    throw new Error(
      `Mismatched culture in file '${filePath}': Expected '${culture}', found '${localizationData.Culture}'.`
    );
  }

  // Update the `Texts` object
  localizationData.Texts[key] = value;

  // Write updated data back to the file
  fs.writeFileSync(filePath, JSON.stringify(localizationData, null, 2), "utf8");
}

async function findResourceDirectory(resourceName: string): Promise<string | null> {
  const files = await vscode.workspace.findFiles(`**/${resourceName}/*.json`);

  if (files.length > 0) {
    return path.dirname(files[0].fsPath); // Return the parent directory
  }

  return null; // Directory not found
}
