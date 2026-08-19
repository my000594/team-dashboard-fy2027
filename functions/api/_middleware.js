import cloudflareAccessPlugin from "@cloudflare/pages-plugin-cloudflare-access";

// /api配下だけをCloudflare Accessで保護する（サイト全体は既にAccess（エッジ側）で保護済みだが、
// Cf-Access-Authenticated-User-Emailヘッダーはプレビューデプロイ等Accessを経由しない入口では
// 誰でも偽装できるため、書き込みAPIであるここだけはJWTを自前で検証して信頼できるemailを確定させる）。
export function onRequest(context) {
  return cloudflareAccessPlugin({
    domain: context.env.TEAM_DOMAIN,
    aud: context.env.POLICY_AUD,
  })(context);
}
