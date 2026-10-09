import { act, render, waitFor } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNavigationLoading } from "./use-navigation-loading";

type Gate = { release: () => void; promise: Promise<null> };
function gate(): Gate {
  let release: () => void = () => undefined;
  const promise = new Promise<null>((resolve) => {
    release = () => resolve(null);
  });
  return { release, promise };
}

function Shell() {
  useNavigationLoading();
  return <Outlet />;
}

function mount(slow: Gate) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        Component: Shell,
        children: [
          { index: true, loader: () => null },
          { path: "slow", loader: () => slow.promise, Component: () => null },
        ],
      },
    ],
    { initialEntries: ["/"] },
  );
  return { router, view: render(<RouterProvider router={router} />) };
}

const loading = vi.fn<(isLoading?: boolean) => void>();

beforeEach(() => {
  loading.mockClear();
  Object.defineProperty(globalThis, "shopify", { value: { loading }, configurable: true, writable: true });
});
afterEach(() => Reflect.deleteProperty(globalThis, "shopify"));

describe("useNavigationLoading", () => {
  it("shows the admin loading bar while a navigation waits, and stops it when it settles", async () => {
    const slow = gate();
    const { router } = mount(slow);
    await waitFor(() => expect(router.state.initialized).toBe(true));
    expect(loading).not.toHaveBeenCalled();

    act(() => void router.navigate("/slow"));
    await waitFor(() => expect(loading).toHaveBeenLastCalledWith(true));

    await act(async () => {
      slow.release();
      await slow.promise;
    });
    await waitFor(() => expect(loading).toHaveBeenLastCalledWith(false));
    expect(loading.mock.calls.map(([value]) => value)).toEqual([true, false]);
  });

  it("stops the bar if the layout unmounts mid-navigation, so it can never stay stuck", async () => {
    const slow = gate();
    const { router, view } = mount(slow);
    await waitFor(() => expect(router.state.initialized).toBe(true));

    act(() => void router.navigate("/slow"));
    await waitFor(() => expect(loading).toHaveBeenLastCalledWith(true));

    view.unmount();
    expect(loading.mock.calls.map(([value]) => value)).toEqual([true, false]);
  });
});
