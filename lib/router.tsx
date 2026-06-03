"use client";

import React, { useEffect, type ReactNode } from "react";
import NextLink from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
  useParams as useNextParams,
} from "next/navigation";

type ToLocation =
  | string
  | {
      pathname?: string;
      search?: string;
      hash?: string;
    };

type NavigateOptions = {
  replace?: boolean;
  scroll?: boolean;
};

type LinkProps = {
  to?: ToLocation;
  href?: ToLocation;
  replace?: boolean;
  state?: unknown;
  scroll?: boolean;
  prefetch?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
};

type NavigateProps = {
  to?: ToLocation;
  replace?: boolean;
  state?: unknown;
  scroll?: boolean;
};

type RouterShellProps = {
  children?: ReactNode;
};

const asHref = (to: ToLocation | undefined) => {
  if (typeof to === "string") return to;
  if (to && typeof to === "object") {
    const pathname = to.pathname || "/";
    const search = to.search || "";
    const hash = to.hash || "";
    return `${pathname}${search}${hash}`;
  }
  return "/";
};

export function Link({ to, href, replace, scroll, prefetch, children, ...props }: LinkProps) {
  return (
    <NextLink href={asHref(to ?? href)} replace={replace} scroll={scroll} prefetch={prefetch} {...props}>
      {children}
    </NextLink>
  );
}

export function useNavigate() {
  const router = useRouter();

  return (to: ToLocation | number, options: NavigateOptions = {}) => {
    if (typeof to === "number") {
      if (to < 0) router.back();
      else if (to > 0) router.forward();
      return;
    }

    const href = asHref(to);
    if (options.replace) {
      router.replace(href, { scroll: options.scroll });
    } else {
      router.push(href, { scroll: options.scroll });
    }
  };
}

export function useLocation() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const hash = typeof window !== "undefined" ? window.location.hash || "" : "";

  return {
    pathname,
    search: search ? `?${search}` : "",
    hash,
    state: null as { product?: unknown } | null,
  };
}

export function useSearch() {
  return useSearchParams();
}

export function useParams() {
  return useNextParams();
}

export function Navigate({ to, replace = false, scroll = true }: NavigateProps) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to ?? "/", { replace, scroll });
  }, [navigate, to, replace, scroll]);

  return null;
}

export function BrowserRouter({ children }: RouterShellProps) {
  return <>{children}</>;
}

export function Routes({ children }: RouterShellProps) {
  return <>{children}</>;
}

export function Route({ children }: RouterShellProps) {
  return <>{children}</>;
}

export function Outlet({ children }: RouterShellProps) {
  return <>{children ?? null}</>;
}

export { useSearchParams };
