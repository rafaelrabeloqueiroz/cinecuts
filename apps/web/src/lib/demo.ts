/**
 * Modo demo: permite testar o produto inteiro sem credenciais de Stripe nem da
 * Graph API do Instagram. As integrações reais continuam no código e voltam a
 * ser usadas assim que DEMO_MODE sair (ou for "false") e as chaves existirem.
 */
export const isDemoMode = process.env.DEMO_MODE !== "false";
