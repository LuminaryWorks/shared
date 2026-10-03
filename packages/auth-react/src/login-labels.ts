import type { HeadlessLoginLabels } from "./HeadlessLoginPanel";

/** Locales shipped with the shared login card. Products may pass a wider menu. */
export type LoginLocale = "en" | "zh-CN" | "zh-TW" | "es";

export interface LoginLocaleOption {
  code: string;
  label: string;
  short: string;
}

export const DEFAULT_LOGIN_LOCALES: readonly LoginLocaleOption[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "zh-CN", label: "简体中文", short: "简" },
  { code: "zh-TW", label: "繁體中文", short: "繁" },
  { code: "es", label: "Español", short: "ES" },
];

const ZH_CN: HeadlessLoginLabels = {
  title: "登录",
  subtitle: "使用 LuminaryWorks 统一账号",
  identifierPlaceholder: "邮箱或用户名",
  registerIdentifierPlaceholder: "用户名",
  passwordPlaceholder: "密码",
  confirmPasswordPlaceholder: "确认密码",
  submitPassword: "密码登录",
  submitRegister: "创建账号",
  submitSso: "使用统一账号继续",
  submitGoogle: "Google",
  submitGithub: "GitHub",
  socialDivider: "或",
  hint: "社交账号会直接打开对应服务。密码登录使用你的 LuminaryWorks 账号。",
  registerHint: "邮箱注册需要验证码。也可以用用户名注册，或改用社交账号一键登录。",
  cancel: "取消",
  experienceUnavailable: "密码登录暂不可用，请改用社交账号。",
  showPassword: "显示密码",
  hidePassword: "隐藏密码",
  registerLink: "创建账号",
  loginLink: "已有账号？去登录",
  passwordMismatch: "两次密码不一致",
  registerTitle: "创建账号",
  registerSubtitle: "创建 LuminaryWorks 统一账号",
  registerWithEmail: "邮箱",
  registerWithUsername: "用户名",
  emailPlaceholder: "邮箱",
  verificationCodePlaceholder: "验证码",
  sendCode: "发送验证码",
  resendCode: "重新发送",
  allowedDomainsPrefix: "允许的邮箱域名",
  allowedDomainsOpen: "大多数邮箱都可以注册。",
  allowedDomainsBlocklist: "大多数邮箱可用。临时邮箱会被拒绝。",
  waitingExternalBrowser: "请在浏览器中完成登录，然后回到本应用。",
};

const ZH_TW: HeadlessLoginLabels = {
  title: "登入",
  subtitle: "使用 LuminaryWorks 統一帳號",
  identifierPlaceholder: "電子郵件或使用者名稱",
  registerIdentifierPlaceholder: "使用者名稱",
  passwordPlaceholder: "密碼",
  confirmPasswordPlaceholder: "確認密碼",
  submitPassword: "密碼登入",
  submitRegister: "建立帳號",
  submitSso: "使用統一帳號繼續",
  submitGoogle: "Google",
  submitGithub: "GitHub",
  socialDivider: "或",
  hint: "社交帳號會直接開啟對應服務。密碼登入使用你的 LuminaryWorks 帳號。",
  registerHint: "電子郵件註冊需要驗證碼。也可以用使用者名稱註冊，或改用社交帳號。",
  cancel: "取消",
  experienceUnavailable: "密碼登入暫不可用，請改用社交帳號。",
  showPassword: "顯示密碼",
  hidePassword: "隱藏密碼",
  registerLink: "建立帳號",
  loginLink: "已有帳號？去登入",
  passwordMismatch: "兩次密碼不一致",
  registerTitle: "建立帳號",
  registerSubtitle: "建立 LuminaryWorks 統一帳號",
  registerWithEmail: "電子郵件",
  registerWithUsername: "使用者名稱",
  emailPlaceholder: "電子郵件",
  verificationCodePlaceholder: "驗證碼",
  sendCode: "發送驗證碼",
  resendCode: "重新發送",
  allowedDomainsPrefix: "允許的電子郵件網域",
  allowedDomainsOpen: "大多數電子郵件都可以註冊。",
  allowedDomainsBlocklist: "大多數電子郵件可用。臨時信箱會被拒絕。",
  waitingExternalBrowser: "請在瀏覽器中完成登入，然後回到本應用。",
};

const ES: HeadlessLoginLabels = {
  title: "Iniciar sesión",
  subtitle: "Usa tu cuenta unificada de LuminaryWorks",
  identifierPlaceholder: "Correo o usuario",
  registerIdentifierPlaceholder: "Usuario",
  passwordPlaceholder: "Contraseña",
  confirmPasswordPlaceholder: "Confirmar contraseña",
  submitPassword: "Entrar con contraseña",
  submitRegister: "Crear cuenta",
  submitSso: "Continuar con la cuenta unificada",
  submitGoogle: "Google",
  submitGithub: "GitHub",
  socialDivider: "o",
  hint: "Las redes abren el proveedor directamente. La contraseña usa tu cuenta LuminaryWorks.",
  registerHint:
    "El registro por correo pide un código. También puedes usar un nombre de usuario o una red social.",
  cancel: "Cancelar",
  experienceUnavailable: "El inicio con contraseña no está disponible. Usa una red social.",
  showPassword: "Mostrar contraseña",
  hidePassword: "Ocultar contraseña",
  registerLink: "Crear una cuenta",
  loginLink: "¿Ya tienes cuenta? Inicia sesión",
  passwordMismatch: "Las contraseñas no coinciden",
  registerTitle: "Crear cuenta",
  registerSubtitle: "Crea tu cuenta unificada de LuminaryWorks",
  registerWithEmail: "Correo",
  registerWithUsername: "Usuario",
  emailPlaceholder: "Correo",
  verificationCodePlaceholder: "Código",
  sendCode: "Enviar código",
  resendCode: "Reenviar",
  allowedDomainsPrefix: "Dominios de correo permitidos",
  allowedDomainsOpen: "El registro por correo está abierto para la mayoría de proveedores.",
  allowedDomainsBlocklist: "Se aceptan la mayoría de correos. Se bloquean direcciones temporales.",
  waitingExternalBrowser: "Termina el inicio de sesión en el navegador y vuelve a esta app.",
};

const BY_LOCALE: Record<LoginLocale, HeadlessLoginLabels | undefined> = {
  en: undefined,
  "zh-CN": ZH_CN,
  "zh-TW": ZH_TW,
  es: ES,
};

/** Normalize product locale tags (`zh`, `zh-Hans`) onto the card dictionary. */
export function normalizeLoginLocale(locale: string | undefined): LoginLocale {
  const raw = (locale ?? "en").trim().toLowerCase();
  if (raw === "zh" || raw === "zh-cn" || raw === "zh-hans" || raw.startsWith("zh-cn")) {
    return "zh-CN";
  }
  if (raw === "zh-tw" || raw === "zh-hant" || raw.startsWith("zh-tw")) return "zh-TW";
  if (raw === "es" || raw.startsWith("es-")) return "es";
  if (raw === "en" || raw.startsWith("en-")) return "en";
  return "en";
}

/** Card copy for a locale. English is the panel default, so `en` returns `{}`. */
export function loginLabels(locale: string | undefined): HeadlessLoginLabels {
  return BY_LOCALE[normalizeLoginLocale(locale)] ?? {};
}
