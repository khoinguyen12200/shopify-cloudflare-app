import { z } from "zod";

export const currentAppInstallationSchema: z.ZodType<{
  data: { currentAppInstallation: { app: { handle: string } } };
}> = z.object({
  data: z.object({
    currentAppInstallation: z.object({
      app: z.object({
        handle: z.string().refine(
          (value) => value.trim().length > 0 && value.trim() === value,
          "App handle must be non-blank and unpadded",
        ),
      }),
    }),
  }),
});
