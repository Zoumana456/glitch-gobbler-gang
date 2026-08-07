import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import {
  RouteErrorFallback,
  RouteNotFoundFallback,
} from "./components/RouteFallbacks";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error, reset }) => (
      <RouteErrorFallback error={error as Error} reset={reset} />
    ),
    defaultNotFoundComponent: () => <RouteNotFoundFallback />,
  });

  return router;
};
