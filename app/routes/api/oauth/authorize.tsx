import { redirect, Form, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "ngk-dashboard";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import { issueAuthorizationCode, validateAuthorizeRequest } from "~/services/mcp/oauth.server";
import { SCOPE_DESCRIPTIONS, type McpScope } from "~/domain/mcp/scopes";
import { INTERNAL_FONT_LINKS } from "~/internal/components";
import internalStyles from "~/styles/internal/internal.tailwind.css?url";

export const links: LinksFunction = () => [
  ...INTERNAL_FONT_LINKS,
  { rel: "stylesheet", href: internalStyles },
];

export const meta: MetaFunction = () => [
  { title: "Authorize MCP / AI Client" },
  { name: "robots", content: "noindex, nofollow" },
];

interface AuthorizeSuccessData {
  ok: true;
  client: { clientId: string; clientName: string };
  scopes: McpScope[];
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
  user: { email: string };
}

interface AuthorizeErrorData {
  ok: false;
  error: string;
  description: string;
  user?: { email: string };
}

type LoaderData = AuthorizeSuccessData | AuthorizeErrorData;

export const loader = async ({ request }: LoaderFunctionArgs): Promise<LoaderData> => {
  const user = await requireAdminUser(request, { users: adminUsers() });
  const url = new URL(request.url);

  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const responseType = url.searchParams.get("response_type");
  const scope = url.searchParams.get("scope");
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "S256";

  if (!codeChallenge) {
    return {
      ok: false,
      error: "invalid_request",
      description: "PKCE code_challenge is required for MCP authorization.",
      user: { email: user.email },
    };
  }

  const validation = await validateAuthorizeRequest({
    clientId,
    redirectUri,
    responseType,
    scope,
  });

  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
      description: validation.description,
      user: { email: user.email },
    };
  }

  return {
    ok: true,
    client: {
      clientId: validation.client.clientId,
      clientName: validation.client.clientName,
    },
    scopes: validation.scopes,
    redirectUri: validation.redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod,
    user: { email: user.email },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await requireAdminUser(request, { users: adminUsers() });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const clientId = String(form.get("client_id") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const state = form.get("state") ? String(form.get("state")) : null;

  if (intent === "deny") {
    const targetUrl = new URL(redirectUri);
    targetUrl.searchParams.set("error", "access_denied");
    targetUrl.searchParams.set("error_description", "The user denied the authorization request.");
    if (state) targetUrl.searchParams.set("state", state);
    return redirect(targetUrl.toString());
  }

  if (intent === "authorize") {
    const scope = String(form.get("scope") ?? "mcp:read");
    const codeChallenge = String(form.get("code_challenge") ?? "");
    const codeChallengeMethod = String(form.get("code_challenge_method") ?? "S256");

    const code = await issueAuthorizationCode({
      clientId,
      adminUserId: user.id,
      redirectUri,
      scope,
      codeChallenge,
      codeChallengeMethod,
    });

    const targetUrl = new URL(redirectUri);
    targetUrl.searchParams.set("code", code);
    if (state) targetUrl.searchParams.set("state", state);
    return redirect(targetUrl.toString());
  }

  return redirect(redirectUri);
};

export default function AuthorizePage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (!data.ok) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
        <Card className="w-full max-w-md shadow-lg border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">Authorization Error</CardTitle>
            <CardDescription>The authorization request could not be processed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                <strong>{data.error}</strong>: {data.description}
              </AlertDescription>
            </Alert>
            <p className="text-xs text-muted-foreground">
              Please check your client configuration and redirect URI.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <Card className="w-full max-w-lg shadow-xl border-border">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <CardTitle className="text-xl font-bold">Authorize AI / MCP Agent</CardTitle>
          <CardDescription className="text-sm">
            <strong>{data.client.clientName}</strong> is requesting permission to access the internal admin console.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          <div className="bg-muted/50 rounded-lg p-3 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Authorized account</span>
            <span className="font-medium text-foreground">{data.user.email}</span>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Requested Permissions
            </h4>
            <div className="space-y-2">
              {data.scopes.map((scope) => {
                const desc = SCOPE_DESCRIPTIONS[scope];
                return (
                  <div
                    key={scope}
                    className="p-3 rounded-md border border-border bg-card/60 flex flex-col space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-foreground">
                        {desc?.label ?? scope}
                      </span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {scope}
                      </code>
                    </div>
                    {desc?.description && (
                      <p className="text-xs text-muted-foreground">{desc.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Form method="post" className="space-y-3 pt-2">
            <input type="hidden" name="client_id" value={data.client.clientId} />
            <input type="hidden" name="redirect_uri" value={data.redirectUri} />
            <input type="hidden" name="scope" value={data.scopes.join(" ")} />
            {data.state && <input type="hidden" name="state" value={data.state} />}
            <input type="hidden" name="code_challenge" value={data.codeChallenge} />
            <input type="hidden" name="code_challenge_method" value={data.codeChallengeMethod} />

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="submit"
                name="intent"
                value="authorize"
                className="w-full sm:flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Authorizing..." : "Allow Access"}
              </Button>
              <Button
                type="submit"
                name="intent"
                value="deny"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </Form>

          <p className="text-[11px] text-center text-muted-foreground">
            You can review or revoke agent access anytime in the Internal Admin under MCP & API.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
