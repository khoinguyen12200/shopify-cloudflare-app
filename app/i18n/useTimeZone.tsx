import { createContext, useContext } from "react";
import { UTC } from "./time-zone";

/**
 * The zone this surface renders dates in. The merchant admin and the customer pages provide the shop's own zone
 * (resolved on the server and passed down, so the browser uses the same one); anywhere that provides nothing prints
 * UTC, which is at least identical on both sides of hydration.
 */
const TimeZoneContext = createContext<string>(UTC);

export const TimeZoneProvider = TimeZoneContext.Provider;

export function useTimeZone(): string {
  return useContext(TimeZoneContext);
}
