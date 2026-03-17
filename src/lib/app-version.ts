import packageJson from "../../package.json";

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version;

export const APP_FOOTER_COPY =
  `© Intelligence Platform (v${APP_VERSION}) · Created by AI, prompted by F&G.`;
