/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_DEFAULT_NAME?: string;
  readonly PUBLIC_DEFAULT_ADDRESS?: string;
  readonly PUBLIC_DEFAULT_ZIP?: string;
  readonly PUBLIC_DEFAULT_CITY?: string;
  readonly PUBLIC_DEFAULT_COUNTRY?: string;
  readonly PUBLIC_DEFAULT_IBAN?: string;
  readonly PUBLIC_DEFAULT_EMAIL?: string;
  readonly PUBLIC_DEFAULT_PHONE?: string;
  readonly PUBLIC_DEFAULT_VAT_NUMBER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
