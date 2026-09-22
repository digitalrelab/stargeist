import { Breadcrumbs } from "@stargeist/ui";
import { Link, useMatches } from "@tanstack/react-router";

type RouteBreadcrumb = {
  id: string;
  label: string;
  pathname: string;
};

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    breadcrumb?: { label: string };
  }
}

export function RouteBreadcrumbs() {
  const breadcrumbs = useMatches({
    select: (matches) => {
      const result: Array<RouteBreadcrumb> = [];

      for (const match of matches) {
        const breadcrumb = match.staticData.breadcrumb;

        if (breadcrumb) {
          result.push({ id: match.id, label: breadcrumb.label, pathname: match.pathname });
        }
      }

      return result;
    },
  });

  return (
    <Breadcrumbs.Root>
      {breadcrumbs.map((breadcrumb, index) => {
        const next = breadcrumbs[index + 1];

        return (
          <Breadcrumb
            key={breadcrumb.id}
            breadcrumb={breadcrumb}
            current={index === breadcrumbs.length - 1}
            nextPathname={next?.pathname}
          />
        );
      })}
    </Breadcrumbs.Root>
  );
}

function Breadcrumb({
  breadcrumb,
  current,
  nextPathname,
}: {
  breadcrumb: RouteBreadcrumb;
  current: boolean;
  nextPathname: string | undefined;
}) {
  if (current) {
    return <Breadcrumbs.Current>{breadcrumb.label}</Breadcrumbs.Current>;
  }

  if (nextPathname && normalizePath(nextPathname) === normalizePath(breadcrumb.pathname)) {
    return <Breadcrumbs.Label>{breadcrumb.label}</Breadcrumbs.Label>;
  }

  return (
    <Breadcrumbs.Link render={<Link to={breadcrumb.pathname} activeOptions={{ exact: true }} />}>
      {breadcrumb.label}
    </Breadcrumbs.Link>
  );
}

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, "");
}
