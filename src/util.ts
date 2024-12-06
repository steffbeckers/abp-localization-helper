export const toPascalCase = (text: string): string => {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, "") // Remove non-alphanumeric and non-space characters
    .split(/\s+/) // Split by whitespace
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
    .join(""); // Join into a single string
};
