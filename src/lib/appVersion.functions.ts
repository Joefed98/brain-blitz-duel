import { createServerFn } from "@tanstack/react-start";

import { APP_BUILD_ID } from "./appVersion";

/**
 * The build the server is running. Answered by the deployed worker itself (the
 * same build that grades answers), as a POST so no HTTP cache can hold an old id.
 */
export const appVersionFn = createServerFn({ method: "POST" }).handler(async () => ({
  version: APP_BUILD_ID,
}));
