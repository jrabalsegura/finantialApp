"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const primaryItems = [
  { href: "/", label: "Dashboard" },
  { href: "/accounts", label: "Cuentas" },
  { href: "/monthly-close", label: "Cierre" }
];

const secondaryItems = [
  { href: "/savings", label: "Partidas" },
  { href: "/reimbursements", label: "Pendientes" },
  { href: "/recurring", label: "Fijos" },
  { href: "/quick-templates", label: "Accesos rápidos" },
  { href: "/history", label: "Histórico" },
  { href: "/settings/budget", label: "Objetivo semanal" },
  { href: "/settings/backup", label: "Backup" }
];

export function AppNavbar() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMoreOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        moreMenuRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsMoreOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMoreOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMoreOpen]);

  return (
    <header className="app-navbar">
      <div className="app-navbar-inner">
        <Link className="app-brand" href="/">
          Finanzas
        </Link>

        <nav aria-label="Navegación principal" className="primary-navigation">
          {primaryItems.map((item) => (
            <NavItem
              active={isActivePath(pathname, item.href)}
              href={item.href}
              key={item.href}
              label={item.label}
            />
          ))}
        </nav>

        <div className="more-navigation" ref={moreMenuRef}>
          <button
            aria-expanded={isMoreOpen}
            aria-haspopup="menu"
            aria-label={isMoreOpen ? "Cerrar más secciones" : "Abrir más secciones"}
            onClick={() => setIsMoreOpen((current) => !current)}
            type="button"
          >
            <span className="more-label">Más</span>
            <span aria-hidden="true" className="hamburger-icon">
              <span />
              <span />
              <span />
            </span>
          </button>
          {isMoreOpen ? (
            <nav aria-label="Secciones secundarias" className="more-menu">
              {secondaryItems.map((item) => (
                <NavItem
                  active={isActivePath(pathname, item.href)}
                  href={item.href}
                  key={item.href}
                  label={item.label}
                  onClick={() => setIsMoreOpen(false)}
                />
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function NavItem({
  active,
  href,
  label,
  onClick
}: {
  active: boolean;
  href: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`app-nav-item${active ? " app-nav-item-active" : ""}`}
      href={href}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
