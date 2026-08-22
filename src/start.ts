import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  secFetchSite: ["same-origin", "same-site", "none"],
  origin: (value) => {
    try {
      const host = new URL(value).hostname;
      return (
        host.endsWith(".ts.net") ||
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".tailscale.net")
      );
    } catch {
      return false;
    }
  },
  allowRequestsWithoutOriginCheck: true,
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
