import { z } from "zod";

export const currentAppInstallationSchema: z.ZodType<{
  data: { currentAppInstallation: { app: { handle: string } } };
}> = z.object({
  data: z.object({
    currentAppInstallation: z.object({
      app: z.object({
        handle: z.string().trim().min(1),
      }),
    }),
  }),
});
