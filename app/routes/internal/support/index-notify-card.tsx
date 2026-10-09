import { useNavigation, useSubmit } from "react-router";
import { Card, CardContent, CardHeader, Switch, Text } from "ngk-dashboard";

export function NotifyCard({ notifySupport }: { readonly notifySupport: boolean }) {
  const navigation = useNavigation();
  const submit = useSubmit();
  const busy = navigation.state !== "idle";

  return (
    <Card>
      <CardHeader>
        <Text as="h2" className="font-semibold">
          Email me about tickets
        </Text>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          {/* One switch for the signed-in person's own preference, so it
              submits on change rather than needing a save button. */}
          <Switch
            defaultChecked={notifySupport}
            disabled={busy}
            onCheckedChange={(checked) => {
              void submit(
                { notifySupport: checked ? "on" : "off" },
                { method: "post" },
              );
            }}
          />
          <Text as="p" className="text-sm text-muted-foreground">
            Send me an email when a merchant opens or replies to a ticket.
            Only active accounts are ever emailed.
          </Text>
        </div>
      </CardContent>
    </Card>
  );
}
