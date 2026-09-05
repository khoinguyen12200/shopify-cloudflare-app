import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getLocale } from "~/i18n/i18n.server";
import { LOCALE_DIRECTION } from "~/i18n/config";

/**
 * The root loader resolves the locale once per request. Everything below reads
 * it from here rather than re-detecting, so `<html lang>`, the server render and
 * the client hydration can never disagree.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return { locale: await getLocale(request) };
};

export default function App() {
  // Root reads its own loader data. Everything BELOW root uses useLocale() from
  // ~/i18n/useLocale instead — it reads the locale from i18next, so it needs no
  // route id and cannot disagree with the strings being rendered.
  const { locale } = useLoaderData<typeof loader>();

  return (
    // `lang` is what assistive tech and the browser's own translation prompt
    // read, and what entry.client reads back to initialise i18next. `dir` comes
    // from the locale table so adding an RTL language is a one-line change.
    <html lang={locale} dir={LOCALE_DIRECTION[locale]}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
