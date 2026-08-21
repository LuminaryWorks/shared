# @luminaryworks/auth-core

A provider-neutral identity runtime for NestJS. Built-in modes are:

- `logto`: Logto API resource access tokens. The default preset expects `typ=at+jwt` and retains the historical fallback for tokens with a missing or different `typ`.
- `external_oidc`: standard OIDC Discovery and JWKS verification.
- `legacy`: local HS256 JWTs for compatibility and development only.

`@nestjs/common` and `@nestjs/core` are peer dependencies supplied by the host NestJS application.

## Compatible module API

The existing `LuminaryAuthModule`, global `LuminaryJwtAuthGuard`, `@LuminaryPublic()`, three modes, and `LuminaryJwtPayload` fields remain compatible:

```typescript
LuminaryAuthModule.forRoot({
  mode: process.env.IDP_ISSUER ? "logto" : "legacy",
  issuer: process.env.IDP_ISSUER,
  audience: process.env.IDP_AUDIENCE,
  legacyJwtSecret: process.env.JWT_SECRET,
  claimsMapping: {
    permissions: "permissions",
    roles: "roles",
    orgId: "org_id",
    appAccess: "app_access",
  },
});
```

Async configuration remains available through `LuminaryAuthModule.forRootAsync(...)`.

## Provider-neutral runtime

`mode` selects a built-in runtime. Custom integrations use `runtimeProvider`; no additional provider-selection environment variable is required.

`RuntimeIdentityProvider` converts a token into a `LuminaryPrincipal`. The canonical principal fields are:

- `subject` and `issuer`: required OIDC identity coordinates.
- `organizationId`: optional canonical organization identifier.
- `appAccess`: optional product-entry grants from the `app_access` claim.
- `providerKind`: the runtime provider type.
- `externalIdentityKey`: an `issuer` and `subject` tuple, preventing collisions between identical `sub` values from different issuers.

Compatibility aliases (`sub`, `iss`, and `orgId`) remain populated.

```typescript
import type {
  LuminaryPrincipal,
  RuntimeIdentityProvider,
} from "@luminaryworks/auth-core";

class CompanyIdentityProvider implements RuntimeIdentityProvider {
  readonly kind = "company_oidc";

  async verifyToken(token: string): Promise<LuminaryPrincipal> {
    // Verify and resolve the token. Custom providers must return an
    // issuer-qualified external identity key.
    throw new Error(`Not implemented: ${token.length}`);
  }
}

LuminaryAuthModule.forRoot({
  runtimeProvider: new CompanyIdentityProvider(),
});
```

The package only includes working Logto, standard OIDC, and legacy adapters. It does not include empty Casdoor, ZITADEL, Keycloak, or Entra adapters.

## Claims presets and resolver

- `DEFAULT_LOGTO_CLAIMS_PRESET` owns the Logto claim defaults and `at+jwt` strategy.
- `DEFAULT_OIDC_CLAIMS_PRESET` provides standard OIDC defaults without the Logto token-type constraint.
- Both default presets map `appAccess` from `app_access`.
- `DefaultRuntimeClaimsResolver` supports dotted claim paths. `withClaimsMapping()` creates an overridden preset.
- `OidcJwtVerifier` continues to use `jose` for standard OIDC JWT verification and accepts a custom `ClaimsPreset` or `RuntimeClaimsResolver`.

## Verification

```bash
pnpm run check
pnpm run build
pnpm run test
```

See `spec/luminary-identity-federation.md` for the broader identity federation specification.
