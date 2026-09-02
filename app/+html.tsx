import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="it">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
