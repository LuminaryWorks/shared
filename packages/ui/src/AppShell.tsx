"use client";

import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Layout, Menu } from "antd";
import { type ReactNode, useMemo, useState } from "react";
import { ConfirmDialogHost } from "./ConfirmDialog";
import { PAGE_HEADER_SLOT_ID } from "./PageHeader";
import { ThemeProvider } from "./theme";
import {
  filterNav,
  navLabel,
  resolveSelectedNavKey,
  type NavItemConfig,
} from "./nav";
import type { TranslateFn } from "./translate";

const { Header, Sider, Content } = Layout;

export type ShellNavItem = NavItemConfig & { icon?: ReactNode };

export type ShellNavGroup = {
  key: string;
  labelKey?: string;
  label?: string;
  visible?: boolean;
  items: ShellNavItem[];
};

export type RenderNavLink = (item: ShellNavItem, label: ReactNode) => ReactNode;

export type AppShellConfirmLabels = {
  title: string;
  cancelLabel: string;
  confirmLabel: string;
};

function readCollapsed(storageKey: string | undefined, fallback: boolean): boolean {
  if (!storageKey || typeof localStorage === "undefined") return fallback;
  return localStorage.getItem(storageKey) === "1";
}

export function AppShell({
  title,
  productTitle,
  headerTitle,
  logo,
  logoSrc,
  nav,
  pathname = "/",
  selectedKey,
  onNavigate,
  renderLink,
  siderCollapsed,
  defaultSiderCollapsed = false,
  onSiderCollapsedChange,
  siderStorageKey,
  localeMenu,
  userMenu,
  skipLabel,
  collapseLabel,
  expandLabel,
  t,
  mode = "light",
  theme = true,
  confirm,
  children,
}: {
  /** Product name shown in the sider and used as the collapsed logo alt text. */
  title: string;
  /** Replaces the sider title text. */
  productTitle?: ReactNode;
  /** Optional title in the header, before the page-header slot. */
  headerTitle?: ReactNode;
  logo?: ReactNode;
  logoSrc?: string;
  nav: ShellNavGroup[];
  pathname?: string;
  selectedKey?: string;
  /** Used when `renderLink` is omitted. Receives the item `to` path. */
  onNavigate?: (to: string) => void;
  /**
   * Router-agnostic link renderer. When set, menu clicks do not also call `onNavigate`.
   * Return a link that fills the item, for example `<Link to={item.to}>{label}</Link>`.
   */
  renderLink?: RenderNavLink;
  siderCollapsed?: boolean;
  defaultSiderCollapsed?: boolean;
  onSiderCollapsedChange?: (collapsed: boolean) => void;
  /** Persists collapsed state. Control Console uses `lw-cc-sider`. */
  siderStorageKey?: string;
  localeMenu?: ReactNode;
  userMenu?: ReactNode;
  skipLabel: string;
  collapseLabel: string;
  expandLabel: string;
  t?: TranslateFn;
  mode?: "light" | "dark";
  /** Set false when a parent already mounted `ThemeProvider`. */
  theme?: boolean;
  /** Mounts `ConfirmDialogHost` so `requestConfirm` can open. */
  confirm?: AppShellConfirmLabels;
  children?: ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = useState(() =>
    readCollapsed(siderStorageKey, defaultSiderCollapsed),
  );
  const collapsed = siderCollapsed ?? uncontrolled;

  const setCollapsed = (next: boolean) => {
    if (siderCollapsed === undefined) setUncontrolled(next);
    if (siderStorageKey && typeof localStorage !== "undefined") {
      localStorage.setItem(siderStorageKey, next ? "1" : "0");
    }
    onSiderCollapsedChange?.(next);
  };

  const groups = useMemo(() => filterNav(nav), [nav]);
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const selected = selectedKey ?? resolveSelectedNavKey(items, pathname);

  const menuItems: MenuProps["items"] = groups.map((group) => ({
    type: "group",
    key: group.key,
    label: navLabel(t, group.label, group.labelKey),
    children: group.items.map((item) => {
      const label = navLabel(t, item.label, item.labelKey);
      return {
        key: item.key,
        icon: item.icon,
        label: renderLink ? renderLink(item, label) : label,
      };
    }),
  }));

  const frame = (
    <Layout className="console-layout">
      <a className="skip" href="#main">
        {skipLabel}
      </a>
      <Sider
        className="console-sider"
        collapsed={collapsed}
        collapsible
        trigger={null}
        width={248}
        theme="dark"
      >
        <div className="console-brand">
          {logo ??
            (logoSrc ? (
              <img
                className="console-mark"
                src={logoSrc}
                alt={collapsed ? title : ""}
              />
            ) : null)}
          {collapsed ? null : (
            <span className="console-brand-name">{productTitle ?? title}</span>
          )}
        </div>
        <div className="console-menu-scroll">
          <Menu
            theme="dark"
            mode="inline"
            inlineCollapsed={collapsed}
            style={{ width: "100%" }}
            selectedKeys={[selected]}
            items={menuItems}
            onClick={({ key }) => {
              if (renderLink) return;
              const item = items.find((entry) => entry.key === key);
              if (item) onNavigate?.(item.to);
            }}
          />
        </div>
        <button
          type="button"
          className="console-sider-toggle"
          aria-label={collapsed ? expandLabel : collapseLabel}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          {collapsed ? null : <span>{collapseLabel}</span>}
        </button>
      </Sider>
      <Layout className="console-main">
        <Header className="console-header">
          {headerTitle ? (
            <div className="console-header-title">{headerTitle}</div>
          ) : null}
          <div id={PAGE_HEADER_SLOT_ID} className="page-header-slot" />
          <div className="console-tools">
            {localeMenu}
            {userMenu}
          </div>
        </Header>
        <Content id="main" className="console-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  );

  const dialog = confirm ? (
    <ConfirmDialogHost
      title={confirm.title}
      cancelLabel={confirm.cancelLabel}
      confirmLabel={confirm.confirmLabel}
    />
  ) : null;

  if (!theme) {
    return (
      <>
        {frame}
        {dialog}
      </>
    );
  }

  return (
    <ThemeProvider mode={mode}>
      {frame}
      {dialog}
    </ThemeProvider>
  );
}
