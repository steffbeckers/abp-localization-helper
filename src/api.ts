import axios from "axios";
import { Agent } from "https";

export async function fetchLocalizationData(apiUrl: string, cultureName: string): Promise<any> {
  const url = `${apiUrl}${
    !apiUrl.endsWith("/") ? "/" : ""
  }api/abp/application-localization?cultureName=${cultureName}`;

  const httpsAgent = new Agent({
    // TODO: Create setting for this?
    rejectUnauthorized: false,
  });

  try {
    const response = await axios.get(url, {
      httpsAgent,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch localization data: ${error}`);
  }
}
