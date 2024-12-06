import axios, { AxiosError } from "axios";
import { Agent } from "https";

const httpsAgent = new Agent({
  // TODO: Create setting for this?
  rejectUnauthorized: false,
});

const headers = {
  "Content-Type": "application/json",
};

export async function fetchLocalizationData(
  apiUrl: string,
  cultureNames: string[]
): Promise<Record<string, any>> {
  const localizationData: Record<string, any> = {};

  for (const cultureName of cultureNames) {
    const url = `${apiUrl}${
      !apiUrl.endsWith("/") ? "/" : ""
    }api/abp/application-localization?cultureName=${cultureName}`;

    try {
      const response = await axios.get(url, {
        httpsAgent,
        headers,
      });

      localizationData[cultureName] = response.data;
    } catch (error) {
      handleError("Failed to fetch localization data", error);
    }
  }

  return localizationData;
}

function handleError(message: string, error: unknown) {
  throw new Error(
    `${message}: ${
      error instanceof AxiosError ? error.code + (error.message ? ": " + error.message : "") : error
    }`
  );
}
