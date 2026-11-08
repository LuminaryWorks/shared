# `@luminaryworks/ui`

Ant Design 6 application shell for LuminaryWorks platform apps (Platform Console now, Account Center later). Brand colour comes from `shared/brand/ant-theme.ts` and `shared/brand/tokens.css`. The primary is `#1677ff`. This package re-exports that token map as `luminaryAntTheme` and does not define a second palette.

Peer dependencies: `react`, `react-dom`, `antd`, `@ant-design/icons`. The shell is router-agnostic. Pass `onNavigate` or `renderLink`. Do not import `react-router-dom` from this package.

```tsx
import { AppShell, PageHeader, ThemeProvider } from "@luminaryworks/ui";
import "@luminaryworks/ui/shell.css";
import "antd/dist/reset.css";

<AppShell
  title={t("app.title")}
  logoSrc={logoUrl}
  nav={groups}
  pathname={location.pathname}
  onNavigate={navigate}
  siderStorageKey="lw-cc-sider"
  skipLabel={t("nav.skip")}
  collapseLabel={t("nav.collapse")}
  expandLabel={t("nav.expand")}
  t={(key) => t(key)}
  localeMenu={localeMenu}
  userMenu={userMenu}
  confirm={{
    title: t("confirm.title"),
    cancelLabel: t("common.cancel"),
    confirmLabel: t("common.confirm"),
  }}
>
  {children}
</AppShell>
```

`ThemeProvider` accepts `mode="light" | "dark"`. Light mode is `luminaryAntTheme` with no algorithm. Dark mode adds Ant Design `darkAlgorithm` on the same tokens. The sider stays on Ant Design's dark sider chrome so the navigation column does not flip with the page algorithm.

Until the package is on npm, depend on it with `link:`:

```json
"@luminaryworks/ui": "link:../../shared/packages/ui"
```

Build `dist` before typecheck (`pnpm --dir shared/packages/ui build`). `dist/` is gitignored.

## Layout grid

| Region | Size |
| --- | --- |
| Sider | 248px, collapsible |
| Header | min 64px, padding `8px 16px 8px 24px`, gap 16px |
| Content | padding 24px, the only scroll container |
| Page title row | flex, gap 16px, portaled into `#page-header-slot` |
| Card / stat gutter | 16px (`Row` `gutter={[16, 16]}`) |

`shell.css` holds these measurements. Product stylesheets that already define the same class names should load **after** `shell.css`.

## Spacing scale

Use an 8px step. Do not invent one-off gaps.

| Token | Use |
| --- | --- |
| 4px | Title to secondary lead |
| 8px | Inline control gap, related text |
| 16px | Section gap, error banner, filter bar, card gutter |
| 24px | Page padding |
| 48px | Sider collapse control height |
| 64px | Header and brand row |

## Page anatomy

1. `PageHeader` — title, optional lead, optional actions. It portals into the shell header slot. Render it from the page so the title stays with the route.
2. Filters — a toolbar under the content padding (16px below the header band). Keep filters in the page, not in the shell.
3. `ErrorBanner` — directly under the header content, `margin-bottom: 16px`, when the request failed.
4. `DataTable` — Ant Design `Table`, page size 20, size changer on. Pass `emptyLabel` from the host locale (`t("common.empty")`).

```tsx
<PageHeader title={t("orders.title")} actions={refresh} />
<ErrorBanner error={error} t={(key) => t(key)} />
<DataTable
  columns={columns}
  rows={rows}
  rowKey="id"
  loading={loading}
  error={error}
  emptyLabel={t("common.empty")}
  t={(key) => t(key)}
/>
```

## Empty, error, and loading

- **Loading.** Set `DataTable` `loading`. Leave the page header in place.
- **Error.** `ErrorBanner` maps status `401` / `402` / `403` to `errors.unauthorized`, `errors.paymentRequired`, and `errors.forbidden`. Anything else uses `errors.generic`. The description is `errors.code` plus the API code and status when the error has `status` and `code`. Pass `keys` if a product uses different locale ids. The banner renders nothing when `error` is null.
- **Empty.** Pass a translated `emptyLabel` or use `EmptyState` with a `title` (and optional `description` / `action`). Components do not ship English or Chinese sentences.
- **Confirm.** Mount the host via `AppShell` `confirm` labels (or `ConfirmDialogHost`). `requestConfirm(message, { typed, acknowledge, summary })` resolves `false` when no host is mounted. A second call waits until the first dialog settles.

## Embedding an entry link

Add a nav item. `visible: false` removes it. `key` is the menu id (Control Console uses the path). `labelKey` is translated with the `t` prop.

```tsx
{
  key: "nav.groupCommerce",
  labelKey: "nav.groupCommerce",
  items: [
    { key: "/catalog", to: "/catalog", labelKey: "nav.catalog", icon: <UnorderedListOutlined /> },
  ],
}
```

For a router link instead of `onNavigate`:

```tsx
renderLink={(item, label) => <Link to={item.to}>{label}</Link>}
```

When `renderLink` is set, the shell does not also call `onNavigate`. A content card can link the same path:

```tsx
<Link to="/catalog">
  <Card hoverable>
    <strong>{t("overview.openCatalog")}</strong>
  </Card>
</Link>
```

## i18n

- Pass `t` or already translated `label` / `emptyLabel` / confirm strings. Do not call `t(key, { defaultValue })`.
- This package does not ship locale JSON. The host writes keys into all 10 locales: `en`, `zh-CN`, `zh-TW`, `ja`, `ko`, `pt`, `nl`, `it`, `es`, `fr`.
- Control Console stores `zh-CN` copy in `public/locales/zh/common.json` and checks key parity with `src/lib/locale-parity.test.ts`.
- `ErrorBanner` expects `errors.generic`, `errors.unauthorized`, `errors.paymentRequired`, `errors.forbidden`, and `errors.code` unless `keys` overrides them.

## Docker

`apps/control-console` depends on `link:../../shared/packages/ui`. The image build context has to be the LuminaryWorks repo root so that path exists. `deploy/compose/control-plane.yaml` still has `context: ../../apps/control-console` (outside this change). Point it at the repo root and the console Dockerfile:

```yaml
build:
  context: ../..
  dockerfile: apps/control-console/Dockerfile
```

The Dockerfile builds this package, then installs and builds the console. It also copies `shared/packages/auth-react/dist` because the console Rsbuild config aliases `@luminaryworks/auth-react` there, plus `services/auth-gateway/src/register-abuse.mjs` and `assets/logo.svg`, which the console build imports from outside the app directory. Build `shared/packages/auth-react` (`dist/` is gitignored) before `docker build`.

There is no repo-root `.dockerignore`. A root context will upload local `node_modules` unless the daemon is given one. The Dockerfile copies source files explicitly and runs `pnpm install` inside the image.
